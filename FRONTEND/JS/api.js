

"use strict";


const API = (() => {

  
  const noFlask =
    window.location.protocol.startsWith("http") &&
    window.location.port === "5000";

  const BASE =
    window.API_BASE ||
    (noFlask ? "" : "http://127.0.0.1:5000");

 

  function criarErro(status, mensagem, campos) {
    const erro = new Error(mensagem);
    erro.status = status;
    erro.campos = campos || null;
    return erro;
  }

  


  async function requisicao(metodo, caminho, corpo) {
    let resposta;

    try {
      resposta = await fetch(`${BASE}${caminho}`, {
        method: metodo,

        headers: {
          "Content-Type": "application/json"
        },

        body:
          corpo === undefined
            ? undefined
            : JSON.stringify(corpo),

        credentials: "include"
      });

    } catch (erro) {
      throw criarErro(
        0,
        "Não foi possível conectar ao servidor Flask."
      );
    }

    let dados = null;

    try {
      dados = await resposta.json();
    } catch (erro) {
      // A resposta pode não conter JSON.
    }

    if (!resposta.ok) {
      throw criarErro(
        resposta.status,
        (dados && (dados.erro || dados.mensagem)) ||
          "O servidor retornou um erro.",
        dados && dados.campos
      );
    }

    return dados;
  }

 

  const get = (caminho) =>
    requisicao("GET", caminho);

  const post = (caminho, corpo = {}) =>
    requisicao("POST", caminho, corpo);

  const put = (caminho, corpo) =>
    requisicao("PUT", caminho, corpo);

  const del = (caminho) =>
    requisicao("DELETE", caminho);

  

  return {

    
    sessao: () =>
      get("/api/sessao"),

    login: (email, senha, lembrar) =>
      post("/api/login", {
        email,
        senha,
        lembrar
      }),

    cadastro: ({ nome, email, senha }) =>
      post("/api/cadastro", {
        nome,
        email,
        senha,
        confirmarSenha: senha
      }),

    recuperarSenha: (email) =>
      post("/api/recuperar-senha", {
        email
      }),

    logout: () =>
      post("/api/logout"),

    

    configuracoes: {

      obter: () =>
        get("/api/configuracoes"),

      salvar: (dados) =>
        put("/api/configuracoes", dados)

    },

    

    produtos: {

     
      listar: async () => {
        const produtos = await get("/produtos");

        return produtos.map((produto) => ({
          ...produto,

         
          valor: produto.preco
        }));
      },

      
      criar: (dados) =>
        post("/produtos", {
          nome: dados.nome,
          preco: dados.valor,

          
          quantidade: 1
        }),

      // Atualizar produto
      atualizar: (id, dados) =>
        put(`/produtos/${id}`, {
          nome: dados.nome,
          preco: dados.valor
        }),

    
      excluir: (id) =>
        del(`/produtos/${id}`)

    },

    

    estoque: {

      ajustar: (dados) =>
        post("/api/estoque/ajustar", dados)

    },

    

    vendas: {

      listar: () =>
        get("/api/vendas"),

      criar: (dados) =>
        post("/api/vendas", dados),

      cancelar: (id) =>
        post(`/api/vendas/${id}/cancelar`)

    },

    

    notificacoes: {

      listar: () =>
        get("/api/notificacoes"),

      marcarLidas: () =>
        post("/api/notificacoes/marcar-lidas")

    },

    
    dashboard: () =>
      get("/api/dashboard")

  };

})();
