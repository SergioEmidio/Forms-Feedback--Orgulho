# app/routers/login.py
#
# Rota de autenticação do dashboard. Login simples de administrador único
# (adequado pro escopo de um projeto escolar) — usuário e hash da senha
# vêm de variáveis de ambiente (.env), nunca do código.
#
# Requisitos a adicionar no requirements.txt:
#   fastapi
#   uvicorn
#   python-jose[cryptography]
#   passlib[bcrypt]
#   python-dotenv
#   pydantic

import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

load_dotenv()

# ============================================================
# CONFIGURAÇÃO (vem do .env — NUNCA deixe valores reais aqui no código)
# ============================================================
ADMIN_USUARIO = os.getenv("ADMIN_USUARIO")
ADMIN_SENHA_HASH = os.getenv("ADMIN_SENHA_HASH")  # hash bcrypt, não a senha em texto puro
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITMO = "HS256"
JWT_EXPIRA_MINUTOS = 120  # token expira em 2 horas

if not ADMIN_USUARIO or not ADMIN_SENHA_HASH or not JWT_SECRET_KEY:
    raise RuntimeError(
        "Variáveis de ambiente ausentes: verifique ADMIN_USUARIO, "
        "ADMIN_SENHA_HASH e JWT_SECRET_KEY no seu arquivo .env."
    )

contexto_senha = CryptContext(schemes=["bcrypt"], deprecated="auto")
esquema_bearer = HTTPBearer()

router = APIRouter(prefix="", tags=["autenticação"])


# ============================================================
# MODELOS (request/response) — mova pra schemas.py se preferir manter
# tudo centralizado lá, essa parte não precisa ficar aqui necessariamente.
# ============================================================
class LoginRequest(BaseModel):
    usuario: str
    senha: str


class LoginResponse(BaseModel):
    token: str
    tipo: str = "bearer"


# ============================================================
# FUNÇÕES INTERNAS DE SEGURANÇA
# ============================================================
def _criar_token(usuario: str) -> str:
    """Gera um JWT assinado, válido por JWT_EXPIRA_MINUTOS."""
    expira_em = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRA_MINUTOS)
    payload = {"sub": usuario, "exp": expira_em}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITMO)


def _autenticar(usuario: str, senha: str) -> bool:
    """Confere usuário + senha contra as credenciais do .env, usando bcrypt
    (nunca comparando strings em texto puro — isso evita timing attacks
    e garante que a senha real nunca precisou ficar salva em lugar nenhum)."""
    if usuario != ADMIN_USUARIO:
        # Mesmo com usuário errado, ainda rodamos o verify() abaixo com um hash
        # qualquer, pra não vazar (por tempo de resposta) se o usuário existe ou não.
        contexto_senha.verify(senha, ADMIN_SENHA_HASH)
        return False

    return contexto_senha.verify(senha, ADMIN_SENHA_HASH)


# ============================================================
# ROTA DE LOGIN
# ============================================================
@router.post("/login", response_model=LoginResponse)
def login(dados: LoginRequest):
    autenticado = _autenticar(dados.usuario, dados.senha)

    if not autenticado:
        # Mensagem genérica de propósito — não revela se o erro foi
        # no usuário ou na senha, dificulta ataque de enumeração de usuários.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    token = _criar_token(dados.usuario)
    return LoginResponse(token=token)


# ============================================================
# DEPENDÊNCIA REUTILIZÁVEL — protege qualquer outra rota do dashboard.
#
# Uso em outro arquivo de rota (ex: respostas.py):
#
#   from app.routers.login import verificar_token
#
#   @router.get("/respostas")
#   def listar_respostas(usuario: str = Depends(verificar_token)):
#       ...
#
# Sem isso, QUALQUER pessoa pode chamar /respostas direto pela API,
# mesmo sem nunca ter feito login — é essa dependência que fecha o cofre,
# não a tela de login sozinha.
# ============================================================
def verificar_token(credenciais: HTTPAuthorizationCredentials = Depends(esquema_bearer)) -> str:
    token = credenciais.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITMO])
        usuario: str = payload.get("sub")

        if usuario is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido.",
            )

        return usuario

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado. Faça login novamente.",
        )