import { Hono } from "hono";
import type { Env, Tese } from "../types";
import { exigirAutenticacao } from "../middleware/auth";

const teses = new Hono<{ Bindings: Env }>();
teses.use("*", exigirAutenticacao);

teses.get("/", async (c) => {
  const busca = c.req.query("q");
  const stmt = busca
    ? c.env.DB.prepare(
        "SELECT * FROM teses WHERE ativa = 1 AND (titulo LIKE ? OR area_direito LIKE ? OR tags LIKE ?) ORDER BY titulo"
      ).bind(`%${busca}%`, `%${busca}%`, `%${busca}%`)
    : c.env.DB.prepare("SELECT * FROM teses WHERE ativa = 1 ORDER BY titulo");
  const { results } = await stmt.all<Tese>();
  return c.json({ teses: results });
});

teses.get("/:id", async (c) => {
  const tese = await c.env.DB.prepare("SELECT * FROM teses WHERE id = ?")
    .bind(c.req.param("id"))
    .first<Tese>();
  if (!tese) return c.json({ erro: "Tese nao encontrada" }, 404);
  return c.json({ tese });
});

interface TesePayload {
  titulo?: string;
  area_direito?: string;
  ramos_justica?: string[];
  resumo?: string;
  fundamentacao?: string;
  pedidos_padrao?: string[];
  tags?: string[];
}

teses.post("/", async (c) => {
  const usuario = c.get("usuario");
  const body = await c.req.json<TesePayload>().catch(() => ({} as TesePayload));
  if (!body.titulo || !body.area_direito || !body.fundamentacao) {
    return c.json({ erro: "titulo, area_direito e fundamentacao sao obrigatorios" }, 400);
  }
  const resultado = await c.env.DB.prepare(
    `INSERT INTO teses (titulo, area_direito, ramos_justica, resumo, fundamentacao, pedidos_padrao, tags, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.titulo,
      body.area_direito,
      JSON.stringify(body.ramos_justica ?? []),
      body.resumo ?? null,
      body.fundamentacao,
      JSON.stringify(body.pedidos_padrao ?? []),
      JSON.stringify(body.tags ?? []),
      usuario.id
    )
    .run();
  return c.json({ id: resultado.meta.last_row_id }, 201);
});

teses.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<TesePayload>().catch(() => ({} as TesePayload));
  const atual = await c.env.DB.prepare("SELECT * FROM teses WHERE id = ?").bind(id).first<Tese>();
  if (!atual) return c.json({ erro: "Tese nao encontrada" }, 404);

  await c.env.DB.prepare(
    `UPDATE teses SET titulo = ?, area_direito = ?, ramos_justica = ?, resumo = ?, fundamentacao = ?, pedidos_padrao = ?, tags = ?, atualizado_em = datetime('now')
     WHERE id = ?`
  )
    .bind(
      body.titulo ?? atual.titulo,
      body.area_direito ?? atual.area_direito,
      body.ramos_justica ? JSON.stringify(body.ramos_justica) : atual.ramos_justica,
      body.resumo ?? atual.resumo,
      body.fundamentacao ?? atual.fundamentacao,
      body.pedidos_padrao ? JSON.stringify(body.pedidos_padrao) : atual.pedidos_padrao,
      body.tags ? JSON.stringify(body.tags) : atual.tags,
      id
    )
    .run();
  return c.json({ ok: true });
});

teses.delete("/:id", async (c) => {
  await c.env.DB.prepare("UPDATE teses SET ativa = 0 WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

export default teses;
