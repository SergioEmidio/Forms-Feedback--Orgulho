# app/models.py
# Estrutura da tabela "respostas" no banco de dados.
#
# NOTA: Boolean é usado aqui (consentimento). ForeignKey e relationship
# NÃO são usados de propósito — só fariam sentido se existisse uma tabela
# "salas" ligada a cada resposta, e você confirmou que não vai usar isso.
# Se um dia precisar (ex: agrupar respostas por apresentação/evento),
# é só adicionar uma coluna sala_id com ForeignKey depois.

from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, Text
from app.database import Base


class Resposta(Base):
    __tablename__ = "respostas"

    id = Column(Integer, primary_key=True, index=True)
    nome_completo = Column(String(200), nullable=False)
    nascimento = Column(Date, nullable=False)
    tipo_participante = Column(String(50), nullable=False, index=True)
    outro_detalhe = Column(String(200), nullable=True)
    nota = Column(Integer, nullable=False)
    consentimento = Column(Boolean, nullable=False, default=False)
    opiniao = Column(Text, nullable=True)

    # Horário real de envio, capturado no navegador da pessoa (ver form.js) —
    # não é o horário em que o servidor recebeu.
    enviado_em = Column(DateTime(timezone=True), nullable=False, index=True)