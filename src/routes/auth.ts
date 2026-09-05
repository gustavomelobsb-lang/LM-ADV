import { Hono } from "hono";
import type { Env, Usuario } from "../types";
import { emitirToken, verificarSenha } from "../utils/auth";
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

export default auth;
