import type { Caso, Cliente, SessaoUsuario, Tese } from "../types";

function formatarData(): string {
  return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function listaNumerada(itens: string[]): string {
  return itens.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

export function gerarPeticaoInicial(dados: {
  caso: Caso;
  cliente: Cliente;
  tese: Tese | null;
  advogado: SessaoUsuario;
}): string {
  const { caso, cliente, tese, advogado } = dados;

  const pedidosPadrao: string[] = tese ? JSON.parse(tese.pedidos_padrao || "[]") : [];
  const pedidosEspecificos: string[] = JSON.parse(caso.pedidos_especificos || "[]");
  const todosPedidos = [...pedidosPadrao, ...pedidosEspecificos];

  const enderecamento = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO ${
    caso.comarca_vara ? `DA ${caso.comarca_vara.toUpperCase()}` : "DA VARA COMPETENTE"
  } — ${caso.ramo_justica.toUpperCase()}`;

  const qualificacao = `${cliente.nome}, ${cliente.tipo_pessoa === "juridica" ? "pessoa jurídica" : "pessoa física"}${
    cliente.cpf_cnpj ? `, inscrito(a) sob o ${cliente.tipo_pessoa === "juridica" ? "CNPJ" : "CPF"} nº ${cliente.cpf_cnpj}` : ""
  }${cliente.endereco ? `, com endereço em ${cliente.endereco}` : ""}, por seu(sua) advogado(a) que esta subscreve, vem, respeitosamente, à presença de Vossa Excelência, propor a presente`;

  const tituloAcao = tese ? tese.titulo.toUpperCase() : "AÇÃO";

  const fundamentacao = tese?.fundamentacao ?? "[Fundamentação jurídica a ser preenchida — nenhuma tese vinculada a este caso.]";

  const partes = [
    enderecamento,
    "",
    `${tituloAcao}`,
    "",
    qualificacao,
    "",
    "em face de [QUALIFICAÇÃO DA PARTE RÉ A SER PREENCHIDA], pelos fatos e fundamentos a seguir expostos.",
    "",
    "I — DOS FATOS",
    "",
    caso.fatos?.trim() || "[Descrição dos fatos a ser preenchida pelo(a) advogado(a) responsável.]",
    "",
    "II — DO DIREITO",
    "",
    fundamentacao,
    "",
    "III — DOS PEDIDOS",
    "",
    "Ante o exposto, requer-se:",
    "",
    todosPedidos.length > 0
      ? listaNumerada(todosPedidos)
      : "[Pedidos a serem preenchidos com base na tese jurídica e nas particularidades do caso.]",
    "",
    caso.valor_causa
      ? `Dá-se à causa o valor de R$ ${caso.valor_causa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
      : "Dá-se à causa o valor de [VALOR DA CAUSA].",
    "",
    "Nestes termos,",
    "Pede deferimento.",
    "",
    `[Local], ${formatarData()}.`,
    "",
    `${advogado.nome}${advogado.oab ? ` — OAB ${advogado.oab}` : advogado.papel === "advogado" ? " — OAB [número a preencher]" : ""}`,
  ];

  return partes.join("\n");
}
