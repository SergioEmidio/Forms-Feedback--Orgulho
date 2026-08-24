# app/routers/respostas.py
# Rotas de respostas: enviar (público), listar/excluir/exportar/importar
# (exigem login).

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import ValidationError

from ..database import obter_db
from ..models import Resposta
from ..schemas import RespostaCreate, RespostaOut
from ..login import verificar_token
from ..utils.planilha import gerar_planilha_respostas, ler_planilha_para_respostas

router = APIRouter(prefix="/respostas", tags=["respostas"])


# ============================================================
# POST /respostas — enviar uma nova avaliação (SEM login, é o formulário público)
# ============================================================
@router.post("", response_model=RespostaOut, response_model_by_alias=True, status_code=status.HTTP_201_CREATED)
def criar_resposta(dados: RespostaCreate, db: Session = Depends(obter_db)):
    nova_resposta = Resposta(**dados.model_dump(by_alias=False))
    db.add(nova_resposta)
    db.commit()
    db.refresh(nova_resposta)
    return nova_resposta


# ============================================================
# GET /respostas/exportar — baixar como planilha Excel (COM login)
# Precisa vir ANTES de "/{resposta_id}", senão "exportar" seria
# interpretado como se fosse um id.
# ============================================================
@router.get("/exportar")
def exportar_planilha(
    tipo_participante: Optional[str] = Query(default=None),
    nota_minima: Optional[int] = Query(default=None),
    usuario: str = Depends(verificar_token),
    db: Session = Depends(obter_db),
):
    consulta = db.query(Resposta)

    if tipo_participante:
        consulta = consulta.filter(Resposta.tipo_participante == tipo_participante)
    if nota_minima:
        consulta = consulta.filter(Resposta.nota >= nota_minima)

    respostas = consulta.order_by(Resposta.enviado_em.desc()).all()

    dados_para_planilha = [
        {
            "id": r.id,
            "nome_completo": r.nome_completo,
            "nascimento": r.nascimento,
            "tipo_participante": r.tipo_participante,
            "outro_detalhe": r.outro_detalhe,
            "nota": r.nota,
            "opiniao": r.opiniao,
            "enviado_em": r.enviado_em,
        }
        for r in respostas
    ]

    buffer = gerar_planilha_respostas(dados_para_planilha)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=respostas.xlsx"},
    )


# ============================================================
# POST /respostas/importar — subir uma planilha (.xlsx/.csv) e gravar
# as respostas dela no banco (COM login)
# ============================================================
@router.post("/importar")
async def importar_planilha(
    arquivo: UploadFile = File(...),
    usuario: str = Depends(verificar_token),
    db: Session = Depends(obter_db),
):
    conteudo = await arquivo.read()

    try:
        linhas = ler_planilha_para_respostas(conteudo, arquivo.filename)
    except Exception as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não foi possível ler o arquivo: {erro}",
        )

    importadas = 0
    erros = []

    for numero_linha, linha in enumerate(linhas, start=2):  # start=2: linha 1 é o cabeçalho
        try:
            # Reaproveita a MESMA validação do formulário público — garante
            # que dados importados em massa seguem as mesmas regras
            # (nota entre 1-10, nome obrigatório, etc.), sem duplicar lógica.
            dados_validados = RespostaCreate.model_validate(linha)
            nova_resposta = Resposta(**dados_validados.model_dump(by_alias=False))
            db.add(nova_resposta)
            importadas += 1
        except ValidationError as erro:
            erros.append({"linha": numero_linha, "motivo": erro.errors()[0]["msg"]})

    db.commit()

    return {
        "importadas": importadas,
        "comErro": len(erros),
        "erros": erros,
    }


# ============================================================
# GET /respostas — listar todas (COM login — é o que o dashboard usa)
# ============================================================
@router.get("", response_model=List[RespostaOut], response_model_by_alias=True)
def listar_respostas(usuario: str = Depends(verificar_token), db: Session = Depends(obter_db)):
    return db.query(Resposta).order_by(Resposta.enviado_em.desc()).all()


# ============================================================
# DELETE /respostas/{id} — excluir uma resposta (COM login)
# ============================================================
@router.delete("/{resposta_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_resposta(resposta_id: int, usuario: str = Depends(verificar_token), db: Session = Depends(obter_db)):
    resposta = db.query(Resposta).filter(Resposta.id == resposta_id).first()

    if not resposta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resposta não encontrada.")

    db.delete(resposta)
    db.commit()
    return None