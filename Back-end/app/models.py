# ← Tabelas do banco como classes Python (SQLAlchemy)

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
# Tipos de coluna disponíveis pra desenhar as tabelas (ID, texto, número, sim/não, data, chave estrangeira)

from sqlalchemy.sql import func
# Permite usar func.now() pra data/hora automática (equivalente ao CURRENT_TIMESTAMP do SQL)

from sqlalchemy.orm import relationship
# Cria a ligação entre tabelas relacionadas (ex: uma resposta pertence a uma sala)

from .database import Base
# Importa a Base criada em database.py — toda tabela precisa herdar dela

