# app/utils/gerar_hash.py
# Gera um hash bcrypt a partir de uma senha (não faça commit do .env com senhas)
import getpass
import sys
from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def main():
    if len(sys.argv) >= 2:
        senha = sys.argv[1]
    else:
        # pede a senha sem eco no terminal (você digita e não aparece nada)
        senha = getpass.getpass("Senha admin (entrada oculta): ")

    hashed = pwd.hash(senha)
    print(hashed)

if __name__ == "__main__":
    main()