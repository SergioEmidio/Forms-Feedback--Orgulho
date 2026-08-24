# app/schemas.py
# Validação de entrada/saída (Pydantic).
# O "alias" em cada campo traduz nome_completo (Python/SQL) <-> "nome-completo"
# (o que o form.js realmente envia), nos dois sentidos, automaticamente.

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class RespostaCreate(BaseModel):
    """O que a API espera receber no POST /respostas (vindo do form.js)."""

    model_config = ConfigDict(populate_by_name=True)

    nome_completo: str = Field(alias="nome-completo", min_length=1)
    nascimento: date
    tipo_participante: str = Field(alias="tipo-participante")
    outro_detalhe: Optional[str] = Field(default=None, alias="outro-detalhe")
    nota: int = Field(ge=1, le=10)
    consentimento: bool
    opiniao: Optional[str] = None
    enviado_em: datetime = Field(alias="enviado-em")

    @field_validator("consentimento", mode="before")
    @classmethod
    def aceitar_checkbox_como_booleano(cls, valor):
        # O checkbox do formulário manda o texto "sim" (valor do atributo
        # value do HTML), não true/false — essa validação aceita os dois formatos.
        if isinstance(valor, str):
            return valor.strip().lower() in ("sim", "true", "1", "on")
        return bool(valor)


class RespostaOut(BaseModel):
    """O que a API devolve pro dashboard.js (GET /respostas)."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: int
    nome_completo: str = Field(alias="nome-completo")
    nascimento: date
    tipo_participante: str = Field(alias="tipo-participante")
    outro_detalhe: Optional[str] = Field(default=None, alias="outro-detalhe")
    nota: int
    opiniao: Optional[str] = None
    enviado_em: datetime = Field(alias="enviado-em")