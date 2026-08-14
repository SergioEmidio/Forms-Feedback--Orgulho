#← Conexão com o PostgreSQL (Neon) via SQLAlchemy
import os
# Acessa variáveis de ambiente do sistema (necessário pra pegar a URL do banco)

from dotenv import load_dotenv
# Lê o arquivo .env e carrega a senha/URL do banco pras variáveis de ambiente

from sqlalchemy import create_engine
# Cria a "conexão motor" que fala de fato com o PostgreSQL

from sqlalchemy.ext.declarative import declarative_base
# Cria a classe Base, que todo modelo de tabela (em models.py) vai herdar

