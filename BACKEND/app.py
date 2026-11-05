from flask_cors import CORS
from flask import Flask, jsonify, request, session

import os
import smtplib
import hashlib

from email.message import EmailMessage

from itsdangerous import (
    URLSafeTimedSerializer,
    BadSignature,
    SignatureExpired
)

from werkzeug.security import generate_password_hash

from usuario import cadastroUsuario, loginUsuario
from banco import criarBanco, conexaoBanco
from produto import (
    listarProdutos,
    cadastrarProduto,
    alterarProduto,
    excluirProduto
)


app = Flask(__name__)

CORS(
    app,
    origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    supports_credentials=True
)

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "chave-local-apenas-para-testes"
)

criarBanco()

@app.route("/")
def inicio():
    return "Bem vindo ao sistema Anvellis"


@app.route("/produtos")
def produtos():
    lista = listarProdutos()
    resultado = []

    for produto in lista:
        dados = {
            "id": produto[0],
            "nome": produto[1],
            "preco": produto[2],
            "quantidade": produto[3]
        }

        resultado.append(dados)
    
    return jsonify(resultado)

@app.route("/produtos", methods=["POST"])
def cadastrar():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Envie um objeto JSON válido"}), 400
    
    nome = dados.get("nome")
    preco = dados.get("preco")
    quantidade = dados.get("quantidade")

    mensagem = cadastrarProduto(nome,preco,quantidade)

    if mensagem == "Produto cadastrado com sucesso!":
        return jsonify({"mensagem": mensagem}), 201
    else:
        return jsonify({"mensagem": mensagem}), 400

@app.route("/produtos/<int:id>", methods=["PUT"])
def atualizar(id):
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Envie um objeto JSON válido"}), 400

    novoNome = dados.get("nome")
    novoPreco = dados.get("preco")

    mensagem = alterarProduto(id,novoNome,novoPreco)

    if mensagem == "Produto alterado com sucesso!":
        return jsonify ({"mensagem": mensagem}), 200

    elif mensagem == "Produto não encontrado":
        return jsonify ({"mensagem": mensagem}), 404

    else:
        return jsonify ({"mensagem": mensagem}), 400

@app.route("/produtos/<int:id>", methods=["DELETE"])
def excluir(id):
    mensagem = excluirProduto(id)

    if mensagem == "Produto excluido com sucesso!":
        return jsonify({"mensagem": mensagem}), 200

    elif mensagem == "Produto não encontrado":
        return jsonify({"mensagem": mensagem}), 404

    else:
        return jsonify({"mensagem": mensagem}), 400


# CADASTRO
@app.route("/api/cadastro", methods=["POST"])
def cadastrar_usuario():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos"}), 400

    mensagem = cadastroUsuario(
        dados.get("nome"),
        dados.get("email"),
        dados.get("senha"),
        dados.get("confirmarSenha")
    )

    if mensagem == "Usuario cadastrado com sucesso":
        return jsonify({"mensagem": mensagem}), 201

    return jsonify({"mensagem": mensagem}), 400



@app.route("/api/login", methods=["POST"])
def fazer_login():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos"}), 400

    resultado = loginUsuario(
        dados.get("email"),
        dados.get("senha")
    )

    if isinstance(resultado, str):
        return jsonify({"mensagem": resultado}), 401

    session.clear()
    session["usuario_id"] = resultado["id"]

    return jsonify({
        "mensagem": "Login realizado com sucesso",
        "usuario": resultado
    })



@app.route("/api/sessao")
def verificar_sessao():
    usuario_id = session.get("usuario_id")

    if usuario_id is None:
        return jsonify({"mensagem": "Não autenticado"}), 401

    with conexaoBanco() as conexao:
        usuario = conexao.execute(
            "SELECT id, nome, email FROM usuarios WHERE id = ?",
            (usuario_id,)
        ).fetchone()

    if usuario is None:
        session.clear()
        return jsonify({"mensagem": "Sessão inválida"}), 401

    return jsonify({"usuario": dict(usuario)})



@app.route("/api/logout", methods=["POST"])
def fazer_logout():
    session.clear()
    return jsonify({"mensagem": "Logout realizado"})


@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    with conexaoBanco() as conexao:
        produtos = conexao.execute(
            "SELECT COUNT(*) AS total FROM produtos"
        ).fetchone()["total"]

        unidades = conexao.execute(
            """
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM produtos
            """
        ).fetchone()["total"]

        estoque_baixo = conexao.execute(
            """
            SELECT id, nome, quantidade
            FROM produtos
            WHERE quantidade <= 5
            ORDER BY quantidade ASC
            """
        ).fetchall()

        vendas_mes = conexao.execute(
            """
            SELECT
                COUNT(*) AS quantidade,
                COALESCE(SUM(total), 0) AS total
            FROM vendas
            WHERE status = 'Concluída'
              AND substr(data, 1, 7) = strftime('%Y-%m', 'now')
            """
        ).fetchone()

        vendas_recentes = conexao.execute(
            """
            SELECT id, produto, total
            FROM vendas
            WHERE status = 'Concluída'
            ORDER BY data DESC, id DESC
            LIMIT 5
            """
        ).fetchall()

        grafico = conexao.execute(
            """
            SELECT
                substr(data, 1, 7) AS mes,
                SUM(total) AS total
            FROM vendas
            WHERE status = 'Concluída'
            GROUP BY substr(data, 1, 7)
            ORDER BY mes DESC
            LIMIT 6
            """
        ).fetchall()

    return jsonify({
        "total_produtos": produtos,
        "unidades_em_estoque": unidades,
        "estoque_baixo": [
            dict(p) for p in estoque_baixo
        ],
        "vendas_mes": dict(vendas_mes),
        "vendas_recentes": [
            dict(v) for v in vendas_recentes
        ],
        "grafico": [
            {
                "mes": item["mes"],
                "total": item["total"]
            }
            for item in reversed(grafico)
        ]
    })


# ==========================================
# VENDAS - ANVELLIS
# ==========================================

from banco import agoraUTC, avisarEstoqueBaixo


# LISTAR VENDAS
@app.route("/api/vendas", methods=["GET"])
def listar_vendas():
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    with conexaoBanco() as conexao:
        vendas = conexao.execute("""
            SELECT *
            FROM vendas
            ORDER BY data DESC, id DESC
        """).fetchall()

    return jsonify([dict(venda) for venda in vendas])


# CADASTRAR VENDA
@app.route("/api/vendas", methods=["POST"])
def cadastrar_venda():
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos"}), 400

    cliente = dados.get("cliente")
    produto_id = dados.get("produto_id")
    quantidade = dados.get("quantidade")
    valor_unitario = dados.get("valor_unitario")
    pagamento = dados.get("pagamento")

    if not isinstance(cliente, str) or not cliente.strip():
        return jsonify({"mensagem": "Informe o cliente"}), 400

    if type(produto_id) is not int or produto_id <= 0:
        return jsonify({"mensagem": "Produto inválido"}), 400

    if type(quantidade) is not int or quantidade <= 0:
        return jsonify({"mensagem": "Quantidade inválida"}), 400

    if type(valor_unitario) not in (int, float):
        return jsonify({"mensagem": "Valor inválido"}), 400

    if not 0 < valor_unitario < float("inf"):
        return jsonify({"mensagem": "Valor inválido"}), 400

    if not isinstance(pagamento, str) or not pagamento.strip():
        return jsonify({"mensagem": "Informe o pagamento"}), 400

    with conexaoBanco() as conexao:

        produto = conexao.execute("""
            SELECT id, nome, quantidade
            FROM produtos
            WHERE id = ?
        """, (produto_id,)).fetchone()

        if produto is None:
            return jsonify({
                "mensagem": "Produto não encontrado"
            }), 404

        if produto["quantidade"] < quantidade:
            return jsonify({
                "mensagem": "Estoque insuficiente"
            }), 400

        quantidade_anterior = produto["quantidade"]
        quantidade_nova = quantidade_anterior - quantidade

        # Descontar estoque
        conexao.execute("""
            UPDATE produtos
            SET quantidade = ?
            WHERE id = ?
        """, (quantidade_nova, produto_id))

        # Calcular total
        total = round(quantidade * valor_unitario, 2)

        # Registrar venda
        cursor = conexao.execute("""
            INSERT INTO vendas (
                cliente,
                produto_id,
                produto,
                quantidade,
                valor_unitario,
                total,
                pagamento,
                status,
                data
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            cliente.strip(),
            produto_id,
            produto["nome"],
            quantidade,
            valor_unitario,
            total,
            pagamento.strip(),
            "Concluída",
            agoraUTC()
        ))

        venda_id = cursor.lastrowid

        # Histórico do estoque
        conexao.execute("""
            INSERT INTO movimentos_estoque (
                produto_id,
                produto,
                quantidade_anterior,
                quantidade_nova,
                motivo,
                criado_em
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            produto_id,
            produto["nome"],
            quantidade_anterior,
            quantidade_nova,
            "Venda realizada",
            agoraUTC()
        ))

        # Aviso de estoque baixo
        avisarEstoqueBaixo(
            conexao,
            produto["nome"],
            quantidade_nova
        )

    return jsonify({
        "id": venda_id,
        "mensagem": "Venda realizada com sucesso",
        "total": total
    }), 201


# CANCELAR VENDA
@app.route("/api/vendas/<int:id>/cancelar", methods=["POST"])
def cancelar_venda(id):
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    with conexaoBanco() as conexao:

        venda = conexao.execute("""
            SELECT *
            FROM vendas
            WHERE id = ?
        """, (id,)).fetchone()

        if venda is None:
            return jsonify({
                "mensagem": "Venda não encontrada"
            }), 404

        if venda["status"] == "Cancelada":
            return jsonify({
                "mensagem": "Venda já cancelada"
            }), 400

        produto = conexao.execute("""
            SELECT *
            FROM produtos
            WHERE id = ?
        """, (venda["produto_id"],)).fetchone()

        if produto is None:
            return jsonify({
                "mensagem": "Produto não encontrado. "
                            "Não foi possível devolver ao estoque."
            }), 409

        quantidade_anterior = produto["quantidade"]
        quantidade_nova = (
            quantidade_anterior + venda["quantidade"]
        )

        # Devolver produtos ao estoque
        conexao.execute("""
            UPDATE produtos
            SET quantidade = ?
            WHERE id = ?
        """, (
            quantidade_nova,
            venda["produto_id"]
        ))

        # Registrar movimentação
        conexao.execute("""
            INSERT INTO movimentos_estoque (
                produto_id,
                produto,
                quantidade_anterior,
                quantidade_nova,
                motivo,
                criado_em
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            venda["produto_id"],
            produto["nome"],
            quantidade_anterior,
            quantidade_nova,
            "Cancelamento de venda",
            agoraUTC()
        ))

        # Atualizar status da venda
        conexao.execute("""
            UPDATE vendas
            SET status = 'Cancelada'
            WHERE id = ?
        """, (id,))

    return jsonify({
        "mensagem": "Venda cancelada com sucesso"
    }), 200


@app.route("/api/estoque/ajustar", methods=["POST"])
def ajustar_estoque():
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos"}), 400

    produto_id = dados.get("produto_id")
    quantidade = dados.get("quantidade")
    tipo = dados.get("tipo","ajuste")
    motivo = dados.get("motivo", "")

    if type(produto_id) is not int or produto_id <= 0:
        return jsonify({"mensagem": "Produto inválido"}), 400

    if type(quantidade) is not int or quantidade < 0:
        return jsonify({"mensagem": "Quantidade inválida"}), 400

    if tipo not in ("entrada", "saida", "ajuste"):
        return jsonify({"mensagem": "Tipo de ajuste inválido"}), 400

    if not isinstance(motivo, str):
        return jsonify({"mensagem": "Motivo inválido"}), 400

    with conexaoBanco() as conexao:
        produto = conexao.execute(
            "SELECT id, nome, quantidade FROM produtos WHERE id = ?",
            (produto_id,)
        ).fetchone()

        if produto is None:
            return jsonify({"mensagem": "Produto não encontrado"}), 404

        anterior = produto["quantidade"]

        if tipo == "entrada":
            nova = anterior + quantidade
        elif tipo == "saida":
            nova = anterior - quantidade
        else:
            nova = quantidade

        if nova < 0:
            return jsonify({"mensagem": "Estoque insuficiente"}), 400

        conexao.execute(
            "UPDATE produtos SET quantidade = ? WHERE id = ?",
            (nova, produto_id)
        )

        conexao.execute("""
            INSERT INTO movimentos_estoque (
                produto_id,
                produto,
                quantidade_anterior,
                quantidade_nova,
                motivo,
                criado_em
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            produto_id,
            produto["nome"],
            anterior,
            nova,
            motivo.strip() or tipo,
            agoraUTC()
        ))

        if nova < anterior:
            avisarEstoqueBaixo(conexao, produto["nome"], nova)

    return jsonify({
        "mensagem": "Estoque atualizado com sucesso",
        "quantidade_anterior": anterior,
        "quantidade_nova": nova
    }), 200


@app.route("/api/notificacoes", methods=["GET"])
def listar_notificacoes():
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    with conexaoBanco() as conexao:
        notificacoes = conexao.execute("""
            SELECT
                id,
                titulo,
                texto,
                lida,
                criada_em
            FROM notificacoes
            ORDER BY criada_em DESC, id DESC
            LIMIT 50
        """).fetchall()

    resultado = []

    for notificacao in notificacoes:
        resultado.append({
            "id": notificacao["id"],
            "titulo": notificacao["titulo"],
            "texto": notificacao["texto"],
            "lida": bool(notificacao["lida"]),
            "criada_em": notificacao["criada_em"]
        })

    return jsonify(resultado)


@app.route("/api/notificacoes/marcar-lidas", methods=["POST"])
def marcar_notificacoes_lidas():
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    with conexaoBanco() as conexao:
        cursor = conexao.execute("""
            UPDATE notificacoes
            SET lida = 1
            WHERE lida = 0
        """)

        quantidade = cursor.rowcount

    return jsonify({
        "mensagem": "Notificações marcadas como lidas",
        "quantidade": quantidade
    }), 200


# ==========================================
# CONFIGURAÇÕES - ANVELLIS
# ==========================================

@app.route("/api/configuracoes", methods=["GET"])
def obter_configuracoes():
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    with conexaoBanco() as conexao:
        config = conexao.execute("""
            SELECT nome_loja, email, avisos_email, alerta_estoque
            FROM configuracoes
            WHERE id = 1
        """).fetchone()

    if config is None:
        return jsonify({"mensagem": "Configurações não encontradas"}), 404

    return jsonify({
        "nome_loja": config["nome_loja"],
        "email": config["email"],
        "avisos_email": bool(config["avisos_email"]),
        "alerta_estoque": bool(config["alerta_estoque"])
    })


@app.route("/api/configuracoes", methods=["PUT"])
def salvar_configuracoes():
    if "usuario_id" not in session:
        return jsonify({"mensagem": "Não autenticado"}), 401

    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos"}), 400

    nome_loja = dados.get("nome_loja")
    email = dados.get("email")
    avisos_email = dados.get("avisos_email")
    alerta_estoque = dados.get("alerta_estoque")

    if not isinstance(nome_loja, str) or not nome_loja.strip():
        return jsonify({"mensagem": "Informe o nome da loja"}), 400

    if not isinstance(email, str) or "@" not in email:
        return jsonify({"mensagem": "E-mail inválido"}), 400

    if not isinstance(avisos_email, bool):
        return jsonify({"mensagem": "Opção de avisos inválida"}), 400

    if not isinstance(alerta_estoque, bool):
        return jsonify({"mensagem": "Opção de estoque inválida"}), 400

    with conexaoBanco() as conexao:
        conexao.execute("""
            UPDATE configuracoes
            SET nome_loja = ?,
                email = ?,
                avisos_email = ?,
                alerta_estoque = ?
            WHERE id = 1
        """, (
            nome_loja.strip(),
            email.strip(),
            int(avisos_email),
            int(alerta_estoque)
        ))

    return jsonify({
        "mensagem": "Configurações salvas com sucesso"
    }), 200


# ==========================================
# RECUPERAÇÃO DE SENHA - ANVELLIS
# ==========================================

# Configuração dos tokens
assinador = URLSafeTimedSerializer(app.secret_key)


def assinaturaSenha(senha_hash):
    return hashlib.sha256(
        senha_hash.encode("utf-8")
    ).hexdigest()


# Enviar e-mail de recuperação
def enviarEmailRecuperacao(destinatario, link):
    remetente = os.environ["SMTP_EMAIL"]
    senha_app = os.environ["SMTP_PASSWORD"]

    mensagem = EmailMessage()
    mensagem["Subject"] = "Anvellis - Recuperação de senha"
    mensagem["From"] = remetente
    mensagem["To"] = destinatario

    mensagem.set_content(
        "Olá!\n\n"
        "Recebemos uma solicitação de recuperação de senha.\n\n"
        "Acesse o link abaixo para criar uma nova senha:\n"
        f"{link}\n\n"
        "O link expira em 15 minutos.\n\n"
        "Se você não solicitou isso, ignore este e-mail."
    )

    with smtplib.SMTP_SSL(
        "smtp.gmail.com", 465, timeout=15
    ) as servidor:
        servidor.login(remetente, senha_app)
        servidor.send_message(mensagem)


# ==========================================
# SOLICITAR RECUPERAÇÃO DE SENHA
# ==========================================

@app.route("/api/recuperar-senha", methods=["POST"])
def recuperar_senha():
    dados = request.get_json(silent=True) or {}

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos"}), 400

    email = dados.get("email")

    if not isinstance(email, str) or "@" not in email:
        return jsonify({"mensagem": "E-mail inválido"}), 400

    email = email.strip().lower()

    with conexaoBanco() as conexao:
        usuario = conexao.execute(
            "SELECT id, senha FROM usuarios WHERE email = ?",
            (email,)
        ).fetchone()

    resposta = {
        "mensagem": (
            "Se o e-mail estiver cadastrado, "
            "você receberá um link de recuperação."
        )
    }

    if usuario is None:
        return jsonify(resposta), 200

    token = assinador.dumps(
        {
            "id": usuario["id"],
            "senha": assinaturaSenha(usuario["senha"])
        },
        salt="recuperacao-senha"
    )

    link = (
        "http://127.0.0.1:5500/FRONTEND/redefinir-senha.html"
        f"?token={token}"
    )

    try:
        enviarEmailRecuperacao(email, link)

    except (OSError, smtplib.SMTPException, KeyError):
        app.logger.exception("Falha ao enviar e-mail")

        return jsonify({
            "mensagem": "Não foi possível enviar o e-mail agora."
        }), 503

    return jsonify(resposta), 200


# ==========================================
# REDEFINIR SENHA
# ==========================================

@app.route("/api/redefinir-senha", methods=["POST"])
def redefinir_senha():
    dados = request.get_json(silent=True) or {}

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos"}), 400

    token = dados.get("token")
    nova_senha = dados.get("senha")

    if not isinstance(token, str) or not token:
        return jsonify({"mensagem": "Link inválido"}), 400

    if not isinstance(nova_senha, str) or len(nova_senha) < 6:
        return jsonify({
            "mensagem": "A senha deve ter pelo menos 6 caracteres"
        }), 400

    try:
        payload = assinador.loads(
            token,
            salt="recuperacao-senha",
            max_age=900
        )

    except (BadSignature, SignatureExpired):
        return jsonify({
            "mensagem": "Link inválido ou expirado"
        }), 400

    if not isinstance(payload, dict):
        return jsonify({"mensagem": "Link inválido"}), 400

    usuario_id = payload.get("id")
    assinatura = payload.get("senha")

    if type(usuario_id) is not int or not isinstance(assinatura, str):
        return jsonify({"mensagem": "Link inválido"}), 400

    with conexaoBanco() as conexao:
        usuario = conexao.execute(
            "SELECT senha FROM usuarios WHERE id = ?",
            (usuario_id,)
        ).fetchone()

        if (
            usuario is None
            or assinaturaSenha(usuario["senha"]) != assinatura
        ):
            return jsonify({
                "mensagem": "Este link não é mais válido"
            }), 400

        conexao.execute(
            "UPDATE usuarios SET senha = ? WHERE id = ?",
            (
                generate_password_hash(nova_senha),
                usuario_id
            )
        )

    return jsonify({
        "mensagem": "Senha alterada com sucesso"
    }), 200



if __name__ == "__main__":
    app.run(debug=True)