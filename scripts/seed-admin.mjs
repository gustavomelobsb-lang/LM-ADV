import bcrypt from "bcryptjs";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readline from "node:readline/promises";

const alvo = process.argv.includes("--remote") ? "--remote" : "--local";

async function perguntar(rl, texto, obrigatorio = true) {
  let resposta = "";
  while (!resposta) {
    resposta = (await rl.question(texto)).trim();
    if (!obrigatorio) break;
  }
  return resposta;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`Criando administrador (destino do D1: ${alvo === "--remote" ? "banco de producao" : "banco local de desenvolvimento"})`);
  const nome = await perguntar(rl, "Nome completo: ");
  const email = (await perguntar(rl, "E-mail de login: ")).toLowerCase();
  const senha = await perguntar(rl, "Senha (min. 8 caracteres): ");
  const oab = await perguntar(rl, "OAB (opcional): ", false);
  rl.close();

  if (senha.length < 8) {
    console.error("Senha muito curta.");
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const escapar = (s) => s.replace(/'/g, "''");
  const sql = `INSERT INTO usuarios (nome, email, senha_hash, oab, papel) VALUES ('${escapar(nome)}', '${escapar(email)}', '${senhaHash}', ${oab ? `'${escapar(oab)}'` : "NULL"}, 'admin');`;

  const dir = mkdtempSync(join(tmpdir(), "lm-adv-seed-"));
  const arquivo = join(dir, "seed-admin.sql");
  writeFileSync(arquivo, sql);

  console.log("Executando via wrangler d1 execute...");
  execSync(`npx wrangler d1 execute lm_adv_db ${alvo} --file="${arquivo}"`, { stdio: "inherit" });
  console.log(`Administrador ${email} criado com sucesso.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
