# app/utils/gerar_hash.py
# Gera um hash bcrypt a partir de uma senha (não faça commit do .env com senhas)
# Usa a lib "bcrypt" diretamente (mesma lib usada em app/login.py) para
# garantir que o hash gerado aqui é 100% compatível com o que será verificado
# em produção — antes esse script usava passlib, que podia gerar hash com uma
# versão de bcrypt diferente da instalada no servidor (Render) e causar falha
# de login mesmo com a senha certa.
import getpass
import sys

import bcrypt


def main():
    if len(sys.argv) >= 2:
        senha = sys.argv[1]
    else:
        # pede a senha sem eco no terminal (você digita e não aparece nada)
        senha = getpass.getpass("Senha admin (entrada oculta): ")

    senha_bytes = senha.encode("utf-8")
    if len(senha_bytes) > 72:
        senha_bytes = senha_bytes[:72]

    hashed = bcrypt.hashpw(senha_bytes, bcrypt.gensalt()).decode("utf-8")
    print(hashed)

if __name__ == "__main__":
    main()