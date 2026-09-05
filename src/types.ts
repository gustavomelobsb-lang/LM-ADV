export type Papel = "admin" | "advogado" | "estagiario";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  DATAJUD_API_KEY?: string;
  APP_NAME: string;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  oab: string | null;
  papel: Papel;
  ativo: number;
  criado_em: string;
}

export interface SessaoUsuario {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  oab: string | null;
}

export interface Tese {
  id: number;
  titulo: string;
  area_direito: string;
  ramos_justica: string;
  resumo: string | null;
  fundamentacao: string;
  pedidos_padrao: string;
  tags: string;
  ativa: number;
  criado_por: number | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Cliente {
  id: number;
  nome: string;
  tipo_pessoa: "fisica" | "juridica";
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  criado_por: number | null;
  criado_em: string;
}

export interface Caso {
  id: number;
  cliente_id: number;
  tese_id: number | null;
  ramo_justica: string;
  tribunal_alias: string | null;
  comarca_vara: string | null;
  numero_processo: string | null;
  status: "em_preparacao" | "peticao_gerada" | "distribuido" | "arquivado";
  fatos: string | null;
  pedidos_especificos: string;
  valor_causa: number | null;
  criado_por: number | null;
  criado_em: string;
}
