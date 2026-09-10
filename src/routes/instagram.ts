import { Hono } from "hono";
import type { Env, IntegracaoInstagram } from "../types";
import { exigirAutenticacao, exigirPapel } from "../middleware/auth";
import {
  extrairMensagensDoPayload,
  montarUrlAutorizacao,
  obterPerfilConectado,
  trocarCodigoPorTokenCurto,
  trocarPorTokenLongaDuracao,
  verificarAssinaturaWebhook,
} from "../services/instagram";

const instagram = new Hono<{ Bindings: Env }>();

function redirectUriPadrao(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}/instagram-callback.html`;
}

instagram.get("/conectar", exigirAutenticacao, exigirPapel("admin"), async (c) => {
  if (!c.env.META_APP_ID) {
    return c.json({ erro: "META_APP_ID nao configurado. Veja o README para criar o App no Meta for Developers." }, 500);
  }
  const url = montarUrlAutorizacao(c.env.META_APP_ID, redirectUriPadrao(c));
  return c.json({ url });
});

instagram.post("/oauth/trocar-codigo", exigirAutenticacao, exigirPapel("admin"), async (c) => {
  const usuario = c.get("usuario");
  if (!c.env.META_APP_ID || !c.env.META_APP_SECRET) {
    return c.json({ erro: "META_APP_ID/META_APP_SECRET nao configurados" }, 500);
  }
  const body = await c.req.json<{ code?: string }>().catch(() => ({} as { code?: string }));
  if (!body.code) return c.json({ erro: "code e obrigatorio" }, 400);

  try {
    const curto = await trocarCodigoPorTokenCurto(c.env.META_APP_ID, c.env.META_APP_SECRET, redirectUriPadrao(c), body.code);
    const longo = await trocarPorTokenLongaDuracao(c.env.META_APP_SECRET, curto.access_token);
    const perfil = await obterPerfilConectado(longo.access_token);
    const expiraEm = new Date(Date.now() + longo.expires_in * 1000).toISOString();

    await c.env.DB.prepare("DELETE FROM integracao_instagram").run();
    await c.env.DB.prepare(
      `INSERT INTO integracao_instagram (instagram_user_id, username, access_token, token_expira_em, conectado_por)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(perfil.user_id, perfil.username, longo.access_token, expiraEm, usuario.id)
      .run();

    return c.json({ ok: true, username: perfil.username });
  } catch (erro) {
    return c.json({ erro: erro instanceof Error ? erro.message : "Falha ao conectar com o Instagram" }, 502);
  }
});

instagram.get("/status", exigirAutenticacao, async (c) => {
  const integracao = await c.env.DB.prepare("SELECT * FROM integracao_instagram ORDER BY id DESC LIMIT 1").first<IntegracaoInstagram>();
  if (!integracao) return c.json({ conectado: false });
  return c.json({
    conectado: true,
    username: integracao.username,
    conectadoEm: integracao.criado_em,
    tokenExpiraEm: integracao.token_expira_em,
  });
});

instagram.post("/desconectar", exigirAutenticacao, exigirPapel("admin"), async (c) => {
  await c.env.DB.prepare("DELETE FROM integracao_instagram").run();
  return c.json({ ok: true });
});

// Endpoints publicos chamados pela Meta - sem autenticacao JWT.
instagram.get("/webhook", async (c) => {
  const modo = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const desafio = c.req.query("hub.challenge");
  if (modo === "subscribe" && token && c.env.META_WEBHOOK_VERIFY_TOKEN && token === c.env.META_WEBHOOK_VERIFY_TOKEN) {
    return c.text(desafio ?? "");
  }
  return c.text("Token de verificacao invalido", 403);
});

instagram.post("/webhook", async (c) => {
  const corpoBruto = await c.req.text();
  const assinatura = c.req.header("X-Hub-Signature-256") ?? null;

  if (!c.env.META_APP_SECRET || !(await verificarAssinaturaWebhook(c.env.META_APP_SECRET, corpoBruto, assinatura))) {
    return c.text("Assinatura invalida", 401);
  }

  const payload = JSON.parse(corpoBruto);
  const integracao = await c.env.DB.prepare("SELECT * FROM integracao_instagram ORDER BY id DESC LIMIT 1").first<IntegracaoInstagram>();

  for (const evento of extrairMensagensDoPayload(payload)) {
    // Ignora eco de mensagens enviadas pela propria conta do escritorio.
    if (integracao && evento.remetenteId === integracao.instagram_user_id) continue;

    let lead = await c.env.DB.prepare("SELECT id FROM leads WHERE instagram_scoped_id = ?")
      .bind(evento.remetenteId)
      .first<{ id: number }>();

    if (!lead) {
      const resultado = await c.env.DB.prepare(
        "INSERT INTO leads (instagram_scoped_id, status) VALUES (?, 'novo')"
      )
        .bind(evento.remetenteId)
        .run();
      lead = { id: Number(resultado.meta.last_row_id) };
    } else {
      await c.env.DB.prepare("UPDATE leads SET atualizado_em = datetime('now') WHERE id = ?").bind(lead.id).run();
    }

    await c.env.DB.prepare("INSERT INTO lead_mensagens (lead_id, direcao, texto) VALUES (?, 'recebida', ?)")
      .bind(lead.id, evento.texto)
      .run();
  }

  return c.text("ok");
});

export default instagram;
