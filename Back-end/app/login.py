# app/routers/login.py
import os
import logging
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

load_dotenv()

ADMIN_USUARIO = os.getenv("ADMIN_USUARIO")
ADMIN_SENHA_HASH = os.getenv("ADMIN_SENHA_HASH")  # espera bcrypt ($2b$...)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITMO = "HS256"
JWT_EXPIRA_MINUTOS = 120

if not ADMIN_USUARIO or not ADMIN_SENHA_HASH or not JWT_SECRET_KEY:
    raise RuntimeError(
        "Variáveis de ambiente ausentes: verifique ADMIN_USUARIO, "
        "ADMIN_SENHA_HASH e JWT_SECRET_KEY no seu arquivo .env."
    )

_logger = logging.getLogger(__name__)
contexto_senha = CryptContext(schemes=["bcrypt"], deprecated="auto")
esquema_bearer = HTTPBearer()
router = APIRouter(prefix="", tags=["autenticação"])

# ---------- Validação simples do formato do hash (SEM chamar verify) ----------
def _parece_hash_bcrypt(h: str) -> bool:
    try:
        if not isinstance(h, str):
            return False
        # bcrypt hashes típicos começam com $2b$, $2a$ ou $2y$ e têm ~60 caracteres
        return h.startswith(("$2b$", "$2a$", "$2y$")) and 50 <= len(h) <= 80
    except Exception:
        return False

if _parece_hash_bcrypt(ADMIN_SENHA_HASH):
    _VALID_HASH_PARA_TIMING = ADMIN_SENHA_HASH
else:
    _logger.warning(
        "ADMIN_SENHA_HASH não parece ser um hash bcrypt válido. "
        "Verifique se as variáveis no .env não foram trocadas (ex.: JWT_SECRET_KEY em ADMIN_SENHA_HASH) "
        "ou se o hash foi truncado. Usando hash dummy para evitar crash; corrija o .env."
    )
    # gera um hash dummy curto e seguro para evitar exceções ao compare timing
    _VALID_HASH_PARA_TIMING = contexto_senha.hash("dummy_timing_password")


class LoginRequest(BaseModel):
    usuario: str
    senha: str


class LoginResponse(BaseModel):
    token: str
    tipo: str = "bearer"


def _criar_token(usuario: str) -> str:
    expira_em = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRA_MINUTOS)
    payload = {"sub": usuario, "exp": expira_em}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITMO)


def _normalize_senha_for_bcrypt(senha: str) -> str:
    """Garante que a senha tenha no máximo 72 bytes (bcrypt limita a 72 bytes). 
    Aqui escolhemos truncar bytes (determinístico)."""
    if senha is None:
        return ""
    b = senha.encode("utf-8")
    if len(b) <= 72:
        return senha
    # truncar para 72 bytes e decodificar ignorando bytes incompletos no final
    truncated = b[:72].decode("utf-8", errors="ignore")
    _logger.warning("Senha recebida maior que 72 bytes: truncando para compatibilidade bcrypt.")
    return truncated


def _autenticar(usuario: str, senha: str) -> bool:
    """Confere usuário + senha contra as credenciais do .env, com tratamento seguro
    para evitar exceptions caso o hash no .env seja inválido."""
    senha_norm = _normalize_senha_for_bcrypt(senha)

    if usuario != ADMIN_USUARIO:
        # verificar contra hash real ou dummy apenas para equalizar timing
        try:
            contexto_senha.verify(senha_norm, _VALID_HASH_PARA_TIMING)
        except Exception:
            # ignorar erro, retornamos False (falha de autenticação)
            pass
        return False

    try:
        return contexto_senha.verify(senha_norm, ADMIN_SENHA_HASH)
    except Exception:
        _logger.warning("Falha ao verificar a senha para o usuário administrador (hash inválido?).")
        return False


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