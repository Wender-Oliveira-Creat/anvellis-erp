
import sqlite3

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from banco import conexaoBanco, agoraUTC


def cadastroUsuario(nome, email, senha, confirmarSenha):
    if not isinstance(nome, str) or nome.strip() == "":
        return "Nome Obrigatorio"

    if not isinstance(email, str) or email.strip() == "":
        return "Email Obrigatorio"

    if "@" not in email:
        return "Email Inválido"

    if not isinstance(senha, str) or senha == "":
        return "Senha Obrigatoria"

    if len(senha) < 6:
        return "A senha deve possuir pelo menos 6 caracteres"

    if senha != confirmarSenha:
        return "As senhas não coincidem"

    nome = nome.strip()
    email = email.strip().lower()

    senhaProtegida = generate_password_hash(senha)

    try:
        with conexaoBanco() as conexao:
            conexao.execute(
                """
                INSERT INTO usuarios
                (nome, email, senha, criado_em)
                VALUES (?, ?, ?, ?)
                """,
                (nome, email, senhaProtegida, agoraUTC())
            )

    except sqlite3.IntegrityError:
        return "Email já cadastrado"

    return "Usuario cadastrado com sucesso"


def loginUsuario(email, senha):
    if not isinstance(email, str) or email.strip() == "":
        return "Email Obrigatorio"

    if "@" not in email:
        return "Email Invalido"

    if not isinstance(senha, str) or senha == "":
        return "Senha Obrigatoria"

    email = email.strip().lower()

    with conexaoBanco() as conexao:
        usuario = conexao.execute(
            "SELECT * FROM usuarios WHERE email = ?",
            (email,)
        ).fetchone()

    if usuario is None:
        return "Email ou senha incorretos"

    if not check_password_hash(usuario["senha"], senha):
        return "Email ou senha incorretos"

    return {
        "id": usuario["id"],
        "nome": usuario["nome"],
        "email": usuario["email"]
    }


def alterarUsuario(email, novoNome, novoEmail, novaSenha):
    if not isinstance(email, str) or email.strip() == "":
        return "Email Obrigatorio"

    if not isinstance(novoNome, str) or novoNome.strip() == "":
        return "Nome obrigatorio"

    if not isinstance(novoEmail, str) or "@" not in novoEmail:
        return "Email Invalido"

    if not isinstance(novaSenha, str) or len(novaSenha) < 6:
        return "Senha Invalida"

    senhaProtegida = generate_password_hash(novaSenha)

    try:
        with conexaoBanco() as conexao:
            cursor = conexao.execute(
                """
                UPDATE usuarios
                SET nome = ?, email = ?, senha = ?
                WHERE email = ?
                """,
                (
                    novoNome.strip(),
                    novoEmail.strip().lower(),
                    senhaProtegida,
                    email.strip().lower()
                )
            )

            if cursor.rowcount == 0:
                return "Usuario não encontrado"

    except sqlite3.IntegrityError:
        return "Email já cadastrado"

    return "Usuario alterado com sucesso"


def excluirUsuario(email):
    if not isinstance(email, str) or email.strip() == "":
        return "Email Obrigatorio"

    if "@" not in email:
        return "Email Invalido"

    with conexaoBanco() as conexao:
        cursor = conexao.execute(
            "DELETE FROM usuarios WHERE email = ?",
            (email.strip().lower(),)
        )

        if cursor.rowcount == 0:
            return "Usuario não encontrado"

    return "Usuario excluido com sucesso"
   