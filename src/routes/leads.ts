import { Hono } from "hono";
import type { Env, IntegracaoInstagram, Lead, StatusLead } from "../types";
import { exigirAutenticacao } from "../middleware/auth";
import { enviarMensagemDireta } from "../services/instagram";

const leads = new Hono<{ Bindings: Env }>();
leads.use("*", exigirAutenticacao);

leads.get("/", async (c) => {
  const status = c.req.query("status");
  const stmt = status
    ? c.env.DB.prepare("SELECT * FROM leads WHERE status = ? ORDER BY atualizado_em DESC").bind(status)
    : c.env.DB.prepare("SELECT * FROM leads ORDER BY atualizado_em DESC");
  const { results } = await stmt.all<Lead>();
  return c.json({ leads: results });
});

leads.get("/:id", async (c) => {
  const lead = await c.env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(c.req.param("id")).first<Lead>();
  if (!lead) return c.json({ erro: "Lead nao encontrado" }, 404);
  const { results: mensagens } = await c.env.DB.prepare(
    "SELECT * FROM lead_mensagens WHERE lead_id = ? ORDER BY criado_em ASC"
  )
    .bind(lead.id)
    .all();
  return c.json({ lead, mensagens });
});

leads.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ status?: StatusLead; nome?: string; atribuido_a?: number }>().catch(
    () => ({} as { status?: StatusLead; nome?: string; atribuido_a?: number })
  );
  const atual = await c.env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first<Lead>();
  if (!atual) return c.json({ erro: "Lead nao encontrado" }, 404);

  await c.env.DB.prepare(
    "UPDATE leads SET status = ?, nome = ?, atribuido_a = ?, atualizado_em = datetime('now') WHERE id = ?"
  )
    .bind(body.status ?? atual.status, body.nome ?? atual.nome, body.atribuido_a ?? atual.atribuido_a, id)
    .run();
  return c.json({ ok: true });
});

leads.post("/:id/responder", async (c) => {
  const usuario = c.get("usuario");
  const id = c.req.param("id");
  const body = await c.req.json<{ texto?: string }>().catch(() => ({} as { texto?: string }));
  if (!body.texto?.trim()) return c.json({ erro: "texto e obrigatorio" }, 400);

  const lead = await c.env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first<Lead>();
  if (!lead) return c.json({ erro: "Lead nao encontrado" }, 404);

  const integracao = await c.env.DB.prepare("SELECT * FROM integracao_instagram ORDER BY id DESC LIMIT 1").first<IntegracaoInstagram>();
  if (!integracao) return c.json({ erro: "Nenhuma conta do Instagram conectada" }, 400);

  try {
    await enviarMensagemDireta(integracao.access_token, integracao.instagram_user_id, lead.instagram_scoped_id, body.texto);
  } catch (erro) {
    return c.json({ erro: erro instanceof Error ? erro.message : "Falha ao enviar mensagem" }, 502);
  }

  await c.env.DB.prepare("INSERT INTO lead_mensagens (lead_id, direcao, texto, enviado_por) VALUES (?, 'enviada', ?, ?)")
    .bind(lead.id, body.texto, usuario.id)
    .run();
  await c.env.DB.prepare("UPDATE leads SET status = 'em_atendimento', atualizado_em = datetime('now') WHERE id = ?")
    .bind(lead.id)
    .run();

  return c.json({ ok: true });
});

leads.post("/:id/converter", async (c) => {
  const usuario = c.get("usuario");
  const id = c.req.param("id");
  const body = await c.req.json<{ nome?: string; cpf_cnpj?: string; telefone?: string }>().catch(
    () => ({} as { nome?: string; cpf_cnpj?: string; telefone?: string })
  );

  const lead = await c.env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first<Lead>();
  if (!lead) return c.json({ erro: "Lead nao encontrado" }, 404);
  if (lead.cliente_id) return c.json({ erro: "Lead ja foi convertido em cliente" }, 409);

  const nome = body.nome || lead.nome || lead.username || `Lead Instagram #${lead.id}`;
  const resultado = await c.env.DB.prepare(
    "INSERT INTO clientes (nome, cpf_cnpj, telefone, criado_por) VALUES (?, ?, ?, ?)"
  )
    .bind(nome, body.cpf_cnpj ?? null, body.telefone ?? null, usuario.id)
    .run();

  const clienteId = resultado.meta.last_row_id;
  await c.env.DB.prepare("UPDATE leads SET status = 'convertido', cliente_id = ?, atualizado_em = datetime('now') WHERE id = ?")
    .bind(clienteId, lead.id)
    .run();

  return c.json({ ok: true, clienteId });
});

export default leads;
