---
name: Vercel API key limitada
description: O VERCEL_API_KEY do Replit e VERCEL_TOKEN do GitHub não funcionam para criar projetos Vercel via REST API ou CLI — projeto precisa ser criado manualmente.
---

# Vercel API key — limitações confirmadas

**Por quê:** O token disponível tem escopo somente-leitura. Tentativas de criar projeto via REST API (`POST /v9/projects`, `/v10/projects`, `/v1/projects`) retornam `403 forbidden`. O CLI Vercel (`vercel deploy --token`) retorna "not valid token" com os mesmos tokens.

**Confirmado que funciona:**
- `GET /v2/user` — retorna info do usuário (ID: FxZIjVIAgQnBmrt8ojlQ7UK3, username: 22ez0)
- `GET /v9/projects` — retorna lista vazia (sem projetos, mas sem erro)

**Confirmado que não funciona:**
- `POST /v9/projects` → 403
- `vercel link --token` → "not valid token"
- `vercel deploy --token` → "not valid token"

**Como resolver:**
1. Criar projeto manualmente em vercel.com → New Project → importar 22ez0/ikiss
2. Gerar Personal Access Token em Vercel → Account Settings → Tokens (escopo Full Account)
3. Adicionar `VERCEL_PROJECT_ID` e atualizar `VERCEL_TOKEN` no GitHub Secrets
4. O workflow `.github/workflows/deploy-vercel.yml` usa REST API pura (sem CLI) e está pronto

**How to apply:** Toda vez que tentar automatizar criação de projeto Vercel via API/CLI com esses tokens — vai falhar. Sempre checar se o projeto já existe ou pedir ao usuário para criar manualmente.
