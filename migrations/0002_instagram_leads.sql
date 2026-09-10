-- Conexao com a conta profissional do Instagram do escritorio (apenas uma por vez)
CREATE TABLE integracao_instagram (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instagram_user_id TEXT NOT NULL,
  username TEXT,
  access_token TEXT NOT NULL,
  token_expira_em TEXT,
  conectado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instagram_scoped_id TEXT NOT NULL UNIQUE,
  nome TEXT,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_atendimento', 'convertido', 'descartado')),
  cliente_id INTEGER REFERENCES clientes(id),
  atribuido_a INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lead_mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  direcao TEXT NOT NULL CHECK (direcao IN ('recebida', 'enviada')),
  texto TEXT,
  enviado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_lead_mensagens_lead ON lead_mensagens(lead_id);
CREATE INDEX idx_leads_status ON leads(status);
