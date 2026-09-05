import { Hono } from "hono";
import type { Env } from "../types";
import { exigirAutenticacao } from "../middleware/auth";
import { consultarDataJud } from "../services/datajud";
import { GRUPOS_TRIBUNAIS } from "../services/tribunais";

const jurimetria = new Hono<{ Bindings: Env }>();
jurimetria.use("*", exigirAutenticacao);

jurimetria.get("/tribunais", (c) => {
  return c.json({
    grupos: GRUPOS_TRIBUNAIS,
    aviso:
      "O STF nao integra a base DataJud do CNJ (nao esta sujeito ao art. 92, II-VII, CF). " +
      "Para jurisprudencia do STF, utilize o portal proprio do tribunal.",
  });
});

jurimetria.post("/buscar", async (c) => {
  const usuario = c.get("usuario");
  if (!c.env.DATAJUD_API_KEY) {
    return c.json(
      { erro: "DATAJUD_API_KEY nao configurada. Defina o secret no Cloudflare (veja README)." },
      500
    );
  }

  type BuscaJurimetriaPayload = {
    tribunalAlias?: string;
    termoBusca?: string;
    dataInicio?: string;
    dataFim?: string;
    classe?: string;
    grau?: string;
  };
  const body = await c
    .req.json<BuscaJurimetriaPayload>()
    .catch(() => ({} as BuscaJurimetriaPayload));

  if (!body.tribunalAlias) {
    return c.json({ erro: "tribunalAlias e obrigatorio" }, 400);
  }

  try {
    const resultado = await consultarDataJud(c.env.DATAJUD_API_KEY, body.tribunalAlias, body.termoBusca ?? "", {
      dataInicio: body.dataInicio,
      dataFim: body.dataFim,
      classe: body.classe,
      grau: body.grau,
    });

    await c.env.DB.prepare(
      `INSERT INTO jurimetria_consultas (usuario_id, termo_busca, tribunal_alias, filtros_json, total_resultados, resultado_resumo_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        usuario.id,
        body.termoBusca ?? "",
        body.tribunalAlias,
        JSON.stringify({ dataInicio: body.dataInicio, dataFim: body.dataFim, classe: body.classe, grau: body.grau }),
        resultado.totalEncontrado,
        JSON.stringify(resultado.distribuicaoPorClasse)
      )
      .run();

    return c.json({ resultado });
  } catch (erro) {
    return c.json({ erro: erro instanceof Error ? erro.message : "Falha ao consultar o DataJud" }, 502);
  }
});

jurimetria.get("/historico", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM jurimetria_consultas ORDER BY criado_em DESC LIMIT 50"
  ).all();
  return c.json({ historico: results });
});

export default jurimetria;
