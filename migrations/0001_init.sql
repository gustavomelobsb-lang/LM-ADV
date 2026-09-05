-- Colaboradores do escritorio (login/senha)
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  oab TEXT,
  papel TEXT NOT NULL DEFAULT 'advogado' CHECK (papel IN ('admin', 'advogado', 'estagiario')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Teses juridicas do escritorio, reutilizadas na geracao de peticoes
CREATE TABLE teses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  area_direito TEXT NOT NULL,
  ramos_justica TEXT NOT NULL DEFAULT '[]',
  resumo TEXT,
  fundamentacao TEXT NOT NULL,
  pedidos_padrao TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  ativa INTEGER NOT NULL DEFAULT 1,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo_pessoa TEXT NOT NULL DEFAULT 'fisica' CHECK (tipo_pessoa IN ('fisica', 'juridica')),
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE casos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  tese_id INTEGER REFERENCES teses(id),
  ramo_justica TEXT NOT NULL,
  tribunal_alias TEXT,
  comarca_vara TEXT,
  numero_processo TEXT,
  status TEXT NOT NULL DEFAULT 'em_preparacao' CHECK (status IN ('em_preparacao', 'peticao_gerada', 'distribuido', 'arquivado')),
  fatos TEXT,
  pedidos_especificos TEXT NOT NULL DEFAULT '[]',
  valor_causa REAL,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE peticoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id INTEGER NOT NULL REFERENCES casos(id),
  tese_id INTEGER REFERENCES teses(id),
  tipo TEXT NOT NULL DEFAULT 'inicial',
  conteudo TEXT NOT NULL,
  gerado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Historico/cache de consultas de jurimetria feitas contra APIs de tribunais
CREATE TABLE jurimetria_consultas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  termo_busca TEXT NOT NULL,
  tribunal_alias TEXT NOT NULL,
  filtros_json TEXT NOT NULL DEFAULT '{}',
  total_resultados INTEGER NOT NULL DEFAULT 0,
  resultado_resumo_json TEXT NOT NULL DEFAULT '[]',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_casos_cliente ON casos(cliente_id);
CREATE INDEX idx_casos_tese ON casos(tese_id);
CREATE INDEX idx_peticoes_caso ON peticoes(caso_id);
CREATE INDEX idx_jurimetria_tribunal ON jurimetria_consultas(tribunal_alias);
