# app/main.py
# Ponto de entrada do backend — junta banco, CORS e todas as rotas.
import logging
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import respostas, resumo, qrcode
# "salas" de propósito NÃO está aqui — confirmado como não usado no projeto.

from .login import router as login_router
# Import da autenticação do site. Não apagar.

Base.metadata.create_all(engine)

app = FastAPI(
    title="API do Projeto de Feedback",
    description="API para coletar respostas de feedback, gerar QR Codes, "
    "importar/exportar planilhas e fornecer resumo estatístico.",
    version="1.0.0",
)

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Oculta dos logs as requisições para o favicon ou para a sua rota de ping
        return "GET /favicon.ico" not in record.getMessage() and "GET / " not in record.getMessage()

# Adiciona o filtro ao logger padrão do uvicorn.access
logging.getLogger("uvicorn.access").addFilter(EndpointFilter())
# ============================================================
# CORS — troque os endereços abaixo pelo domínio real do frontend
# assim que ele estiver publicado.
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",   # Live Server local
        "http://localhost:5500",   # Live Server local
        # "https://seu-frontend-publicado.com",  # <- adicione quando publicar
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(login_router)
app.include_router(respostas.router)
app.include_router(resumo.router)
app.include_router(qrcode.router)


# 1. Libera o acesso à pasta "docs" para o navegador conseguir ler o CSS e o JS
app.mount("/docs", StaticFiles(directory="docs"), name="docs_assets")

# 2. Faz o FastAPI servir a raiz (onde está o index.html)
app.mount("/", StaticFiles(directory=".", html=True), name="root")

@app.get("/")
def raiz():
    return {"mensagem": "API do RefMap rodando!"}