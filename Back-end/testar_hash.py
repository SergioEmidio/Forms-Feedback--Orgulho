from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

HASH_DO_ENV = "$2b$12$5OaDvAABdjSwID60ykopQeF/3DTObLU/UqNHjKK.9qE2BtGjp/CBW"
SENHA_TESTADA = "OrionProject_"

print("Resultado:", pwd.verify(SENHA_TESTADA, HASH_DO_ENV))
