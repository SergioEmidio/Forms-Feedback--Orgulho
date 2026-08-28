# app/routers/login.py
import os
import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

load_dotenv()

# .strip() é ESSENCIAL aqui: plataformas como o Render costumam guardar um
# "\n" ou espaço extra no final do valor quando a variável é colada no painel
# (às vezes vem de copiar a linha inteira do .env, newline incluso). Um único
# caractere de sobra no fim do hash bcrypt faz o bcrypt.checkpw() rejeitar o
# hash como inválido e cair no "except" → sempre retorna "senha incorreta",
# mesmo com a senha certa. Isso também acontecia (silenciosamente) com o
# passlib, só que o passlib engolia o erro sem deixar rastro nenhum no log.
ADMIN_USUARIO = (os.getenv("ADMIN_USUARIO") or "").strip()
ADMIN_SENHA_HASH = (os.getenv("ADMIN_SENHA_HASH") or "").strip()  # bcrypt ($2b$...)
JWT_SECRET_KEY = (os.getenv("JWT_SECRET_KEY") or "").strip()
JWT_ALGORITMO = "HS256"
JWT_EXPIRA_MINUTOS = 120

if not ADMIN_USUARIO or not ADMIN_SENHA_HASH or not JWT_SECRET_KEY:
    raise RuntimeError(
        "Variáveis de ambiente ausentes: verifique ADMIN_USUARIO, "
        "ADMIN_SENHA_HASH e JWT_SECRET_KEY no seu arquivo .env."
    )

_logger = logging.getLogger(__name__)
esquema_bearer = HTTPBearer()
router = APIRouter(prefix="", tags=["autenticação"])

# Trocamos passlib.CryptContext por bcrypt puro.
# Motivo: passlib 1.7.4 (a última versão publicada) tem um bug conhecido de
# incompatibilidade com versões atuais da lib "bcrypt" (>=4.1) — ele tenta ler
# `bcrypt.__about__.__version__`, que não existe mais, e isso corrompe a
# detecção do backend em alguns ambientes. Como o requirements.txt não fixava
# a versão do bcrypt, o Render podia instalar uma versão mais nova que a usada
# localmente para gerar o hash, quebrando a verificação em produção mesmo com
# a senha certa. Chamar bcrypt.checkpw() diretamente elimina essa camada de
# risco por completo.

# Log de diagnóstico (SEM vazar a senha ou o hash completo) para confirmar,
# nos logs do Render, que a variável de ambiente chegou íntegra:
_logger.info(
    "Config de login carregada: usuário=%r (%d chars) | hash bcrypt começa com "
    "%r e tem %d chars (esperado: 60) | jwt secret tem %d chars.",
    ADMIN_USUARIO,
    len(ADMIN_USUARIO),
    ADMIN_SENHA_HASH[:7],
    len(ADMIN_SENHA_HASH),
    len(JWT_SECRET_KEY),
)

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
        "ADMIN_SENHA_HASH não parece ser um hash bcrypt válido (tamanho=%d, "
        "início=%r). Verifique se as variáveis no .env/Render não foram trocadas "
        "(ex.: JWT_SECRET_KEY em ADMIN_SENHA_HASH), se sobrou espaço/quebra de "
        "linha no valor colado no painel do Render, ou se o hash foi truncado. "
        "Usando hash dummy para evitar crash; login do admin vai falhar até isso "
        "ser corrigido.",
        len(ADMIN_SENHA_HASH),
        ADMIN_SENHA_HASH[:10],
    )
    # gera um hash dummy curto e seguro para evitar exceções ao compare timing
    _VALID_HASH_PARA_TIMING = bcrypt.hashpw(
        b"dummy_timing_password", bcrypt.gensalt()
    ).decode("utf-8")


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
    usuario = (usuario or "").strip()
    senha_norm = _normalize_senha_for_bcrypt(senha)
    senha_bytes = senha_norm.encode("utf-8")

    if usuario != ADMIN_USUARIO:
        # verificar contra hash real ou dummy apenas para equalizar timing
        try:
            bcrypt.checkpw(senha_bytes, _VALID_HASH_PARA_TIMING.encode("utf-8"))
        except Exception:
            # ignorar erro, retornamos False (falha de autenticação)
            pass
        return False

    try:
        return bcrypt.checkpw(senha_bytes, ADMIN_SENHA_HASH.encode("utf-8"))
    except Exception as erro:
        # Antes esse erro era engolido em silêncio (só um log genérico), o que
        # tornava impossível descobrir POR QUE a senha certa não passava.
        # Agora o motivo real (ex.: "Invalid salt", hash malformado, etc.)
        # aparece nos logs do Render para diagnóstico — sem nunca expor a
        # senha em texto puro.
        _logger.warning(
            "Falha ao verificar a senha do admin — motivo técnico: %s (%s). "
            "Confira se ADMIN_SENHA_HASH no Render está EXATAMENTE igual ao "
            "hash gerado (60 caracteres, começando com $2a$/$2b$/$2y$, sem "
            "espaços ou quebras de linha extras).",
            type(erro).__name__,
            erro,
        )
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