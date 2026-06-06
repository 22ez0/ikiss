# LEIA AQUI — Deploy, APIs e tokens deste projeto

Este arquivo documenta para o agente (Replit Agent) e para qualquer dev que assumir o projeto **como o deploy do Faren funciona** e **quais credenciais já estão autorizadas** para automatizar deploy, DNS e versionamento. Assim o agente não precisa pedir confirmação a cada operação.

> ⚠️ As credenciais reais NÃO ficam neste arquivo. Elas estão armazenadas como **Secrets** do Replit. Este documento só descreve o que cada uma faz.

---

## Subir o projeto inteiro localmente no Replit (faça isso PRIMEIRO ao abrir a sessão)

Quando outro agente abrir o workspace, o frontend e a API **já estão configurados como artifacts**, mas os workflows podem estar parados e o Postgres local pode estar sem schema. Pra ver o site funcionando no preview da Canvas (rodando 100% local, sem depender do Render), execute exatamente nesta ordem:

### 1. Aplicar o schema no Postgres local (uma vez por workspace)

O Replit já provê `DATABASE_URL` apontando pro Postgres da sandbox. As tabelas precisam ser criadas com Drizzle:

```bash
pnpm --filter @workspace/db run push
```

Esperado: `[✓] Changes applied`. Se o `discover/trending` retornar HTML 500 com `Failed query: select "profiles"…`, é sinal de que o schema não foi aplicado — rode esse comando.

### 2. Iniciar os workflows dos artifacts

Use a ferramenta de workflows do agente (não rode `pnpm dev` em background no shell). Os workflows são:

| Workflow                                   | Artifact            | Porta local | Preview path |
| ------------------------------------------ | ------------------- | ----------- | ------------ |
| `artifacts/api-server: API Server`         | `artifacts/api-server` | 8080        | `/api`       |
| `artifacts/faren: web`                     | `artifacts/faren`   | 21395       | `/`          |
| `artifacts/mockup-sandbox: Component Preview Server` | `artifacts/mockup-sandbox` | — | `/__mockup` |

O `mockup-sandbox` só precisa subir se for trabalhar na Canvas com variações de UI; o site em si só precisa de `api-server` + `faren: web`.

### 3. Como funciona o roteamento da API no preview (modo padrão: prod em tempo real)

**Por padrão, o preview do Faren mostra os dados REAIS da produção em tempo real.** Isso é o que o dono do projeto quer — abrir o preview e ver o site igualzinho `ikiss.me`, com os usuários reais, perfis, trending etc.

A pegadinha: o frontend rodando no preview é servido pelo **workspace proxy do Replit** (porta 80). Quando o JS faz `fetch("/api/...")`, a request **não vai pro Vite** (porta 21395) — vai pro workspace proxy, que olha o `artifact.toml` de cada artifact e roteia o path pro artifact dono. O `api-server` declara `paths = ["/api"]`, então tudo `/api/*` cai nele (porta 8080). Logo, configurar só o `vite.config.ts` proxy **não é suficiente** — o browser nem encosta no Vite pras chamadas `/api/*`.

A solução montada: em **dev**, o `api-server` **não sobe o backend de verdade**. Ele roda `node dev-proxy.mjs` (ver `artifacts/api-server/dev-proxy.mjs`), que é um mini-proxy HTTP que repassa **toda** request `/api/*` pra `https://api.ikiss.me` (que por sua vez vai pelo Cloudflare → Render) com `User-Agent: ikiss-replit-dev-proxy/1.0` (escapa do `botBlock`). Isso está configurado em `artifacts/api-server/.replit-artifact/artifact.toml`:

```toml
[services.development]
run = "node dev-proxy.mjs"
```

A produção segue intocada — o `[services.production.run]` continua subindo o `dist/index.mjs` real no Render.

Como reforço (e pra cobrir o caso de alguém abrir `http://localhost:21395` direto, sem passar pelo workspace proxy), o `artifacts/faren/vite.config.ts` também tem um proxy Vite redundante que faz a mesma coisa:

```ts
server: {
  proxy: {
    "/api": {
      target: process.env.VITE_DEV_API_PROXY ?? "https://api.ikiss.me",
      changeOrigin: true,
      secure: true,
      headers: { "User-Agent": "ikiss-replit-dev-proxy/1.0" },
    },
  },
}
```

Combinado com `VITE_API_URL = ""` em `artifacts/faren/.replit-artifact/artifact.toml` (que sobrescreve o `userenv` do `.replit`), o frontend chama URLs relativas (`/api/...`) e tanto o caminho via workspace proxy quanto direto no Vite caem na prod. O `setBaseUrl` em `lib/api-client-react/src/custom-fetch.ts` só faz prepend quando `_baseUrl` é truthy, então com `""` ele fica `null` e mantém o path relativo.

#### Quero rodar contra a API LOCAL (não a prod)

Se for trabalhar mexendo na API e quiser desenvolver totalmente isolado da prod:

1. Aplicar o schema (passo 1 acima — `pnpm --filter @workspace/db run push`).
2. Trocar o `run` do `[services.development]` no `artifact.toml` do `api-server` de `"node dev-proxy.mjs"` pra `"pnpm --filter @workspace/api-server run dev"` (ver "Editar `artifact.toml`" abaixo). Isso volta a subir o backend Express real na 8080.
3. (Não precisa mexer no Vite proxy.) Reiniciar o workflow `artifacts/api-server: API Server`.

O banco local começa **vazio** e não há seed automático. Pra testar com dados, crie um usuário pelo fluxo da própria UI (`/criar-seu-link`) ou injete via SQL direto. **Nunca** copie dados da prod (Render) pro local — não há fluxo aprovado pra isso.

### 4. Validar

```bash
# pelo workspace proxy (caminho que o browser usa de verdade no preview)
curl -s http://localhost:80/api/healthz                          # esperado: {"status":"ok"}
curl -s "http://localhost:80/api/discover/trending?limit=3"      # esperado: dados reais da prod

# direto no Vite (rota redundante de fallback)
curl -s http://localhost:21395/api/healthz
```

> Pode demorar 30-60s no 1º hit por causa do cold start do Render free tier — depois cai pra ms.

Tirar screenshot do artifact `faren` deve mostrar a landing page **igual à prod** (`ikiss.me`), sem erros vermelhos no console (o "Audio init failed" é benigno e não tem relação com a API).

> ⚠️ **Cold start do Render free tier:** se o trending/discover demorar 30-60s na primeira chamada após o site ficar parado, é normal. As chamadas seguintes voltam em milissegundos. Não confunda com bug.

### Editar `artifact.toml` (se precisar)

Você é proibido de editar `artifact.toml` diretamente. Pra mudar algo (ex: env var, porta), copie pra um `_pending.toml` na mesma pasta `.replit-artifact/` (precisa estar no workspace, não em `/tmp` — `verifyAndReplaceArtifactToml` falha com `EXDEV` em cross-device) e use a callback `verifyAndReplaceArtifactToml` no code execution sandbox com **caminhos absolutos**:

```js
await verifyAndReplaceArtifactToml({
  tempFilePath: "/home/runner/workspace/artifacts/faren/.replit-artifact/_pending.toml",
  artifactTomlPath: "/home/runner/workspace/artifacts/faren/.replit-artifact/artifact.toml"
});
```

---

## Como o deploy funciona (visão geral)

O Faren tem duas peças em produção:

| Peça        | Onde roda                  | Como é deployado                                                              |
| ----------- | -------------------------- | ------------------------------------------------------------------------------ |
| **Frontend** (`artifacts/faren`) | **GitHub Pages** (CNAME `ikiss.me`) | GitHub Action `.github/workflows/deploy-frontend.yml` builda e publica em todo push pra `main` |
| **API / Backend** (`artifacts/api-server`) | **Render** (`ikiss-api.onrender.com`), exposta publicamente como `https://api.ikiss.me` via Cloudflare proxied | Render está conectado ao repo e tem `autoDeploy: true` no `render.yaml` — auto-deploya em todo push pra `main` que toque `artifacts/api-server/**`, `lib/**`, `pnpm-lock.yaml` ou `render.yaml` |

**Cloudflare** é usado como **DNS + CDN/proxy + cache de API + Worker de proxy/OG/keep-alive** da zona `ikiss.me`. Existe SIM um Cloudflare Worker chamado **`ikiss-og-worker`** rodando na rota `ikiss.me/*` (deployado em 2026-04-19). Ele faz três coisas: (1) proxia `/api/*` pra `https://ikiss-api.onrender.com` com cache de borda (90s pra `/api/discover/trending`, 20s pra `/api/users/:u`, header `X-Edge-Cache: HIT/MISS`, conserta CORS pra origens `*.ikiss.me`); (2) detecta UAs de bots sociais em paths de perfil `/{username}` e busca `${API}/${username}` pra renderizar a OG preview server-side com `cache-control: public, max-age=60, swr=300`; (3) tem um `scheduled()` que pinga `${API}/api/discover/trending?limit=1` a cada ~14 minutos pra evitar cold start do Render free. O fonte está versionado em `cloudflare-worker.js` na raiz do repo, mas o que está deployado no edge é uma versão MAIS COMPLETA — pra ver o código real, use `curl -H "X-Auth-Email: $EMAIL_CLOUDFLARE" -H "X-Auth-Key: $CLOUDFLARE_GLOBAL_API_KEY" "https://api.cloudflare.com/client/v4/accounts/$R2_ACCOUNT_ID/workers/scripts/ikiss-og-worker"`. As Cache Rules abaixo ainda existem na zona mas são em parte redundantes com o cache do Worker. DNS atual:

- `ikiss.me` (apex) → 4 IPs do GitHub Pages, **proxied**
- `www.ikiss.me` → `22ez0.github.io`, **proxied**
- `api.ikiss.me` → `ikiss-api.onrender.com`, **proxied** (toda API pública passa por aqui)

Como o `api.ikiss.me` é proxied, o Cloudflare tá no caminho de toda chamada de API e aplica as **Cache Rules** abaixo (zone ruleset id `92b59739dd254ee8813db04ed79f6e0d`):

| Path                  | Edge TTL | Browser TTL | Por quê                                                                 |
|-----------------------|----------|-------------|-------------------------------------------------------------------------|
| `/api/users/*`        | 20s      | bypass      | Perfil pode ter mudança recente; TTL curto pra evitar dado obsoleto     |
| `/api/discover/*`     | 60s      | 30s         | Trending muda devagar; TTL maior derruba 95% do tráfego do Render       |

Efeito prático: 1º hit é `MISS` (vai no Render), todos os hits seguintes em 60s viram `HIT` em ~700ms (sem encostar no Render). Isso é o que mantém o site responsivo mesmo com Render free dormindo. Depois de mudança grande em perfil/trending, faz **purge de cache** no Cloudflare pra invalidar manualmente.

Pra inspecionar/criar/editar cache rules via API:

```bash
ZONE=3f8e4388690c7690170ce02480edb571
RULESET=92b59739dd254ee8813db04ed79f6e0d
# listar
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/$RULESET" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | node -e '...'
# adicionar (POST /rules) ou editar (PATCH /rules/<id>)
```

### Fluxo padrão "publicar mudanças no site"

1. **Commit + push pra `main`** no GitHub → dispara automaticamente:
   - GitHub Action que builda o frontend e publica no GitHub Pages
   - Webhook do Render que rebuilda e republica a API (se mexeu em arquivos de backend)
2. **(Opcional)** Purge de cache no Cloudflare pra o `ikiss.me` atualizar imediatamente
3. Pronto — em ~2-5 min `ikiss.me` reflete as mudanças

---

## Secrets configurados

| Secret name           | Serviço     | Para que serve                                                                                                  |
| --------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`        | GitHub      | Push de commits para `https://github.com/22ez0/ikiss` (branch `main`). Usado em `git push https://22ez0:$GITHUB_TOKEN@github.com/22ez0/ikiss.git main` |
| `CLOUDFLARE_API_TOKEN`| Cloudflare  | Token "principal" da zona `ikiss.me` (zone id `3f8e4388690c7690170ce02480edb571`): DNS, leitura, etc. **Não tem** permissão de Cache Purge — para purgar use `CLOUDFLARE_PURGE_TOKEN`. |
| `CLOUDFLARE_PURGE_TOKEN`| Cloudflare | Token **dedicado a purgar o cache** da mesma zona (`Zone.Cache Purge`). É o token usado pelo passo de purge no fim do deploy do frontend. |
| `RENDER_API_KEY`      | Render      | Disparar deploys e ler status do service `srv-d7gjdc5ckfvc73ftk79g` (`ikiss-api.onrender.com`)             |
| `R2_ACCOUNT_ID`       | Cloudflare R2 | Account ID `5a9a17dc69ada45f32c4aa36d4e8fdd9` — endpoint S3-compatível: `https://<accountId>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | Credenciais S3-compatible (token "Object Read & Write") usadas pelo backend pra fazer upload de avatares/backgrounds |
| `R2_BUCKET`           | Cloudflare R2 | Nome do bucket: `faren-media`                                                                                   |
| `R2_PUBLIC_URL`       | Cloudflare R2 | URL pública do bucket: `https://pub-49759bd8e09c4e0b89e475d23d273d2f.r2.dev` (R2.dev subdomain). Pode ser trocado depois por `cdn.ikiss.me` se quiser custom domain |
| `PROD_DATABASE_URL`   | Render Postgres | Connection string do Postgres de **produção** (External Database URL do Render). **NÃO** é o `DATABASE_URL` da sandbox local. Usado apenas pra rodar scripts de manutenção/migração contra prod a partir do Replit. |

---

## Storage de mídias (Cloudflare R2)

Avatares e backgrounds dos usuários ficam em **Cloudflare R2** (bucket `faren-media`), não em base64 dentro do Postgres. O upload é S3-compatible via `@aws-sdk/client-s3`.

- **Lib:** `artifacts/api-server/src/lib/r2.ts` (cliente, `parseDataUri()`, `uploadBuffer()`).
- **Estrutura de chaves:**
  - `avatars/<userId>/<sha256-16>.<ext>`
  - `backgrounds/<userId>/<sha256-16>.<ext>`
- **Cache:** todo objeto sobe com `Cache-Control: public, max-age=31536000, immutable`. Como a chave é hash do conteúdo, mudou a imagem → muda a URL → invalidação automática.
- **URL pública:** `${R2_PUBLIC_URL}/<key>`.

### Migração one-shot base64 → R2 (já executada em 24/04/2026)

Resultado: 9 avatares (~9 MB) + 6 backgrounds (~15 MB) movidos. Postgres ficou ~24 MB mais leve. Validação:

```bash
cd artifacts/api-server && cat > _check.cjs <<'EOF'
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const a = await pool.query("SELECT count(*) FILTER (WHERE avatar_url LIKE 'data:%') AS b64, count(*) FILTER (WHERE avatar_url LIKE 'http%') AS url FROM users");
  const b = await pool.query("SELECT count(*) FILTER (WHERE background_url LIKE 'data:%') AS b64, count(*) FILTER (WHERE background_url LIKE 'http%') AS url FROM profiles");
  console.log('users:', a.rows[0]); console.log('profiles:', b.rows[0]);
  await pool.end();
})();
EOF
node _check.cjs && rm _check.cjs
```

Se aparecer `b64 > 0` no futuro (alguém ainda salvou data URI direto), rodar de novo o script `artifacts/api-server/src/scripts/migrate-base64-to-r2.ts` ou o `_migrate.cjs` (template no histórico do PR).

> ⚠️ **Backend ainda aceita base64 no `PATCH /api/profile`** (campos `avatarUrl` / `backgroundUrl`). O ideal a seguir é trocar pra upload multipart que joga direto no R2 e devolve a URL — ver `Próximos passos` no fim do arquivo.

---

## Comandos típicos que o agente pode executar sem precisar perguntar

> ⚠️ **Importante:** comandos de **git que escrevem** (`git add`, `git commit`, `git push`, `git reset`, etc.) são **bloqueados pelo agente principal** por segurança. Pra fazer um push, o agente precisa criar uma **Project Task** em background — só ela tem permissão pra essas operações. Os comandos `curl` pra Render/Cloudflare abaixo funcionam normalmente.

### Push pro GitHub (via Project Task em background)
```bash
git add -A
git commit -m "mensagem"
git push https://22ez0:$GITHUB_TOKEN@github.com/22ez0/ikiss.git main
```
Após o push:
- O workflow `deploy-frontend.yml` builda e publica `ikiss.me` no GitHub Pages
- Se o push tocou `artifacts/api-server/**`, `lib/**`, `pnpm-lock.yaml` ou `render.yaml`, o Render auto-deploya a API

### Disparar deploy manual no Render (sem precisar de novo push)
```bash
curl -sX POST "https://api.render.com/v1/services/srv-d7gjdc5ckfvc73ftk79g/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}'
```

### Ver status do último deploy do Render
```bash
curl -s "https://api.render.com/v1/services/srv-d7gjdc5ckfvc73ftk79g/deploys?limit=1" \
  -H "Authorization: Bearer $RENDER_API_KEY"
```

### Listar registros DNS no Cloudflare
```bash
curl -s "https://api.cloudflare.com/client/v4/zones/3f8e4388690c7690170ce02480edb571/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

### Purge de cache no Cloudflare (após deploy)
```bash
curl -sX POST "https://api.cloudflare.com/client/v4/zones/3f8e4388690c7690170ce02480edb571/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_PURGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

> Use `CLOUDFLARE_PURGE_TOKEN` (não `CLOUDFLARE_API_TOKEN`) para purge — o token principal não tem essa permissão por design.

---

## Escopos dos tokens do Cloudflare

Existem **dois tokens separados** para a mesma zona `ikiss.me` (zone id `3f8e4388690c7690170ce02480edb571`), com escopos distintos por segurança (princípio do menor privilégio):

### `CLOUDFLARE_API_TOKEN` — token principal (DNS / leitura)

| Permission   | Resource                                | Para quê                    |
| ------------ | --------------------------------------- | --------------------------- |
| `Zone:Read`  | Specific zone → `ikiss.me`          | Verificar metadados da zona |
| `DNS:Edit`   | Specific zone → `ikiss.me`          | Criar/editar registros DNS  |

Esse token **não tem** `Cache Purge` por design — purge usa o token dedicado abaixo.

### `CLOUDFLARE_PURGE_TOKEN` — token dedicado a purge

| Permission         | Resource                                | Para quê                                          |
| ------------------ | --------------------------------------- | ------------------------------------------------- |
| **`Cache Purge`**  | Specific zone → `ikiss.me`          | Purgar o cache do CDN ao final de cada deploy     |

### Como gerar / rotacionar qualquer um dos tokens

1. Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token** → **Create Custom Token**
2. Adicione apenas as permissions da tabela correspondente (DNS ou Purge)
3. Em **Zone Resources** selecione **Include → Specific zone → `ikiss.me`**
4. Crie, copie o valor e atualize nos dois lugares:
   - **Replit Secrets** → `CLOUDFLARE_API_TOKEN` ou `CLOUDFLARE_PURGE_TOKEN`
   - **GitHub repo `22ez0/ikiss`** → Settings → Secrets and variables → Actions → mesmo nome (já cadastrados, basta atualizar)

### Como validar

```bash
# 1) Tokens estão ativos?
curl -s "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
curl -s "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer $CLOUDFLARE_PURGE_TOKEN"

# 2) O token de purge consegue mesmo purgar?
curl -sX POST "https://api.cloudflare.com/client/v4/zones/3f8e4388690c7690170ce02480edb571/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_PURGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
# esperado: "success":true
```

---

## Purge automático no GitHub Actions

A action `.github/workflows/deploy-frontend.yml` tem um passo final **`Purge Cloudflare cache`** que roda depois do deploy no GitHub Pages. Ele:

- Usa os secrets do GitHub **`CLOUDFLARE_PURGE_TOKEN`** e `CLOUDFLARE_ZONE_ID` (já cadastrados no repo `22ez0/ikiss`)
- Chama `POST /zones/$CF_ZONE/purge_cache` com `{"purge_everything":true}`
- Se o purge falhar por qualquer motivo, emite um **warning** mas **não falha o deploy** — o site continua sendo publicado e só o purge é pulado
- Quando o purge falha, o passo seguinte **`Notify on Cloudflare purge failure`** abre (ou comenta, se já estiver aberta) uma issue no `22ez0/ikiss` com o label `cloudflare-purge-failure`, contendo o HTTP status, o corpo da resposta da Cloudflare, o commit e o link da run — assim ninguém precisa ficar olhando o log do Actions para perceber que o cache não foi limpo

## Alerta automático quando o deploy do backend (Render) falha

A action `.github/workflows/deploy-backend.yml` segue o **mesmo padrão** do alerta de purge da Cloudflare, mas para o deploy real do backend no Render. Como o Render tem `autoDeploy: true` e dispara o build via webhook nativo (não pelo Actions), o workflow:

- Usa o secret do GitHub **`RENDER_API_KEY`** (mesmo valor do Replit Secret de mesmo nome — precisa estar cadastrado em `Settings → Secrets and variables → Actions` do repo `22ez0/ikiss`)
- Espera até ~90s pra achar o deploy do Render cujo `commit.id` bate com o `github.sha` do push. Se não achar, **só** cai no fallback de "pegar o deploy mais recente" quando o workflow foi disparado manualmente (`workflow_dispatch`); em pushes reais a gente prefere abortar o monitoramento e logar warning, pra não atrelar o alerta a um deploy de outro commit (corrida em pushes consecutivos)
- Faz polling em `GET /v1/services/$SERVICE_ID/deploys/$DEPLOY_ID` por até ~25 minutos até o status virar terminal (`live`, `deactivated`, `build_failed`, `update_failed`, `pre_deploy_failed`, `canceled`)
- Se o status final for `live` (sucesso) ou `deactivated` (substituído por outro deploy mais novo), não faz nada
- Se for `build_failed`, `update_failed`, `pre_deploy_failed` ou `canceled` (ou se o polling estourar o timeout), o passo **`Notify on Render deploy failure`** abre (ou comenta) uma issue no `22ez0/ikiss` com o label `render-deploy-failure`, contendo o `deploy id`, o status final, o commit, o link da run do GitHub Actions e o link `https://dashboard.render.com/web/$SERVICE_ID/deploys/$DEPLOY_ID` pra ir direto nos logs
- O workflow **nunca falha o push pra `main`** — `exit 0` em todos os casos, igual o de purge

---

## Alerta automático quando a API fica fora do ar (mesmo após deploy bem-sucedido)

O alerta de `render-deploy-failure` só dispara quando o **build** do Render quebra. Mas o plano free do Render **derruba a instância depois de inatividade** e às vezes ela não volta sozinha (cold start travado, healthcheck falhando, banco indisponível). Pra esses casos a action `.github/workflows/monitor-api-health.yml` faz monitoramento ativo:

- Roda em cron `*/5 * * * *` (a cada 5 min, mais ou menos — o scheduler do GitHub Actions costuma atrasar alguns minutos em horários de pico, sem problema)
- Em cada execução, bate em `https://ikiss-api.onrender.com/api/healthz` até 5 vezes seguidas com 30s entre tentativas (≈2 min de janela). Só considera "fora do ar" se **todas** falharem — assim absorve cold start normal do plano free sem gerar falso positivo
- Aceita como saudável apenas `HTTP 200` com `"ok"` no corpo (o endpoint retorna `{"status":"ok"}`)
- Manda um **User-Agent custom** (`ikiss-uptime-monitor/1.0 …`) porque o middleware `botBlock` em `artifacts/api-server/src/app.ts` devolve 403 pra User-Agents que casem com `/curl|wget|python-requests|headless|playwright|…/i` quando `ENABLE_BOT_BLOCKING=true` (caso da prod). Sem esse UA o monitor virava falso positivo eterno. Se um dia quiser endurecer mais o `blockedUserAgents`, lembre de manter o prefixo `ikiss-uptime-monitor` fora da regex (ou exempte explicitamente o path `/api/healthz`)
- Se ficar fora do ar e **não houver** issue aberta com o label `api-down`, abre uma nova issue em `22ez0/ikiss` com título `API fora do ar (ikiss-api.onrender.com)`, contendo o último HTTP status visto, primeiros 500 chars do corpo, link da run e link do dashboard do Render
- Se já houver issue aberta com esse label, **não comenta de novo** — evita ruído enquanto a API continua caída
- Quando o healthz volta a responder `200 ok` e existe issue aberta, comenta "API voltou" + link da run e **fecha a issue** automaticamente
- Usa só o `GITHUB_TOKEN` padrão (permissão `issues: write`) — **não precisa** de `RENDER_API_KEY` nem secret extra
- `concurrency: monitor-api-health` com `cancel-in-progress: false` evita execuções simultâneas se uma demorar mais que 5 min

---

## Arquivos de configuração de deploy (no repo)

- **`.github/workflows/deploy-frontend.yml`** — builda `@workspace/faren` com `VITE_API_URL=https://ikiss-api.onrender.com` e publica em `gh-pages` com CNAME `ikiss.me`
- **`.github/workflows/deploy-backend.yml`** — o Render auto-deploya via webhook nativo; o workflow então **fica fazendo polling na API do Render** (usa o secret `RENDER_API_KEY`) e, se o deploy terminar em `build_failed`, `update_failed`, `pre_deploy_failed` ou `canceled`, abre/atualiza uma issue no `22ez0/ikiss` com o label `render-deploy-failure` (mesmo padrão da `cloudflare-purge-failure`). A issue inclui o `deploy id`, o status final, o link dos logs no dashboard do Render e o commit. O workflow nunca falha o push pra `main`. Roda quando muda `artifacts/api-server/**`, `lib/**`, `pnpm-lock.yaml` ou `render.yaml`
- **`.github/workflows/monitor-api-health.yml`** — cron a cada 5 min que faz `GET /api/healthz` em produção (5 retries × 30s). Se ficar fora do ar abre issue com label `api-down` em `22ez0/ikiss`; quando volta, comenta e fecha. Pega cold start travado, healthcheck quebrado e banco indisponível — coisas que o `deploy-backend.yml` não detecta porque o build em si passou
- **`render.yaml`** — define o service `faren-api` (Node, região Oregon, plano free, healthcheck `/api/healthz`) e todas as env vars de produção — adaptado para ikiss.me

---

## IDs úteis

- **GitHub repo**: `22ez0/ikiss` (branch principal: `main`)
- **GitHub Pages CNAME**: `ikiss.me`
- **Render service id (api)**: `srv-d7gjdc5ckfvc73ftk79g`
- **Render service URL (api)**: `https://ikiss-api.onrender.com`
- **Render Postgres (db)**: `faren-db` (definido no `render.yaml`)
- **Cloudflare zone id**: `3f8e4388690c7690170ce02480edb571`
- **Cloudflare zone name**: `ikiss.me` (uso: DNS + CDN — **não** há Worker)

---

## Permissão explícita do dono

O dono do projeto (22ez0) autorizou explicitamente o uso destes tokens para automação. O agente pode rodar push (via Project Task), deploy manual no Render e operações de DNS/purge no Cloudflare **sem pedir confirmação adicional**.
