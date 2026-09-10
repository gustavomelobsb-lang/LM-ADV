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

## Captação de leads do Instagram (mensagens diretas)

O sistema recebe automaticamente as mensagens diretas (DM) enviadas para a
conta profissional do Instagram do escritório e transforma cada novo
contato em um **lead** (tela **Leads Instagram**), com histórico de
conversa, resposta direto pelo sistema e conversão em cliente com um clique.

Isso usa a **Instagram API with Instagram Login** da Meta. Só funciona com
contas **Instagram profissionais** (Business ou Creator) e exige um App
criado por você no Meta for Developers — não é algo que se configura sem
essa etapa manual.

### Passo a passo para ativar

1. **Converter a conta do Instagram** do escritório para Business ou
   Creator (Configurações → Conta → Mudar para conta profissional), caso
   ainda não seja.

2. **Criar um App** em https://developers.facebook.com/apps → "Criar app"
   → tipo "Business" → adicionar o produto **"Instagram"** (Instagram API
   with Instagram Login / Business Login for Instagram).

3. Nas configurações do produto Instagram do App, cadastre a **Valid OAuth
   Redirect URI**:
   ```
   https://SEU-DOMINIO-OU-SUBDOMINIO.workers.dev/instagram-callback.html
   ```

4. Configure o **Webhook** do produto Instagram apontando para:
   ```
   https://SEU-DOMINIO-OU-SUBDOMINIO.workers.dev/api/instagram/webhook
   ```
   Use como "Verify Token" o mesmo valor que você vai colocar no secret
   `META_WEBHOOK_VERIFY_TOKEN` (passo 6). Assine o campo `messages` para
   receber as mensagens diretas.

5. Anote o **App ID** e o **App Secret** (Configurações básicas do App).

6. Configure os secrets do Worker:
   ```bash
   npx wrangler secret put META_APP_ID
   npx wrangler secret put META_APP_SECRET
   npx wrangler secret put META_WEBHOOK_VERIFY_TOKEN
   # esse ultimo pode ser qualquer string aleatoria que voce escolher
   ```
   (Ou, via GitHub Actions, adicione esses 3 como Repository Secrets e rode
   o workflow `bootstrap.yml` de novo.)

7. Como administrador, acesse a tela **Conectar Instagram** dentro do
   sistema e autorize o acesso com a conta profissional do escritório.

### ⚠️ Sobre o App Review da Meta

Enquanto o App estiver em modo de desenvolvimento, só contas cadastradas
como **testadoras** no próprio painel do App conseguem conectar e trocar
mensagens. Para usar com a conta real do escritório em produção (e
receber mensagens de qualquer pessoa que escrever no Instagram), a Meta
exige passar pelo **App Review**, solicitando a permissão avançada
(_Advanced Access_) de `instagram_business_manage_messages` — processo
feito diretamente no painel da Meta e que foge do escopo deste
repositório. Sem isso, a integração funciona apenas em modo de teste.

## Estrutura do projeto

```
src/
  index.ts              # entrada do Worker (rotas + assets)
  routes/                # auth, usuarios, teses, clientes, casos, peticoes,
                          # jurimetria, instagram, leads
  services/
    peticaoTemplate.ts   # motor de geração da petição inicial
    datajud.ts           # cliente da API pública do DataJud
    tribunais.ts         # tabela de tribunais/aliases
    instagram.ts         # cliente da Instagram Messaging API (OAuth, envio, webhook)
  middleware/auth.ts      # JWT + RBAC (admin/advogado/estagiario)
migrations/               # schema do D1 (0001 core, 0002 leads/Instagram)
public/                   # frontend estático (login, dashboard, teses, casos,
                          # jurimetria, colaboradores, leads, conexão Instagram)
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
