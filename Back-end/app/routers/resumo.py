# app/routers/resumo.py
# Estatísticas agregadas, calculadas direto no banco (SQL faz a soma/média
# em vez do navegador ter que baixar tudo) — importante pra escala, já que
# GROUP BY/AVG no banco é muito mais rápido que somar no navegador quando
# o número de respostas cresce.

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import obter_db
from ..models import Resposta
from ..login import verificar_token

router = APIRouter(prefix="/resumo", tags=["resumo"])


@router.get("")
def obter_resumo(usuario: str = Depends(verificar_token), db: Session = Depends(obter_db)):
    total = db.query(func.count(Resposta.id)).scalar() or 0
    media_nota = db.query(func.avg(Resposta.nota)).scalar() or 0

    contagem_por_tipo = dict(
        db.query(Resposta.tipo_participante, func.count(Resposta.id))
        .group_by(Resposta.tipo_participante)
        .all()
    )

    return {
        "total": total,
        "notaMedia": round(float(media_nota), 2),
        "porTipo": contagem_por_tipo,
    }