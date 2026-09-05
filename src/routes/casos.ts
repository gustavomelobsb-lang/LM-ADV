import { Hono } from "hono";
import type { Caso, Env } from "../types";
import { exigirAutenticacao } from "../middleware/auth";

const casos = new Hono<{ Bindings: Env }>();
casos.use("*", exigirAutenticacao);

casos.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT casos.*, clientes.nome AS cliente_nome, teses.titulo AS tese_titulo
     FROM casos
     JOIN clientes ON clientes.id = casos.cliente_id
     LEFT JOIN teses ON teses.id = casos.tese_id
     ORDER BY casos.criado_em DESC`
  ).all();
  return c.json({ casos: results });
});

casos.get("/:id", async (c) => {
  const caso = await c.env.DB.prepare(
    `SELECT casos.*, clientes.nome AS cliente_nome, clientes.cpf_cnpj, clientes.endereco AS cliente_endereco
     FROM casos JOIN clientes ON clientes.id = casos.cliente_id WHERE casos.id = ?`
  )
    .bind(c.req.param("id"))
    .first();
  if (!caso) return c.json({ erro: "Caso nao encontrado" }, 404);
  return c.json({ caso });
});

interface CasoPayload {
  cliente_id?: number;
  tese_id?: number;
  ramo_justica?: string;
  tribunal_alias?: string;
  comarca_vara?: string;
  fatos?: string;
  pedidos_especificos?: string[];
  valor_causa?: number;
}

casos.post("/", async (c) => {
  const usuario = c.get("usuario");
  const body = await c.req.json<CasoPayload>().catch(() => ({} as CasoPayload));
  if (!body.cliente_id || !body.ramo_justica) {
    return c.json({ erro: "cliente_id e ramo_justica sao obrigatorios" }, 400);
  }
  const resultado = await c.env.DB.prepare(
    `INSERT INTO casos (cliente_id, tese_id, ramo_justica, tribunal_alias, comarca_vara, fatos, pedidos_especificos, valor_causa, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.cliente_id,
      body.tese_id ?? null,
      body.ramo_justica,
      body.tribunal_alias ?? null,
      body.comarca_vara ?? null,
      body.fatos ?? null,
      JSON.stringify(body.pedidos_especificos ?? []),
      body.valor_causa ?? null,
      usuario.id
    )
    .run();
  return c.json({ id: resultado.meta.last_row_id }, 201);
});

casos.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<Caso>>().catch(() => ({} as Partial<Caso>));
  const atual = await c.env.DB.prepare("SELECT * FROM casos WHERE id = ?").bind(id).first<Caso>();
  if (!atual) return c.json({ erro: "Caso nao encontrado" }, 404);

  await c.env.DB.prepare(
    `UPDATE casos SET numero_processo = ?, status = ?, comarca_vara = ? WHERE id = ?`
  )
    .bind(
      body.numero_processo ?? atual.numero_processo,
      body.status ?? atual.status,
      body.comarca_vara ?? atual.comarca_vara,
      id
    )
    .run();
  return c.json({ ok: true });
});

export default casos;
