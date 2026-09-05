import { ALIASES_VALIDOS } from "./tribunais";

const BASE_URL = "https://api-publica.datajud.cnj.jus.br";

export interface FiltrosJurimetria {
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string;
  classe?: string;
  grau?: string;
}

export interface ResultadoJurimetria {
  tribunalAlias: string;
  totalEncontrado: number;
  amostraProcessos: Array<{
    numeroProcesso: string;
    classe: string | null;
    orgaoJulgador: string | null;
    dataAjuizamento: string | null;
    assuntos: string[];
  }>;
  distribuicaoPorClasse: Array<{ chave: string; total: number }>;
  distribuicaoPorOrgaoJulgador: Array<{ chave: string; total: number }>;
}

function montarFiltrosData(filtros: FiltrosJurimetria) {
  if (!filtros.dataInicio && !filtros.dataFim) return null;
  const range: Record<string, string> = {};
  if (filtros.dataInicio) range.gte = filtros.dataInicio;
  if (filtros.dataFim) range.lte = filtros.dataFim;
  return { range: { dataAjuizamento: range } };
}

export async function consultarDataJud(
  apiKey: string,
  tribunalAlias: string,
  termoBusca: string,
  filtros: FiltrosJurimetria = {}
): Promise<ResultadoJurimetria> {
  if (!ALIASES_VALIDOS.has(tribunalAlias)) {
    throw new Error(`Tribunal "${tribunalAlias}" nao reconhecido (o STF, por exemplo, nao e coberto pelo DataJud).`);
  }

  const must: unknown[] = [];
  if (termoBusca?.trim()) {
    must.push({
      query_string: {
        query: termoBusca,
        fields: ["assuntos.nome", "classe.nome"],
        default_operator: "AND",
      },
    });
  }
  if (filtros.classe) must.push({ match: { "classe.nome": filtros.classe } });
  if (filtros.grau) must.push({ match: { grau: filtros.grau } });
  const filtroData = montarFiltrosData(filtros);
  if (filtroData) must.push(filtroData);

  const corpo = {
    size: 20,
    query: must.length > 0 ? { bool: { must } } : { match_all: {} },
    aggs: {
      por_classe: { terms: { field: "classe.nome.keyword", size: 10 } },
      por_orgao_julgador: { terms: { field: "orgaoJulgador.nome.keyword", size: 10 } },
    },
  };

  const resposta = await fetch(`${BASE_URL}/api_publica_${tribunalAlias}/_search`, {
    method: "POST",
    headers: {
      Authorization: `APIKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`DataJud respondeu ${resposta.status}: ${texto.slice(0, 300)}`);
  }

  const dados = (await resposta.json()) as any;
  const hits = dados?.hits?.hits ?? [];
  const total = dados?.hits?.total?.value ?? 0;

  return {
    tribunalAlias,
    totalEncontrado: total,
    amostraProcessos: hits.map((h: any) => ({
      numeroProcesso: h._source?.numeroProcesso ?? h._id,
      classe: h._source?.classe?.nome ?? null,
      orgaoJulgador: h._source?.orgaoJulgador?.nome ?? null,
      dataAjuizamento: h._source?.dataAjuizamento ?? null,
      assuntos: (h._source?.assuntos ?? []).map((a: any) => a.nome).filter(Boolean),
    })),
    distribuicaoPorClasse: (dados?.aggregations?.por_classe?.buckets ?? []).map((b: any) => ({
      chave: b.key,
      total: b.doc_count,
    })),
    distribuicaoPorOrgaoJulgador: (dados?.aggregations?.por_orgao_julgador?.buckets ?? []).map((b: any) => ({
      chave: b.key,
      total: b.doc_count,
    })),
  };
}
