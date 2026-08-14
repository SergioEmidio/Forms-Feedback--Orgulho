# gerar_hash.py
# Script de uso único: gera o hash bcrypt da sua senha + uma chave secreta
# pro JWT. Rode com: python gerar_hash.py
# Depois, copie as duas linhas impressas direto pro seu arquivo .env.

import secrets

from passlib.context import CryptContext

contexto = CryptContext(schemes=["bcrypt"], deprecated="auto")

senha = input("Digite a senha que você quer usar no login: ")

print("\nCopie estas duas linhas para o seu arquivo .env:\n")
print(f"ADMIN_SENHA_HASH={contexto.hash(senha)}")
print(f"JWT_SECRET_KEY={secrets.token_hex(32)}")
print("\nNão esqueça de adicionar também: ADMIN_USUARIO=escolha_um_usuario")