# app/database.py
# Conexão com o PostgreSQL (Neon) via SQLAlchemy.

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "Variável de ambiente DATABASE_URL ausente. No Neon, use a connection "
        "string com '-pooler' no host (ex: ...ep-xxx-pooler.neon.tech/...) "
        "e '?sslmode=require' no final — o pooler é o que permite aguentar "
        "várias pessoas conectando ao mesmo tempo sem esgotar conexões."
    )

# pool_pre_ping: testa a conexão antes de usar — evita erro quando o Neon
# hiberna o banco por inatividade e a conexão antiga já não é válida.
# pool_recycle: descarta conexões com mais de 5 minutos, pelo mesmo motivo.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def obter_db():
    """Dependência do FastAPI: abre uma sessão do banco por requisição e
    garante que ela é fechada no final, mesmo se der erro no meio."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()