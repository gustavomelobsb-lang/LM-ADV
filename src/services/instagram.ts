// Integracao com a Instagram Messaging API ("Instagram API with Instagram Login").
// Documentacao oficial (verifique sempre a versao vigente antes de mudar endpoints):
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
//
// Escopos usados: instagram_business_basic + instagram_business_manage_messages.
// Exigem que a conta seja Instagram profissional (Business/Creator) e que o App
// passe pelo App Review da Meta para acesso em producao (fora de contas de teste).

const GRAPH_API_VERSION = "v21.0";
const AUTHORIZE_URL = "https://api.instagram.com/oauth/authorize";
const TOKEN_EXCHANGE_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_BASE = "https://graph.instagram.com";

export function montarUrlAutorizacao(appId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "instagram_business_basic,instagram_business_manage_messages",
    response_type: "code",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenCurtoResposta {
  access_token: string;
  user_id: string;
}

export async function trocarCodigoPorTokenCurto(
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string
): Promise<TokenCurtoResposta> {
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const resposta = await fetch(TOKEN_EXCHANGE_URL, { method: "POST", body });
  if (!resposta.ok) {
    throw new Error(`Falha ao trocar codigo por token: ${resposta.status} ${await resposta.text()}`);
  }
  return resposta.json();
}

export async function trocarPorTokenLongaDuracao(
  appSecret: string,
  tokenCurto: string
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: tokenCurto,
  });
  const resposta = await fetch(`${GRAPH_BASE}/access_token?${params.toString()}`);
  if (!resposta.ok) {
    throw new Error(`Falha ao gerar token de longa duracao: ${resposta.status} ${await resposta.text()}`);
  }
  return resposta.json();
}

export async function renovarTokenLongaDuracao(
  tokenAtual: string
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: tokenAtual });
  const resposta = await fetch(`${GRAPH_BASE}/refresh_access_token?${params.toString()}`);
  if (!resposta.ok) {
    throw new Error(`Falha ao renovar token: ${resposta.status} ${await resposta.text()}`);
  }
  return resposta.json();
}

export async function obterPerfilConectado(accessToken: string): Promise<{ user_id: string; username: string }> {
  const params = new URLSearchParams({ fields: "user_id,username", access_token: accessToken });
  const resposta = await fetch(`${GRAPH_BASE}/${GRAPH_API_VERSION}/me?${params.toString()}`);
  if (!resposta.ok) {
    throw new Error(`Falha ao obter perfil conectado: ${resposta.status} ${await resposta.text()}`);
  }
  return resposta.json();
}

export async function enviarMensagemDireta(
  accessToken: string,
  igUserId: string,
  destinatarioId: string,
  texto: string
): Promise<void> {
  const resposta = await fetch(`${GRAPH_BASE}/${GRAPH_API_VERSION}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ recipient: { id: destinatarioId }, message: { text: texto } }),
  });
  if (!resposta.ok) {
    throw new Error(`Falha ao enviar mensagem: ${resposta.status} ${await resposta.text()}`);
  }
}

export async function verificarAssinaturaWebhook(
  appSecret: string,
  corpoBruto: string,
  assinaturaRecebida: string | null
): Promise<boolean> {
  if (!assinaturaRecebida?.startsWith("sha256=")) return false;
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinaturaBytes = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpoBruto));
  const assinaturaCalculada =
    "sha256=" +
    Array.from(new Uint8Array(assinaturaBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  if (assinaturaCalculada.length !== assinaturaRecebida.length) return false;
  let diferenca = 0;
  for (let i = 0; i < assinaturaCalculada.length; i++) {
    diferenca |= assinaturaCalculada.charCodeAt(i) ^ assinaturaRecebida.charCodeAt(i);
  }
  return diferenca === 0;
}

export interface EventoMensagemInstagram {
  remetenteId: string;
  destinatarioId: string;
  texto: string | null;
  timestamp: number;
}

export function extrairMensagensDoPayload(payload: any): EventoMensagemInstagram[] {
  const eventos: EventoMensagemInstagram[] = [];
  const entradas = payload?.entry ?? [];
  for (const entrada of entradas) {
    const mensagens = entrada?.messaging ?? [];
    for (const m of mensagens) {
      if (!m?.message || m.message.is_echo) continue;
      eventos.push({
        remetenteId: m.sender?.id,
        destinatarioId: m.recipient?.id,
        texto: m.message?.text ?? null,
        timestamp: m.timestamp ?? Date.now(),
      });
    }
  }
  return eventos;
}
