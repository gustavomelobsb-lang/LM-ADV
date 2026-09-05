import type { Context, Next } from "hono";
import type { Env, Papel, SessaoUsuario } from "../types";
import { verificarToken } from "../utils/auth";

declare module "hono" {
  interface ContextVariableMap {
    usuario: SessaoUsuario;
  }
}

export async function exigirAutenticacao(c: Context<{ Bindings: Env }>, next: Next) {
  const cabecalho = c.req.header("Authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  if (!token) {
    return c.json({ erro: "Nao autenticado" }, 401);
  }
  const usuario = await verificarToken(token, c.env.JWT_SECRET);
  if (!usuario) {
    return c.json({ erro: "Sessao invalida ou expirada" }, 401);
  }
  c.set("usuario", usuario);
  await next();
}

export function exigirPapel(...papeis: Papel[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const usuario = c.get("usuario");
    if (!usuario || !papeis.includes(usuario.papel)) {
      return c.json({ erro: "Acesso restrito" }, 403);
    }
    await next();
  };
}
