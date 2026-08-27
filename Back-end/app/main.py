# app/main.py
# Ponto de entrada do backend — junta banco, CORS e todas as rotas.

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import engine, Base, obter_db
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

# ============================================================
# CORS — troque os endereços abaixo pelo domínio real do frontend
# assim que ele estiver publicado.
# ==============================================================
# HOTFIX: permitir temporariamente todas as origens para eliminar
# falhas de preflight (OPTIONS) que causam 405 no frontend.
# Depois do deploy e testes OK, troque "allow_origins" por uma
# lista restrita de domínios (ex: https://seu-usuario.github.io).
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # permissivo temporário para resolver 405
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(login_router)
app.include_router(respostas.router)
app.include_router(resumo.router)
app.include_router(qrcode.router)


@app.get("/")
def raiz():
    return {"mensagem": "API do RefMap rodando!"}


@app.get("/saude")
def verificar_saude(db: Session = Depends(obter_db)):
    """Consulta o banco de verdade (SELECT 1) — usada pelo keep-alive do
    GitHub Actions pra manter tanto o Render QUANTO o Neon acordados.
    A rota "/" sozinha não bastava porque não toca no banco."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "banco": "conectado"}


# health endpoint extra usado por alguns provedores/chekcers
@app.get("/_health")
def health():
    return {"status": "ok"}
