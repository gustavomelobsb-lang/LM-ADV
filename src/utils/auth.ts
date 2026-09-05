import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { SessaoUsuario } from "../types";

const TOKEN_TTL_SECONDS = 60 * 60 * 8; // jornada de trabalho de um colaborador

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export async function emitirToken(usuario: SessaoUsuario, segredo: string): Promise<string> {
  const chave = new TextEncoder().encode(segredo);
  return new SignJWT({ nome: usuario.nome, email: usuario.email, papel: usuario.papel, oab: usuario.oab })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(usuario.id))
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(chave);
}

export async function verificarToken(token: string, segredo: string): Promise<SessaoUsuario | null> {
  try {
    const chave = new TextEncoder().encode(segredo);
    const { payload } = await jwtVerify(token, chave);
    return {
      id: Number(payload.sub),
      nome: String(payload.nome),
      email: String(payload.email),
      papel: payload.papel as SessaoUsuario["papel"],
      oab: (payload.oab as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
