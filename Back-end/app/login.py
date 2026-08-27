# app/routers/login.py
# (trecho inteiro com pequenas proteções adicionais para evitar 500s quando o hash estiver inválido)

import os
from datetime import datetime, timedelta, timezone
import logging
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

load_dotenv()

# ============================================================
# CONFIGURAÇÃO (vem do .env)
# ============================================================
ADMIN_USUARIO = os.getenv("ADMIN_USUARIO")
ADMIN_SENHA_HASH = os.getenv("ADMIN_SENHA_HASH")  # hash bcrypt esperado
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

# ------------------------------------------------------------
# Proteção adicional: detecta se ADMIN_SENHA_HASH tem formato inválido
# e prepara um hash dummy para usar em verificações de timing sem lançar.
# ------------------------------------------------------------
_logger = logging.getLogger(__name__)
try:
    # Testa apenas a estrutura: se a string for um hash bcrypt válido
    # a chamada verify com uma senha qualquer não necessariamente retorna True,
    # mas lançará erro se o hash for malformado. Usamos isso para detectar malformações.
    contexto_senha.verify("test", ADMIN_SENHA_HASH)
    _VALID_HASH_PARA_TIMING = ADMIN_SENHA_HASH
except Exception:
    _logger.warning(
        "ADMIN_SENHA_HASH parece não ser um hash bcrypt válido. "
        "Isso pode indicar que as variáveis no .env estão trocadas "
        "(ex.: JWT_SECRET_KEY em ADMIN_SENHA_HASH) ou que o hash está truncado."
        " O sistema fará validações seguras, mas corrija o .env para evitar problemas."
    )
    # Geramos um hash dummy seguro para usar apenas em verificações de timing,
    # assim não levantamos exceções quando usuário incorreto é testado.
    _VALID_HASH_PARA_TIMING = contexto_senha.hash("dummy_timing_password")


# ============================================================
# MODELOS
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
    """Confere usuário + senha contra as credenciais do .env, usando bcrypt.

    Importante: qualquer exceção durante verify() é tratada como falha de autenticação
    (retornamos False) — não queremos que uma string malformada no .env quebre a rota.
    """
    # Se o usuário estiver incorreto, fazemos uma verificação contra um hash
    # (o hash real ou um hash dummy) só para igualar o tempo de resposta e evitar
    # diferença de timing que indique existência do usuário.
    if usuario != ADMIN_USUARIO:
        try:
            contexto_senha.verify(senha, _VALID_HASH_PARA_TIMING)
        except Exception:
            # ignoramos erros aqui — já usamos o hash dummy se necessário
            pass
        return False

    # Se o usuário bate, tentamos verificar a senha contra o hash real.
    try:
        return contexto_senha.verify(senha, ADMIN_SENHA_HASH)
    except Exception:
        _logger.warning("Falha ao verificar a senha para o usuário administrador (hash inválido?).")
        return False


# ============================================================
# ROTA DE LOGIN
# ============================================================
@router.post("/login", response_model=LoginResponse)
def login(dados: LoginRequest):
    autenticado = _autenticar(dados.usuario, dados.senha)

    if not autenticado:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    token = _criar_token(dados.usuario)
    return LoginResponse(token=token)


# ============================================================
# Dependência para proteger rotas usando bearer token (permanece igual)
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