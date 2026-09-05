// Aliases de tribunais para a API Publica do DataJud (CNJ).
// Padrao de URL: https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search
// IMPORTANTE: o STF NAO e coberto pelo DataJud, pois o Supremo nao esta no rol dos
// orgaos do art. 92, incisos II a VII, da Constituicao, que fundamenta a Res. CNJ 331/2020.
// Confirme sempre a lista vigente em https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
// antes de usar em producao, pois o CNJ pode adicionar/renomear aliases.

export interface GrupoTribunais {
  grupo: string;
  descricao: string;
  aliases: { alias: string; nome: string }[];
}

const ESTADOS: { uf: string; nome: string }[] = [
  { uf: "ac", nome: "Acre" }, { uf: "al", nome: "Alagoas" }, { uf: "ap", nome: "Amapá" },
  { uf: "am", nome: "Amazonas" }, { uf: "ba", nome: "Bahia" }, { uf: "ce", nome: "Ceará" },
  { uf: "es", nome: "Espírito Santo" }, { uf: "go", nome: "Goiás" }, { uf: "ma", nome: "Maranhão" },
  { uf: "mt", nome: "Mato Grosso" }, { uf: "ms", nome: "Mato Grosso do Sul" }, { uf: "mg", nome: "Minas Gerais" },
  { uf: "pa", nome: "Pará" }, { uf: "pb", nome: "Paraíba" }, { uf: "pr", nome: "Paraná" },
  { uf: "pe", nome: "Pernambuco" }, { uf: "pi", nome: "Piauí" }, { uf: "rj", nome: "Rio de Janeiro" },
  { uf: "rn", nome: "Rio Grande do Norte" }, { uf: "rs", nome: "Rio Grande do Sul" }, { uf: "ro", nome: "Rondônia" },
  { uf: "rr", nome: "Roraima" }, { uf: "sc", nome: "Santa Catarina" }, { uf: "sp", nome: "São Paulo" },
  { uf: "se", nome: "Sergipe" }, { uf: "to", nome: "Tocantins" },
];

export const GRUPOS_TRIBUNAIS: GrupoTribunais[] = [
  {
    grupo: "superiores",
    descricao: "Tribunais Superiores",
    aliases: [
      { alias: "stj", nome: "Superior Tribunal de Justiça (STJ)" },
      { alias: "tst", nome: "Tribunal Superior do Trabalho (TST)" },
      { alias: "tse", nome: "Tribunal Superior Eleitoral (TSE)" },
      { alias: "stm", nome: "Superior Tribunal Militar (STM)" },
    ],
  },
  {
    grupo: "federal",
    descricao: "Justiça Federal (TRFs)",
    aliases: Array.from({ length: 6 }, (_, i) => ({ alias: `trf${i + 1}`, nome: `Tribunal Regional Federal da ${i + 1}ª Região` })),
  },
  {
    grupo: "trabalho",
    descricao: "Justiça do Trabalho (TRTs)",
    aliases: Array.from({ length: 24 }, (_, i) => ({ alias: `trt${i + 1}`, nome: `Tribunal Regional do Trabalho da ${i + 1}ª Região` })),
  },
  {
    grupo: "estadual",
    descricao: "Justiça Estadual (TJs)",
    aliases: [
      ...ESTADOS.map((e) => ({ alias: `tj${e.uf}`, nome: `Tribunal de Justiça de ${e.nome}` })),
      { alias: "tjdft", nome: "Tribunal de Justiça do Distrito Federal e Territórios" },
    ],
  },
  {
    grupo: "eleitoral",
    descricao: "Justiça Eleitoral (TREs)",
    aliases: [
      ...ESTADOS.map((e) => ({ alias: `tre${e.uf}`, nome: `Tribunal Regional Eleitoral de ${e.nome}` })),
      { alias: "tredf", nome: "Tribunal Regional Eleitoral do Distrito Federal" },
    ],
  },
];

export const ALIASES_VALIDOS = new Set(GRUPOS_TRIBUNAIS.flatMap((g) => g.aliases.map((a) => a.alias)));
