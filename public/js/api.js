const API_BASE = "/api";

function obterToken() {
  return localStorage.getItem("lm_adv_token");
}

function obterUsuario() {
  const bruto = localStorage.getItem("lm_adv_usuario");
  return bruto ? JSON.parse(bruto) : null;
}

function salvarSessao(token, usuario) {
  localStorage.setItem("lm_adv_token", token);
  localStorage.setItem("lm_adv_usuario", JSON.stringify(usuario));
}

function encerrarSessao() {
  localStorage.removeItem("lm_adv_token");
  localStorage.removeItem("lm_adv_usuario");
  window.location.href = "/index.html";
}

function exigirLogin() {
  if (!obterToken()) {
    window.location.href = "/index.html";
  }
}

async function apiFetch(caminho, opcoes = {}) {
  const token = obterToken();
  const cabecalhos = { "Content-Type": "application/json", ...(opcoes.headers || {}) };
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  const resposta = await fetch(`${API_BASE}${caminho}`, { ...opcoes, headers: cabecalhos });

  if (resposta.status === 401) {
    encerrarSessao();
    throw new Error("Sessao expirada");
  }

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro || `Erro ${resposta.status}`);
  }
  return dados;
}

function montarMenu(paginaAtiva) {
  const usuario = obterUsuario();
  const itens = [
    { href: "/dashboard.html", rotulo: "Início", id: "dashboard" },
    { href: "/teses.html", rotulo: "Teses Jurídicas", id: "teses" },
    { href: "/casos.html", rotulo: "Casos e Petições", id: "casos" },
    { href: "/jurimetria.html", rotulo: "Jurimetria", id: "jurimetria" },
    { href: "/leads.html", rotulo: "Leads Instagram", id: "leads" },
  ];
  if (usuario?.papel === "admin") {
    itens.push({ href: "/colaboradores.html", rotulo: "Colaboradores", id: "colaboradores" });
    itens.push({ href: "/instagram-conectar.html", rotulo: "Conectar Instagram", id: "instagram" });
  }
  const nav = document.getElementById("menu-principal");
  if (!nav) return;
  nav.innerHTML = itens
    .map((i) => `<a href="${i.href}" class="${i.id === paginaAtiva ? "ativo" : ""}">${i.rotulo}</a>`)
    .join("");

  const nomeEl = document.getElementById("usuario-logado");
  if (nomeEl && usuario) nomeEl.innerHTML = `<a href="/perfil.html">${usuario.nome}</a> (${usuario.papel})`;

  const sairEl = document.getElementById("btn-sair");
  if (sairEl) sairEl.addEventListener("click", encerrarSessao);
}
