import { Hono } from "hono";
import type { Env, Usuario } from "../types";
import { emitirToken, hashSenha, verificarSenha } from "../utils/auth";
import { exigirAutenticacao } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env }>();

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; senha?: string }>().catch(() => ({} as { email?: string; senha?: string }));
  const email = body.email?.trim().toLowerCase();
  const senha = body.senha;
  if (!email || !senha) {
    return c.json({ erro: "Informe email e senha" }, 400);
  }

  const usuario = await c.env.DB.prepare(
    "SELECT * FROM usuarios WHERE email = ? AND ativo = 1"
  )
    .bind(email)
    .first<Usuario>();

  if (!usuario || !(await verificarSenha(senha, usuario.senha_hash))) {
    return c.json({ erro: "Credenciais invalidas" }, 401);
  }

  const sessao = { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, oab: usuario.oab };
  const token = await emitirToken(sessao, c.env.JWT_SECRET);
  return c.json({ token, usuario: sessao });
});

auth.get("/me", exigirAutenticacao, async (c) => {
  return c.json({ usuario: c.get("usuario") });
});

auth.post("/trocar-senha", exigirAutenticacao, async (c) => {
  const usuarioSessao = c.get("usuario");
  const body = await c
    .req.json<{ senhaAtual?: string; novaSenha?: string }>()
    .catch(() => ({} as { senhaAtual?: string; novaSenha?: string }));

  if (!body.senhaAtual || !body.novaSenha || body.novaSenha.length < 8) {
    return c.json({ erro: "Informe a senha atual e uma nova senha com no minimo 8 caracteres" }, 400);
  }

  const usuario = await c.env.DB.prepare("SELECT * FROM usuarios WHERE id = ?")
    .bind(usuarioSessao.id)
    .first<Usuario>();

  if (!usuario || !(await verificarSenha(body.senhaAtual, usuario.senha_hash))) {
    return c.json({ erro: "Senha atual incorreta" }, 401);
  }

  const novoHash = await hashSenha(body.novaSenha);
  await c.env.DB.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").bind(novoHash, usuario.id).run();

  return c.json({ ok: true });
});

export default auth;
