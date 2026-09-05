import { Hono } from "hono";
import type { Caso, Cliente, Env, Tese } from "../types";
import { exigirAutenticacao } from "../middleware/auth";
import { gerarPeticaoInicial } from "../services/peticaoTemplate";

const peticoes = new Hono<{ Bindings: Env }>();
peticoes.use("*", exigirAutenticacao);

peticoes.post("/gerar/:casoId", async (c) => {
  const usuario = c.get("usuario");
  const casoId = c.req.param("casoId");

  const caso = await c.env.DB.prepare("SELECT * FROM casos WHERE id = ?").bind(casoId).first<Caso>();
  if (!caso) return c.json({ erro: "Caso nao encontrado" }, 404);

  const cliente = await c.env.DB.prepare("SELECT * FROM clientes WHERE id = ?").bind(caso.cliente_id).first<Cliente>();
  if (!cliente) return c.json({ erro: "Cliente do caso nao encontrado" }, 404);

  const tese = caso.tese_id
    ? await c.env.DB.prepare("SELECT * FROM teses WHERE id = ?").bind(caso.tese_id).first<Tese>()
    : null;

  const conteudo = gerarPeticaoInicial({ caso, cliente, tese, advogado: usuario });

  const resultado = await c.env.DB.prepare(
    "INSERT INTO peticoes (caso_id, tese_id, tipo, conteudo, gerado_por) VALUES (?, ?, 'inicial', ?, ?)"
  )
    .bind(caso.id, caso.tese_id, conteudo, usuario.id)
    .run();

  await c.env.DB.prepare("UPDATE casos SET status = 'peticao_gerada' WHERE id = ?").bind(caso.id).run();

  return c.json({ id: resultado.meta.last_row_id, conteudo }, 201);
});

peticoes.get("/caso/:casoId", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM peticoes WHERE caso_id = ? ORDER BY criado_em DESC"
  )
    .bind(c.req.param("casoId"))
    .all();
  return c.json({ peticoes: results });
});

peticoes.get("/:id", async (c) => {
  const peticao = await c.env.DB.prepare("SELECT * FROM peticoes WHERE id = ?").bind(c.req.param("id")).first();
  if (!peticao) return c.json({ erro: "Peticao nao encontrada" }, 404);
  return c.json({ peticao });
});

export default peticoes;
