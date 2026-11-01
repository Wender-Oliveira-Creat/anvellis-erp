
"use strict";

// ========================================
// ANVELLIS - CONTROLE DO FRONTEND
// ========================================

// Utilitários
const $ = (seletor, raiz = document) =>
  raiz.querySelector(seletor);

const $$ = (seletor, raiz = document) =>
  Array.from(raiz.querySelectorAll(seletor));

const formatarMoeda = (n) =>
  Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

function lerMoeda(texto) {
  let t = String(texto).replace(/[^\d,.-]/g, "");

  if (t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }

  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

const idProduto = (n) =>
  "#" + String(n).padStart(4, "0");

const idVenda = (n) =>
  "#V" + String(n).padStart(3, "0");

function dataBR(iso) {
  const [ano, mes, dia] =
    String(iso).slice(0, 10).split("-");

  return `${dia}/${mes}/${ano}`;
}

function tempoRelativo(iso) {
  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) return "";

  const minutos = Math.floor(
    (Date.now() - timestamp) / 60000
  );

  if (minutos < 1) return "Agora";
  if (minutos < 60) return `Há ${minutos} min`;

  const horas = Math.floor(minutos / 60);

  if (horas < 24) return `Há ${horas} h`;
  if (horas < 48) return "Ontem";

  return dataBR(new Date(timestamp).toISOString());
}

const normalizar = (t) =>
  String(t)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const plural = (n, singular, pluralTxt) =>
  `${n} ${n === 1 ? singular : pluralTxt}`;

const emailValido = (e) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ========================================
// NOTIFICAÇÕES VISUAIS
// ========================================

function avisar(mensagem) {
  const toast = $("#toast");

  if (!toast) {
    console.log(mensagem);
    return;
  }

  toast.textContent = mensagem;
  toast.hidden = false;

  clearTimeout(avisar.temporizador);

  avisar.temporizador = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

const LIMITE_ESTOQUE_BAIXO = 5;

function statusEstoque(quantidade) {
  if (quantidade === 0) {
    return {
      rotulo: "Sem estoque",
      variante: "perigo"
    };
  }

  if (quantidade <= LIMITE_ESTOQUE_BAIXO) {
    return {
      rotulo: "Estoque baixo",
      variante: "alerta"
    };
  }

  return {
    rotulo: "Disponível",
    variante: "sucesso"
  };
}

const VARIANTE_DA_VENDA = {
  "Concluída": "sucesso",
  Pendente: "alerta",
  Cancelada: "perigo"
};

let paginaAtual = null;

// ========================================
// PREENCHIMENTO DA INTERFACE
// ========================================

function preencher(raiz, textos) {
  if (!raiz) return;

  Object.entries(textos).forEach(([chave, texto]) => {
    $$(`[data-campo="${chave}"]`, raiz).forEach((el) => {
      el.textContent = texto ?? "";
    });
  });
}

function definirBadge(el, texto, variante) {
  if (!el) return;

  el.textContent = texto;
  el.className = `badge badge--${variante}`;
}

function desenharLista(destino, modelo, itens, preencherItem) {
  if (!destino || !modelo) return;

  destino.replaceChildren();

  itens.forEach((item) => {
    const no = modelo.content.firstElementChild.cloneNode(true);

    if (item.id !== undefined) {
      no.dataset.id = item.id;
    }

    preencherItem(no, item);
    destino.appendChild(no);
  });
}

function preencherSelect(select, opcoes) {
  if (!select) return;

  while (select.options.length > 1) {
    select.remove(1);
  }

  opcoes.forEach((o) => {
    const opcao = new Option(o.texto, o.valor);
    opcao.disabled = Boolean(o.desabilitada);
    select.add(opcao);
  });
}

// ========================================
// ESTADOS DE CARREGAMENTO
// ========================================

function mostrarEstado(estado) {
  const carregando = $("#estado-carregando");
  const erro = $("#estado-erro");
  const conteudo = $("#area-conteudo");

  if (carregando) {
    carregando.hidden = estado !== "carregando";
  }

  if (erro) {
    erro.hidden = estado !== "erro";
  }

  if (conteudo) {
    conteudo.hidden = estado !== "pronto";
  }
}

function mostrarErroDaPagina(erro, tentarNovamente) {
  preencher($("#estado-erro"), {
    titulo:
      erro.status === 0
        ? "Não foi possível conectar ao servidor"
        : "Não foi possível carregar os dados",
    mensagem: erro.message
  });

  const botao = $("#btn-tentar-novamente");

  if (botao) {
    botao.onclick = tentarNovamente;
  }

  mostrarEstado("erro");
}

function mostrarTelaErro(erro) {
  const app = $(".app");

  if (app) app.hidden = true;

  preencher($("#tela-erro"), {
    titulo:
      erro.status === 0
        ? "Não foi possível conectar ao servidor"
        : "O servidor retornou um erro",
    mensagem: erro.message
  });

  const tela = $("#tela-erro");

  if (tela) tela.hidden = false;

  const botao = $("#btn-recarregar");

  if (botao) {
    botao.onclick = () => window.location.reload();
  }
}

// ========================================
// CONTROLE DE MODAIS
// ========================================

let modalAberto = null;
let abrindo = false;

async function abrirModal(id, contexto = {}) {
  const overlay = document.getElementById(id);

  if (!overlay || abrindo) return;

  const form = $("form", overlay);

  if (!form) return;

  abrindo = true;

  try {
    form.reset();
    limparErros(form);

    const alerta = $(".modal__alerta", form);

    if (alerta) alerta.hidden = true;

    delete form.dataset.id;

    if (GANCHOS[id]) {
      await GANCHOS[id](form, contexto);
    }
  } catch (erro) {
    avisar(erro.message);
    return;
  } finally {
    abrindo = false;
  }

  const anterior = modalAberto
    ? modalAberto.anterior
    : document.activeElement;

  if (modalAberto) {
    esconderModal(modalAberto);
  }

  function aoTeclar(evento) {
    if (evento.key === "Escape") {
      fecharModal();
      return;
    }

    if (evento.key !== "Tab") return;

    const focaveis = $$(
      "button, input, select, textarea, a[href]",
      form
    ).filter((el) =>
      !el.disabled &&
      !el.readOnly &&
      !el.hidden
    );

    if (!focaveis.length) return;

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    if (
      evento.shiftKey &&
      document.activeElement === primeiro
    ) {
      evento.preventDefault();
      ultimo.focus();
    } else if (
      !evento.shiftKey &&
      document.activeElement === ultimo
    ) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  overlay.hidden = false;
  document.body.classList.add("modal-aberto");

  document.addEventListener("keydown", aoTeclar);

  modalAberto = {
    overlay,
    form,
    anterior,
    aoTeclar
  };

  const alvo = form.hasAttribute("data-foco-cancelar")
    ? $("[data-fechar]", form)
    : $(
        "input:not([readonly]):not([type=checkbox]), select",
        form
      ) ||
      $("[type=submit]", form) ||
      $("button", form);

  if (alvo) alvo.focus();
}

function esconderModal(modal) {
  modal.overlay.hidden = true;

  document.removeEventListener(
    "keydown",
    modal.aoTeclar
  );
}

function fecharModal() {
  if (!modalAberto) return;

  const modal = modalAberto;
  modalAberto = null;

  esconderModal(modal);

  document.body.classList.remove("modal-aberto");

  if (
    modal.anterior &&
    document.contains(modal.anterior) &&
    modal.anterior.focus
  ) {
    modal.anterior.focus();
  }

  const destino = modal.form.dataset.aoFechar;

  if (destino) {
    window.location.href = destino;
  }
}

// ========================================
// EVENTOS GERAIS
// ========================================

document.addEventListener("click", (evento) => {
  const alvo = evento.target;

  if (!(alvo instanceof Element)) return;

  const abrir = alvo.closest("[data-abrir]");

  if (abrir) {
    const dono = abrir.closest("[data-id]");

    const id = dono
      ? Number(dono.dataset.id)
      : undefined;

    const itens =
      paginaAtual && paginaAtual.estado
        ? paginaAtual.estado.itens
        : [];

    abrirModal(abrir.dataset.abrir, {
      id,
      item: itens.find((i) => i.id === id),
      gatilho: abrir
    });

    return;
  }

  if (alvo.closest("[data-fechar]")) {
    fecharModal();
    return;
  }

  const clique = alvo.closest("[data-clique]");

  if (clique && CLIQUES[clique.dataset.clique]) {
    CLIQUES[clique.dataset.clique](clique);
  }
});

document.addEventListener("mousedown", (evento) => {
  if (
    evento.target.classList &&
    evento.target.classList.contains("modal-overlay")
  ) {
    fecharModal();
  }
});

document.addEventListener("keydown", (evento) => {
  if (
    (evento.key === "Enter" || evento.key === " ") &&
    evento.target.matches &&
    evento.target.matches("tr[data-abrir]")
  ) {
    evento.preventDefault();
    evento.target.click();
  }
});

// ========================================
// VALIDAÇÃO DE FORMULÁRIOS
// ========================================

function mensagemDeErro(el, form) {
  if (
    !el.name ||
    el.readOnly ||
    el.disabled ||
    el.type === "checkbox" ||
    el.type === "submit" ||
    el.type === "button"
  ) {
    return null;
  }

  const msg = (chave) =>
    el.dataset[chave] || "Confira este campo.";

  const valor = el.value.trim();

  if (valor === "") {
    return el.required
      ? msg("msgObrigatorio")
      : null;
  }

  if (el.minLength > 0 && valor.length < el.minLength) {
    return msg("msgMinimo");
  }

  if (el.type === "email" && !emailValido(valor)) {
    return msg("msgEmail");
  }

  if (el.dataset.tipo === "moeda") {
    const n = lerMoeda(valor);

    const minimo =
      el.dataset.moedaMin !== undefined
        ? Number(el.dataset.moedaMin)
        : 0.01;

    if (!Number.isFinite(n) || n < minimo) {
      return msg("msgMoeda");
    }
  }

  if (el.type === "number") {
    const n = Number(valor);

    if (
      !Number.isFinite(n) ||
      (el.step === "1" && !Number.isInteger(n)) ||
      (el.min !== "" && n < Number(el.min))
    ) {
      return msg("msgNumero");
    }

    if (el.max !== "" && n > Number(el.max)) {
      return msg("msgMax").replace("{max}", el.max);
    }
  }

  if (
    el.dataset.igualA &&
    el.value !== form.elements[el.dataset.igualA].value
  ) {
    return msg("msgIgual");
  }

  if (el.dataset.maiorOuIgualA) {
    const outro =
      form.elements[el.dataset.maiorOuIgualA];

    if (outro && outro.value.trim() !== "") {
      const comparavel = (campo, v) =>
        campo.dataset.tipo === "moeda"
          ? lerMoeda(v)
          : v;

      if (
        comparavel(el, valor) <
        comparavel(outro, outro.value.trim())
      ) {
        return msg("msgMaiorOuIgual");
      }
    }
  }

  return null;
}

function marcarErro(el, mensagem) {
  const caixa = el.closest(".campo");

  if (!caixa) return;

  caixa.classList.add("campo--erro");
  el.setAttribute("aria-invalid", "true");

  const erro = $(".campo__erro", caixa);

  if (erro) {
    erro.textContent = mensagem;
    erro.hidden = false;
  }
}

function limparErros(form) {
  $$(".campo--erro", form).forEach((c) =>
    c.classList.remove("campo--erro")
  );

  $$("[aria-invalid]", form).forEach((el) =>
    el.removeAttribute("aria-invalid")
  );

  $$(".campo__erro", form).forEach((p) => {
    p.hidden = true;
    p.textContent = "";
  });
}

function validarFormulario(form) {
  limparErros(form);

  let primeiro = null;

  Array.from(form.elements).forEach((el) => {
    const mensagem = mensagemDeErro(el, form);

    if (mensagem) {
      marcarErro(el, mensagem);
      primeiro = primeiro || el;
    }
  });

  if (primeiro) primeiro.focus();

  return !primeiro;
}

function tratarErro(form, erro) {
  let primeiro = null;

  Object.entries(erro.campos || {}).forEach(
    ([nome, mensagem]) => {
      const el = form.elements[nome];

      if (el && el.closest) {
        marcarErro(el, mensagem);
        primeiro = primeiro || el;
      }
    }
  );

  if (primeiro) {
    primeiro.focus();
    return;
  }

  const alerta = $(".modal__alerta", form);

  if (alerta) {
    alerta.textContent =
      erro.message || "Algo deu errado. Tente novamente.";

    alerta.hidden = false;
  } else {
    avisar(erro.message);
  }
}

function limparErroDoCampo(evento) {
  const caixa =
    evento.target.closest &&
    evento.target.closest(".campo--erro");

  if (!caixa) return;

  caixa.classList.remove("campo--erro");
  evento.target.removeAttribute("aria-invalid");

  const erro = $(".campo__erro", caixa);

  if (erro) {
    erro.hidden = true;
    erro.textContent = "";
  }
}

document.addEventListener(
  "input",
  limparErroDoCampo
);

document.addEventListener(
  "change",
  limparErroDoCampo
);

document.addEventListener("focusout", (evento) => {
  const el = evento.target;

  if (
    !el.matches ||
    !el.matches('input[data-tipo="moeda"]')
  ) {
    return;
  }

  const n = lerMoeda(el.value);

  if (Number.isFinite(n) && n >= 0) {
    el.value = formatarMoeda(n);
  }
});

// ========================================
// ENVIO DE FORMULÁRIOS
// ========================================

function definirOcupado(form, sim) {
  form.dataset.ocupado = sim ? "sim" : "";
  form.setAttribute("aria-busy", String(sim));

  $$("button", form).forEach((b) => {
    b.disabled = sim;
  });

  const enviar = $("[type=submit]", form);

  if (!enviar) return;

  if (sim) {
    enviar.dataset.texto = enviar.textContent;

    enviar.textContent =
      enviar.dataset.textoOcupado || "Aguarde…";
  } else if (enviar.dataset.texto) {
    enviar.textContent = enviar.dataset.texto;
  }
}

async function enviarFormulario(form) {
  const acao = ACOES[form.dataset.acao];

  if (!acao || form.dataset.ocupado === "sim") {
    return;
  }

  if (!validarFormulario(form)) return;

  const alerta = $(".modal__alerta", form);

  if (alerta) alerta.hidden = true;

  const modalDoEnvio = modalAberto;

  definirOcupado(form, true);

  let resultado;

  try {
    resultado = await acao(form);
  } catch (erro) {
    tratarErro(form, erro);
    resultado = false;
  }

  if (resultado === "navegando") return;

  definirOcupado(form, false);

  if (resultado === false) return;

  if (
    form.closest(".modal-overlay") &&
    modalAberto === modalDoEnvio
  ) {
    fecharModal();
  }
}

document.addEventListener("submit", (evento) => {
  if (!evento.target.matches("form[data-acao]")) {
    return;
  }

  evento.preventDefault();
  enviarFormulario(evento.target);
});

function mostrarErroDeServidor(erro) {
  abrirModal("modal-erro-servidor", { erro });
}

// ========================================
// AÇÕES DOS FORMULÁRIOS
// ========================================

const ACOES = {
  async login(form) {
    try {
      await API.login(
        form.elements.email.value.trim().toLowerCase(),
        form.elements.senha.value,
        form.elements.lembrar?.checked || false
      );

      window.location.href = "dashboard.html";
      return "navegando";
    } catch (erro) {
      if (erro.status === 401) {
        abrirModal("modal-erro-login");
      } else {
        mostrarErroDeServidor(erro);
      }

      return false;
    }
  },

  async cadastro(form) {
    try {
      await API.cadastro({
        nome: form.elements.nome.value.trim(),
        email:
          form.elements.email.value.trim().toLowerCase(),
        senha: form.elements.senha.value
      });

      abrirModal("modal-conta-criada");
      return "navegando";
    } catch (erro) {
      if (erro.status === 0 || erro.status >= 500) {
        mostrarErroDeServidor(erro);
      } else {
        tratarErro(form, erro);
      }

      return false;
    }
  },

  async "recuperar-senha"(form) {
    await API.recuperarSenha(
      form.elements.email.value.trim()
    );

    avisar(
      "Se o e-mail estiver cadastrado, você receberá o link em instantes."
    );
  },

  async "salvar-configuracoes"(form) {
    await API.configuracoes.salvar({
      nome_loja:
        form.elements.nome_loja.value.trim(),
      email: form.elements.email.value.trim(),
      avisos_email:
        form.elements.avisos_email.checked,
      alerta_estoque:
        form.elements.alerta_estoque.checked
    });

    avisar("Configurações salvas.");
  },

  async sair() {
    await API.logout();

    window.location.href = "index.html";
    return "navegando";
  },

  // ====================================
  // CRUD DE PRODUTOS
  // ====================================

  async "salvar-produto-novo"(form) {
    const dados = {
      nome: form.elements.nome.value.trim(),
      valor: lerMoeda(form.elements.valor.value)
    };

    await API.produtos.criar(dados);

    avisar("Produto cadastrado com sucesso!");
    paginaAtual.recarregar();
  },

  async "salvar-produto-editado"(form) {
    const id = Number(form.dataset.id);

    const dados = {
      nome: form.elements.nome.value.trim(),
      valor: lerMoeda(form.elements.valor.value)
    };

    await API.produtos.atualizar(id, dados);

    avisar("Produto atualizado com sucesso!");
    paginaAtual.recarregar();
  },

  async "excluir-produto"(form) {
    const id = Number(form.dataset.id);

    await API.produtos.excluir(id);

    avisar("Produto excluído com sucesso!");
    paginaAtual.recarregar();
  },

  "aplicar-filtros-produtos"(form) {
    paginaAtual.estado.filtros = {
      nome: form.elements.nome.value.trim(),
      min: form.elements.min.value.trim(),
      max: form.elements.max.value.trim()
    };

    paginaAtual.desenhar();
  },

  // ====================================
  // ESTOQUE
  // ====================================

  async "salvar-estoque-novo"(form) {
    await API.estoque.ajustar({
      produto_id:
        Number(form.elements.produto_id.value),
      quantidade:
        Number(form.elements.quantidade.value)
    });

    avisar("Estoque atualizado.");
    paginaAtual.recarregar();
  },

  async "salvar-estoque-editado"(form) {
    await API.estoque.ajustar({
      produto_id: Number(form.dataset.id),
      quantidade:
        Number(form.elements.quantidade.value),
      motivo: form.elements.motivo.value.trim()
    });

    avisar("Estoque atualizado.");
    paginaAtual.recarregar();
  },

  "aplicar-filtros-estoque"(form) {
    paginaAtual.estado.filtros = {
      nome: form.elements.nome.value.trim(),
      status: marcados(form, "status")
    };

    paginaAtual.desenhar();
  },

  // ====================================
  // VENDAS
  // ====================================

  async "salvar-venda-nova"(form) {
    const venda = await API.vendas.criar({
      cliente: form.elements.cliente.value.trim(),
      produto_id:
        Number(form.elements.produto_id.value),
      quantidade:
        Number(form.elements.quantidade.value),
      valor_unitario:
        lerMoeda(form.elements.valor_unitario.value),
      pagamento: form.elements.pagamento.value
    });

    avisar(
      `Venda ${idVenda(venda.id)} finalizada.`
    );

    paginaAtual.recarregar();
  },

  async "cancelar-venda"(form) {
    const id = Number(form.dataset.id);

    await API.vendas.cancelar(id);

    avisar(`Venda ${idVenda(id)} cancelada.`);
    paginaAtual.recarregar();
  },

  "aplicar-filtros-vendas"(form) {
    paginaAtual.estado.filtros = {
      cliente: form.elements.cliente.value.trim(),
      de: form.elements.de.value,
      ate: form.elements.ate.value,
      status: marcados(form, "status")
    };

    paginaAtual.desenhar();
  }
};

const marcados = (form, nome) =>
  $$(`input[name="${nome}"]:checked`, form)
    .map((el) => el.value);

// ========================================
// AÇÕES DOS BOTÕES
// ========================================

const CLIQUES = {
  "limpar-filtros"() {
    paginaAtual.estado.filtros =
      paginaAtual.filtrosVazios();

    paginaAtual.desenhar();
    fecharModal();
  },

  async "marcar-lidas"(botao) {
    const form = botao.closest("form");

    try {
      await API.notificacoes.marcarLidas();
    } catch (erro) {
      tratarErro(form, erro);
      return;
    }

    $$(".notificacao", form).forEach((n) => {
      n.classList.remove("is-nao-lida");
    });

    preencher(form, {
      resumo: textoNovas(0)
    });

    atualizarSino();
  },

  "tentar-novamente-login"() {
    fecharModal();

    const form = $("#form-login");

    if (!form) return;

    const senha = form.elements.senha;

    senha.value = "";
    senha.focus();
  }
};

const textoNovas = (n) =>
  n === 0
    ? "Você não tem novas notificações."
    : `Você tem ${plural(
        n,
        "nova notificação",
        "novas notificações"
      )}.`;

let produtosDaVenda = [];

// ========================================
// PREENCHIMENTO DOS MODAIS
// ========================================

const GANCHOS = {
  async "modal-notificacoes"(form) {
    const lista = await API.notificacoes.listar();

    desenharLista(
      $("#notificacoes-lista"),
      $("#tpl-notificacao"),
      lista,
      (no, n) => {
        preencher(no, {
          titulo: n.titulo,
          texto: n.texto,
          hora: tempoRelativo(n.criada_em)
        });

        no.classList.toggle(
          "is-nao-lida",
          !n.lida
        );
      }
    );

    const vazio = $("#notificacoes-vazio");

    if (vazio) vazio.hidden = lista.length > 0;

    preencher(form, {
      resumo: textoNovas(
        lista.filter((n) => !n.lida).length
      )
    });
  },

  async "modal-configuracoes"(form) {
    const c = await API.configuracoes.obter();

    form.elements.nome_loja.value = c.nome_loja;
    form.elements.email.value = c.email;
    form.elements.avisos_email.checked =
      c.avisos_email;
    form.elements.alerta_estoque.checked =
      c.alerta_estoque;
  },

  "modal-produto-editar"(form, { item }) {
    if (!item) {
      throw new Error("Produto não encontrado.");
    }

    form.dataset.id = item.id;

    form.elements.nome.value = item.nome;
    form.elements.codigo.value =
      idProduto(item.id);
    form.elements.valor.value =
      formatarMoeda(item.valor);
  },

  "modal-produto-excluir"(form, { item }) {
    if (!item) {
      throw new Error("Produto não encontrado.");
    }

    form.dataset.id = item.id;

    preencher(form, {
      nome: item.nome,
      meta:
        `${idProduto(item.id)} · ` +
        formatarMoeda(item.valor)
    });
  },

  "modal-produto-filtrar"(form) {
    const f = paginaAtual.estado.filtros;

    form.elements.nome.value = f.nome;
    form.elements.min.value = f.min;
    form.elements.max.value = f.max;
  },

  "modal-estoque-adicionar"(form, { item }) {
    const produtos = paginaAtual.estado.itens;

    if (!produtos.length) {
      throw new Error(
        "Cadastre um produto antes de controlar o estoque."
      );
    }

    preencherSelect(
      form.elements.produto_id,
      produtos.map((p) => ({
        valor: p.id,
        texto: p.nome
      }))
    );

    if (item) {
      form.elements.produto_id.value = item.id;
      form.elements.atual.value = item.quantidade;
      form.elements.quantidade.value =
        item.quantidade;
    } else {
      form.elements.atual.value = 0;
    }
  },

  "modal-estoque-editar"(form, { item }) {
    if (!item) {
      throw new Error("Produto não encontrado.");
    }

    form.dataset.id = item.id;
    form.elements.produto.value = item.nome;
    form.elements.atual.value = item.quantidade;
    form.elements.quantidade.value =
      item.quantidade;
  },

  "modal-estoque-filtrar"(form) {
    const f = paginaAtual.estado.filtros;

    form.elements.nome.value = f.nome;

    $$('input[name="status"]', form).forEach(
      (el) => {
        el.checked = f.status.includes(el.value);
      }
    );
  },

  async "modal-venda-nova"(form) {
    produtosDaVenda = await API.produtos.listar();

    preencherSelect(
      form.elements.produto_id,
      produtosDaVenda.map((p) => ({
        valor: p.id,
        texto:
          p.quantidade > 0
            ? `${p.nome} — ${plural(
                p.quantidade,
                "unidade",
                "unidades"
              )}`
            : `${p.nome} — sem estoque`,
        desabilitada: p.quantidade === 0
      }))
    );

    form.elements.quantidade.max = "";

    const total = $("#venda-total");

    if (total) {
      total.textContent = formatarMoeda(0);
    }
  },

  "modal-venda-detalhes"(form, { item }) {
    if (!item) {
      throw new Error("Venda não encontrada.");
    }

    form.dataset.id = item.id;

    preencher(form, {
      titulo:
        `Detalhes da venda ${idVenda(item.id)}`,
      data: `Realizada em ${dataBR(item.data)}.`,
      cliente: item.cliente,
      produto: item.produto,
      quantidade: plural(
        item.quantidade,
        "un.",
        "un."
      ),
      pagamento: item.pagamento,
      total: formatarMoeda(item.total)
    });

    definirBadge(
      $('[data-campo="status"]', form),
      item.status,
      VARIANTE_DA_VENDA[item.status]
    );

    const podeCancelar =
      item.status !== "Cancelada";

    const cancelar = $("#btn-cancelar-venda");

    if (cancelar) {
      cancelar.hidden = !podeCancelar;
    }

    const fechar = $("#btn-fechar-detalhes");

    if (fechar) {
      fechar.className =
        `btn btn--${
          podeCancelar ? "secondary" : "primary"
        }`;
    }
  },

  "modal-venda-cancelar"(form, { item }) {
    if (!item) {
      throw new Error("Venda não encontrada.");
    }

    form.dataset.id = item.id;

    preencher(form, {
      id: idVenda(item.id)
    });
  },

  "modal-venda-filtrar"(form) {
    const f = paginaAtual.estado.filtros;

    form.elements.cliente.value = f.cliente;
    form.elements.de.value = f.de;
    form.elements.ate.value = f.ate;

    $$('input[name="status"]', form).forEach(
      (el) => {
        el.checked = f.status.includes(el.value);
      }
    );
  },

  "modal-recuperar-senha"(form) {
    const login = $("#form-login");

    if (login) {
      form.elements.email.value =
        login.elements.email.value.trim();
    }
  },

  "modal-erro-servidor"(form, { erro }) {
    preencher(form, {
      titulo:
        erro.status === 0
          ? "Sem conexão com o servidor"
          : "Erro no servidor",
      mensagem: erro.message
    });
  }
};

// ========================================
// SINO DE NOTIFICAÇÕES
// ========================================

async function atualizarSino() {
  const sino = $("#sino");

  if (!sino) return;

  try {
    const lista = await API.notificacoes.listar();

    const n = lista.filter(
      (x) => !x.lida
    ).length;

    const contador = $("#sino-contador");

    if (contador) {
      contador.hidden = n === 0;
      contador.textContent =
        n > 9 ? "9+" : String(n);
    }

    sino.setAttribute(
      "aria-label",
      n
        ? `Notificações (${plural(
            n,
            "nova",
            "novas"
          )})`
        : "Notificações"
    );
  } catch (erro) {
    // Notificações não impedem o uso da página.
  }
}

// ========================================
// DASHBOARD
// ========================================

function iniciarDashboard() {
  async function carregar(silencioso = false) {
    if (!silencioso) {
      mostrarEstado("carregando");
    }

    try {
      const dados = await API.dashboard();

      desenharDashboard(dados);
      mostrarEstado("pronto");
    } catch (erro) {
      mostrarErroDaPagina(
        erro,
        () => carregar()
      );
    }
  }

  paginaAtual = {
    recarregar() {
      carregar(true);
      atualizarSino();
    }
  };

  carregar();
}

function desenharDashboard(d) {
  const area = $("#area-conteudo");
  const baixos = d.estoque_baixo.length;

  preencher(area, {
    total_produtos: d.total_produtos,
    unidades_em_estoque:
      `${d.unidades_em_estoque} un.`,
    qtd_estoque_baixo:
      plural(baixos, "item", "itens"),
    dica_estoque_baixo:
      baixos ? "Requer atenção" : "Tudo em dia",
    vendas_mes_total:
      formatarMoeda(d.vendas_mes.total),
    vendas_mes_qtd:
      plural(
        d.vendas_mes.quantidade,
        "venda concluída",
        "vendas concluídas"
      )
  });

  const dica = $("#kpi-estoque-dica");

  if (dica) {
    dica.classList.toggle(
      "kpi__dica--alerta",
      baixos > 0
    );
  }

  const maior = Math.max(
    1,
    ...d.grafico.map((g) => g.total)
  );

  const grafico = $("#grafico");

  desenharLista(
    grafico,
    $("#tpl-barra"),
    d.grafico,
    (no, g) => {
      preencher(no, {
        mes: g.mes
      });

      const barra = $(".grafico__barra", no);

      if (barra) {
        barra.style.height =
          `${Math.max(
            6,
            Math.round((g.total / maior) * 190)
          )}px`;

        barra.title =
          `${g.mes}: ${formatarMoeda(g.total)}`;
      }
    }
  );

  const colunas = $$(".grafico__coluna", grafico);

  if (colunas.length) {
    colunas[colunas.length - 1].classList.add(
      "grafico__coluna--atual"
    );
  }

  if (grafico) {
    grafico.hidden = d.grafico.length === 0;
  }

  const graficoVazio = $("#grafico-vazio");

  if (graficoVazio) {
    graficoVazio.hidden = d.grafico.length > 0;
  }

  desenharLista(
    $("#lista-vendas-recentes"),
    $("#tpl-venda-recente"),
    d.vendas_recentes,
    (no, v) => {
      preencher(no, {
        produto: v.produto,
        total: formatarMoeda(v.total)
      });
    }
  );

  const vendasVazio = $("#vendas-recentes-vazio");

  if (vendasVazio) {
    vendasVazio.hidden =
      d.vendas_recentes.length > 0;
  }

  desenharLista(
    $("#lista-estoque-baixo"),
    $("#tpl-estoque-baixo"),
    d.estoque_baixo,
    (no, p) => {
      const s = statusEstoque(p.quantidade);

      preencher(no, {
        nome: p.nome
      });

      definirBadge(
        $('[data-campo="status"]', no),
        p.quantidade === 0
          ? s.rotulo
          : plural(p.quantidade, "un.", "un."),
        s.variante
      );
    }
  );

  const estoqueVazio = $("#estoque-baixo-vazio");

  if (estoqueVazio) {
    estoqueVazio.hidden =
      d.estoque_baixo.length > 0;
  }
}

// ========================================
// LISTAGENS
// ========================================

function iniciarListagem({
  carregarDados,
  filtrosVazios,
  passaNoFiltro,
  preencherLinha,
  contarFiltros
}) {
  const estado = {
    busca: "",
    filtros: filtrosVazios(),
    itens: []
  };

  function desenhar() {
    const busca = normalizar(estado.busca);

    const lista = estado.itens.filter((item) =>
      passaNoFiltro(
        item,
        estado.filtros,
        busca
      )
    );

    desenharLista(
      $("#tabela-corpo"),
      $("#tpl-linha"),
      lista,
      preencherLinha
    );

    const vazio = $("#estado-vazio");

    if (vazio) {
      vazio.hidden = lista.length > 0;
    }

    const quantos = contarFiltros(estado.filtros);
    const contador = $("#contador-filtros");

    if (contador) {
      contador.hidden = quantos === 0;
      contador.textContent = quantos;
    }
  }

  async function carregar(silencioso = false) {
    if (!silencioso) {
      mostrarEstado("carregando");
    }

    try {
      estado.itens = await carregarDados();

      desenhar();
      mostrarEstado("pronto");
    } catch (erro) {
      mostrarErroDaPagina(
        erro,
        () => carregar()
      );
    }
  }

  paginaAtual = {
    estado,
    desenhar,
    filtrosVazios,

    recarregar() {
      carregar(true);
      atualizarSino();
    }
  };

  const busca = $("#busca");

  if (busca) {
    busca.addEventListener("input", (evento) => {
      estado.busca = evento.target.value.trim();
      desenhar();
    });
  }

  carregar();
}

const contemTexto = (texto, busca) =>
  normalizar(texto).includes(busca);

// ========================================
// PRODUTOS
// ========================================

function iniciarProdutos() {
  iniciarListagem({
    carregarDados: () => API.produtos.listar(),

    filtrosVazios: () => ({
      nome: "",
      min: "",
      max: ""
    }),

    contarFiltros: (f) =>
      [f.nome, f.min, f.max].filter(
        (v) => v !== ""
      ).length,

    passaNoFiltro(p, f, busca) {
      if (
        busca &&
        !contemTexto(p.nome, busca) &&
        !idProduto(p.id).toLowerCase().includes(busca)
      ) {
        return false;
      }

      if (
        f.nome &&
        !contemTexto(p.nome, normalizar(f.nome))
      ) {
        return false;
      }

      if (
        f.min !== "" &&
        p.valor < lerMoeda(f.min)
      ) {
        return false;
      }

      if (
        f.max !== "" &&
        p.valor > lerMoeda(f.max)
      ) {
        return false;
      }

      return true;
    },

    preencherLinha(linha, p) {
      preencher(linha, {
        id: idProduto(p.id),
        nome: p.nome,
        valor: formatarMoeda(p.valor)
      });
    }
  });
}

// ========================================
// ESTOQUE
// ========================================

function iniciarEstoque() {
  iniciarListagem({
    carregarDados: () => API.produtos.listar(),

    filtrosVazios: () => ({
      nome: "",
      status: []
    }),

    contarFiltros: (f) =>
      (f.nome ? 1 : 0) +
      (f.status.length ? 1 : 0),

    passaNoFiltro(p, f, busca) {
      if (
        busca &&
        !contemTexto(p.nome, busca) &&
        !idProduto(p.id).toLowerCase().includes(busca)
      ) {
        return false;
      }

      if (
        f.nome &&
        !contemTexto(p.nome, normalizar(f.nome))
      ) {
        return false;
      }

      if (
        f.status.length &&
        !f.status.includes(
          statusEstoque(p.quantidade).rotulo
        )
      ) {
        return false;
      }

      return true;
    },

    preencherLinha(linha, p) {
      const s = statusEstoque(p.quantidade);

      preencher(linha, {
        id: idProduto(p.id),
        nome: p.nome,
        quantidade: plural(
          p.quantidade,
          "un.",
          "un."
        )
      });

      definirBadge(
        $('[data-campo="status"]', linha),
        s.rotulo,
        s.variante
      );
    }
  });

  const form = $("#modal-estoque-adicionar form");

  if (!form) return;

  form.elements.produto_id.addEventListener(
    "change",
    () => {
      const p = paginaAtual.estado.itens.find(
        (x) =>
          x.id === Number(
            form.elements.produto_id.value
          )
      );

      form.elements.atual.value =
        p ? p.quantidade : 0;

      form.elements.quantidade.value =
        p ? p.quantidade : "";
    }
  );
}

// ========================================
// VENDAS
// ========================================

function iniciarVendas() {
  iniciarListagem({
    carregarDados: () => API.vendas.listar(),

    filtrosVazios: () => ({
      cliente: "",
      de: "",
      ate: "",
      status: []
    }),

    contarFiltros: (f) =>
      [f.cliente, f.de, f.ate].filter(
        (v) => v !== ""
      ).length +
      (f.status.length ? 1 : 0),

    passaNoFiltro(v, f, busca) {
      if (
        busca &&
        ![
          idVenda(v.id),
          v.cliente,
          v.produto
        ].some((t) => contemTexto(t, busca))
      ) {
        return false;
      }

      if (
        f.cliente &&
        !contemTexto(
          v.cliente,
          normalizar(f.cliente)
        )
      ) {
        return false;
      }

      if (f.de && v.data < f.de) {
        return false;
      }

      if (f.ate && v.data > f.ate) {
        return false;
      }

      if (
        f.status.length &&
        !f.status.includes(v.status)
      ) {
        return false;
      }

      return true;
    },

    preencherLinha(linha, v) {
      preencher(linha, {
        id: idVenda(v.id),
        data: dataBR(v.data),
        cliente: v.cliente,
        produto: v.produto,
        total: formatarMoeda(v.total)
      });

      definirBadge(
        $('[data-campo="status"]', linha),
        v.status,
        VARIANTE_DA_VENDA[v.status]
      );
    }
  });
}

function ligarModalNovaVenda() {
  const form = $("#modal-venda-nova form");

  if (!form) return;

  const atualizarTotal = () => {
    const quantidade =
      Number(form.elements.quantidade.value);

    const valor = lerMoeda(
      form.elements.valor_unitario.value
    );

    const total = $("#venda-total");

    if (total) {
      total.textContent = formatarMoeda(
        quantidade > 0 && valor > 0
          ? quantidade * valor
          : 0
      );
    }
  };

  form.elements.produto_id.addEventListener(
    "change",
    () => {
      const p = produtosDaVenda.find(
        (x) =>
          x.id === Number(
            form.elements.produto_id.value
          )
      );

      form.elements.valor_unitario.value =
        p ? formatarMoeda(p.valor) : "";

      form.elements.quantidade.max =
        p ? p.quantidade : "";

      atualizarTotal();
    }
  );

  form.elements.quantidade.addEventListener(
    "input",
    atualizarTotal
  );

  form.elements.valor_unitario.addEventListener(
    "input",
    atualizarTotal
  );
}

// ========================================
// INICIALIZAÇÃO DAS PÁGINAS
// ========================================

const PAGINAS = {
  dashboard: iniciarDashboard,
  produtos: iniciarProdutos,
  estoque: iniciarEstoque,
  vendas: iniciarVendas
};

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const pagina = document.body.dataset.pagina;

    let usuario = null;
    let falhaDeConexao = null;

    try {
      const sessao = await API.sessao();
      usuario = sessao.usuario;
    } catch (erro) {
      if (erro.status !== 401) {
        falhaDeConexao = erro;
      }
    }

    if (
      pagina === "login" ||
      pagina === "cadastro"
    ) {
      if (usuario) {
        window.location.replace("dashboard.html");
      }

      return;
    }

    if (falhaDeConexao) {
      mostrarTelaErro(falhaDeConexao);
      return;
    }

    if (!usuario) {
      window.location.replace("index.html");
      return;
    }

    const primeiroNome =
      usuario.nome.split(" ")[0];

    preencher(document, {
      "usuario-nome": primeiroNome,
      "usuario-inicial":
        primeiroNome[0].toUpperCase()
    });

    ligarModalNovaVenda();
    atualizarSino();

    setInterval(() => {
      if (!document.hidden) {
        atualizarSino();
      }
    }, 60000);

    if (PAGINAS[pagina]) {
      PAGINAS[pagina]();
    }
  }
);
