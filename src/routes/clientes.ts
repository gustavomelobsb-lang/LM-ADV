import { Hono } from "hono";
import type { Cliente, Env } from "../types";
import { exigirAutenticacao } from "../middleware/auth";

const clientes = new Hono<{ Bindings: Env }>();
clientes.use("*", exigirAutenticacao);

clientes.get("/", async (c) => {
  const busca = c.req.query("q");
  const stmt = busca
    ? c.env.DB.prepare("SELECT * FROM clientes WHERE nome LIKE ? OR cpf_cnpj LIKE ? ORDER BY nome").bind(`%${busca}%`, `%${busca}%`)
    : c.env.DB.prepare("SELECT * FROM clientes ORDER BY nome");
  const { results } = await stmt.all<Cliente>();
  return c.json({ clientes: results });
});

clientes.post("/", async (c) => {
  const usuario = c.get("usuario");
  const body = await c.req.json<Partial<Cliente>>().catch(() => ({} as Partial<Cliente>));
  if (!body.nome) return c.json({ erro: "nome e obrigatorio" }, 400);
  const resultado = await c.env.DB.prepare(
    `INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.nome,
      body.tipo_pessoa ?? "fisica",
      body.cpf_cnpj ?? null,
      body.email ?? null,
      body.telefone ?? null,
      body.endereco ?? null,
      usuario.id
    )
    .run();
  return c.json({ id: resultado.meta.last_row_id }, 201);
});

export default clientes;
