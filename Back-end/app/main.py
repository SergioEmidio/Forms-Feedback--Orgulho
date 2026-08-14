# Ponto de entrada, cria o FastAPI e as rotas
from fastapi import FastAPI
# Classe principal que cria a aplicação/servidor

from fastapi.middleware.cors import CORSMiddleware
# Libera o frontend (GitHub Pages) a fazer requisições pro backend sem ser bloqueado

from .routers import respostas, salas, resumo, qrcode
# Importa cada arquivo de rota separado, pra "plugar" no app principal

from .database import engine, Base
# engine conecta ao banco; Base.metadata.create_all(engine) cria as tabelas se não existirem


##Esse import é da senha do nosso site, não apagar.
from .login import router as login_router

# 2. Criação da aplicação
app = FastAPI(
    title="API do Projeto de Feedback",
    description="API para coletar respostas de feedback, gerar QR Codes e fornecer resumo estatístico.",
    version="1.0.0",
)
# 3. Inclusão das rotas
app.include_router(login_router)

@app.get("/")
def raiz():
    return {"mensagem": "API do RefMap rodando!"}