import { Hono } from "hono";
import type { Env, Papel, Usuario } from "../types";
import { exigirAutenticacao, exigirPapel } from "../middleware/auth";
import { hashSenha } from "../utils/auth";

const usuarios = new Hono<{ Bindings: Env }>();
usuarios.use("*", exigirAutenticacao);

usuarios.get("/", exigirPapel("admin"), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, nome, email, oab, papel, ativo, criado_em FROM usuarios ORDER BY nome"
  ).all();
  return c.json({ usuarios: results });
});

usuarios.post("/", exigirPapel("admin"), async (c) => {
  type NovoUsuarioPayload = { nome?: string; email?: string; senha?: string; oab?: string; papel?: Papel };
  const body = await c.req.json<NovoUsuarioPayload>().catch(() => ({} as NovoUsuarioPayload));
  const { nome, email, senha, oab, papel } = body;
  if (!nome || !email || !senha) {
    return c.json({ erro: "Nome, email e senha sao obrigatorios" }, 400);
  }
  const papelValido: Papel = papel && ["admin", "advogado", "estagiario"].includes(papel) ? papel : "advogado";
  const senhaHash = await hashSenha(senha);

  try {
    const resultado = await c.env.DB.prepare(
      "INSERT INTO usuarios (nome, email, senha_hash, oab, papel) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(nome, email.trim().toLowerCase(), senhaHash, oab ?? null, papelValido)
      .run();
    return c.json({ id: resultado.meta.last_row_id }, 201);
  } catch (erro) {
    return c.json({ erro: "Nao foi possivel criar o colaborador (email ja cadastrado?)" }, 409);
  }
});

usuarios.patch("/:id/status", exigirPapel("admin"), async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ ativo?: boolean }>().catch(() => ({} as { ativo?: boolean }));
  await c.env.DB.prepare("UPDATE usuarios SET ativo = ? WHERE id = ?")
    .bind(body.ativo ? 1 : 0, id)
    .run();
  return c.json({ ok: true });
});

export default usuarios;
