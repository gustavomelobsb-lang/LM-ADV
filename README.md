# LM-ADV — Sistema de Advocacia em Massa

Plataforma interna para o escritório: login individual por colaborador, cadastro
de teses jurídicas reutilizáveis, geração automatizada de petições iniciais e
consulta de jurimetria nos tribunais brasileiros a partir da API pública do
DataJud (CNJ). Construído para rodar inteiramente na Cloudflare (Workers + D1),
com deploy automatizado via GitHub Actions.

## Arquitetura

```
GitHub (repositório) --push--> GitHub Actions --wrangler deploy--> Cloudflare Workers
                                                                        |
                                                            Cloudflare D1 (SQLite)
                                                                        |
                                                    Worker serve API (/api/*) + assets estáticos (/public)
```

- **Backend**: [Hono](https://hono.dev) rodando em Cloudflare Workers (`src/`).
- **Banco de dados**: Cloudflare D1 (`migrations/`).
- **Autenticação**: login e senha por colaborador (bcrypt) + sessão via JWT
  (`jose`), sem dependência de serviços externos de identidade.
- **Frontend**: páginas HTML/CSS/JS estáticas (`public/`), servidas como
  Cloudflare Workers Assets — sem necessidade de build de frontend.
- **Jurimetria**: integração com a **API Pública do DataJud** (CNJ), que
  cobre STJ, TST, TSE, STM, TRFs, TRTs, TJs e TREs.

### ⚠️ Limitação importante: o STF não está no DataJud

O DataJud é fundamentado na Resolução CNJ 331/2020, que abrange os órgãos do
art. 92, incisos **II a VII**, da Constituição — ou seja, **não inclui o STF**
(inciso I). Para jurisprudência do Supremo é necessário integrar futuramente
o portal próprio do tribunal. O sistema já sinaliza isso na tela de
Jurimetria.

Além disso, o DataJud fornece **metadados processuais** (classe, assuntos,
movimentações, órgão julgador, datas) — ideal para jurimetria (volume,
tempo de tramitação, distribuição por classe/órgão), mas **não é uma base de
inteiro teor de decisões**. Para pesquisa de jurisprudência em texto integral,
será necessário integrar futuramente os portais de jurisprudência de cada
tribunal.

## Estrutura do projeto

```
src/
  index.ts              # entrada do Worker (rotas + assets)
  routes/                # auth, usuarios, teses, clientes, casos, peticoes, jurimetria
  services/
    peticaoTemplate.ts   # motor de geração da petição inicial
    datajud.ts           # cliente da API pública do DataJud
    tribunais.ts         # tabela de tribunais/aliases
  middleware/auth.ts      # JWT + RBAC (admin/advogado/estagiario)
migrations/0001_init.sql  # schema do D1
public/                   # frontend estático (login, dashboard, teses, casos, jurimetria, colaboradores)
scripts/seed-admin.mjs    # cria o primeiro usuário administrador
```

## Passo a passo de configuração (Cloudflare)

Pré-requisitos: conta Cloudflare, Node.js 20+, e login feito com
`npx wrangler login`.

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Criar o banco D1**
   ```bash
   npx wrangler d1 create lm_adv_db
   ```
   Copie o `database_id` retornado e cole em `wrangler.toml` no lugar de
   `REPLACE_WITH_D1_DATABASE_ID`.

3. **Aplicar as migrações**
   ```bash
   npm run db:migrate:local   # ambiente local (wrangler dev)
   npm run db:migrate:remote  # banco de produção na Cloudflare
   ```

4. **Configurar os secrets do Worker**
   ```bash
   npx wrangler secret put JWT_SECRET
   # cole uma string aleatória longa (ex.: gerada com `openssl rand -base64 48`)

   npx wrangler secret put DATAJUD_API_KEY
   # obtenha a chave pública vigente em https://datajud-wiki.cnj.jus.br/api-publica/
   # (o CNJ publica e roda essa chave periodicamente; ela é pública por design)
   ```

5. **Criar o primeiro administrador**
   ```bash
   npm run seed:admin -- --local   # para testar em `wrangler dev`
   npm run seed:admin -- --remote  # para o banco de produção
   ```
   O script pede nome, e-mail, senha e OAB, e insere o usuário com papel
   `admin`. A partir daí, o próprio administrador cria os demais colaboradores
   pela tela **Colaboradores** dentro do sistema.

6. **Rodar localmente**
   ```bash
   npm run dev
   ```
   Acesse `http://localhost:8787`.

7. **Deploy manual (opcional)**
   ```bash
   npm run deploy
   ```

## Deploy automático via GitHub Actions

O workflow `.github/workflows/deploy.yml` roda `typecheck`, aplica as
migrações no D1 remoto e faz `wrangler deploy` a cada push em `main`.

Configure no repositório (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — token com permissão de "Edit Workers" e "Edit D1"
  na sua conta Cloudflare.
- `CLOUDFLARE_ACCOUNT_ID` — ID da conta Cloudflare (aparece no painel).

Depois de configurar, o e-mail/senha de cada colaborador e a chave do DataJud
continuam vivendo apenas como **secrets do Worker** (`wrangler secret put`),
nunca no repositório.

## Domínio próprio

No painel da Cloudflare, em **Workers & Pages → lm-adv → Settings →
Domains & Routes**, adicione o domínio/subdomínio do escritório (ex.:
`peticoes.seuescritorio.com.br`) apontando um registro CNAME para o Worker.

## Fluxo de uso

1. Um administrador cadastra as **teses jurídicas** do escritório: a
   fundamentação ("Do Direito") e os pedidos padrão que já são usados em
   casos semelhantes.
2. O colaborador cadastra o **cliente** e abre um **caso**, vinculando a
   tese aplicável, os fatos específicos e pedidos adicionais.
3. Com um clique, o sistema **gera a petição inicial**, combinando
   endereçamento, qualificação, fatos do caso, a fundamentação da tese e os
   pedidos (padrão + específicos).
4. Antes de peticionar, o colaborador pode consultar a **jurimetria** do
   tribunal de destino (volume de processos, distribuição por classe e por
   órgão julgador) para embasar a estratégia processual.

## Próximos passos sugeridos

- Exportar a petição gerada em `.docx`/PDF (hoje ela é gerada como texto
  estruturado, pronto para copiar para o editor de peças do escritório).
- Registrar auditoria (log de quem gerou/editou cada petição).
- Permissões mais granulares por área do direito ou por unidade do escritório.
- Integração com um provedor de assinatura eletrônica.
- Fonte de jurisprudência em texto integral (STF, STJ, TJs) para
  enriquecer a fundamentação além da jurimetria de metadados do DataJud.
