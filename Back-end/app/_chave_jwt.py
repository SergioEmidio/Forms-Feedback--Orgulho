# gerar_chave_jwt.py
# Script de uso único: gera só a chave secreta do JWT.
# Rode com: python gerar_chave_jwt.py

import secrets

print("\nCopie esta linha para o seu arquivo .env:\n")
print(f"JWT_SECRET_KEY={secrets.token_hex(32)}")