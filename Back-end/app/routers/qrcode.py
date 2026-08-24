# app/routers/qrcode.py
# Gera a imagem de um QR Code a partir de um link. Salva em disco e
# REAPROVEITA o arquivo se o mesmo link já foi pedido antes — importante
# pra escala: se 100 pessoas abrirem a mesma página com o mesmo QR Code
# ao mesmo tempo, o servidor não gera a imagem 100 vezes, só na primeira.

import os
import hashlib

import qrcode
from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

router = APIRouter(prefix="/qrcode", tags=["qrcode"])

# app/routers/qrcode.py -> sobe um nível (app/) -> static/qrcodes/
DIRETORIO_QRCODES = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "qrcodes")
os.makedirs(DIRETORIO_QRCODES, exist_ok=True)


@router.get("")
def gerar_qrcode(url: str = Query(..., min_length=1, description="Link que o QR Code deve abrir")):
    # Nome de arquivo baseado no hash do link, não no link em si — evita
    # problemas com caracteres especiais/acentos no nome do arquivo.
    nome_arquivo = hashlib.sha256(url.encode("utf-8")).hexdigest() + ".png"
    caminho_arquivo = os.path.join(DIRETORIO_QRCODES, nome_arquivo)

    if not os.path.exists(caminho_arquivo):
        imagem = qrcode.make(url)
        imagem.save(caminho_arquivo)

    return FileResponse(caminho_arquivo, media_type="image/png")