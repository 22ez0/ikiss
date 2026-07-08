---
name: R2 CDN proxy
description: Por que a API serve arquivos R2 via /api/cdn/* em vez de URL pública do bucket
---

## Regra
O bucket R2 **não tem acesso público habilitado**. Nunca usar `pub-*.r2.dev` diretamente — não funciona (retorna 401).

## Por quê
O bucket foi migrado de `faren-media` (não existe mais) para `ikiss-media`. O acesso público (`pub-*.r2.dev`) nunca foi reativado no painel Cloudflare R2 para o novo bucket.

## Como aplicar
- `R2_BUCKET=ikiss-media` em todos os ambientes
- `R2_PUBLIC_URL=https://api.ikiss.me/api/cdn` — aponta para a rota proxy da própria API
- A rota `/api/cdn/*` usa `router.use('/cdn', ...)` (não `/cdn/*` — path-to-regexp v8 exige parâmetro nomeado)
- Stream via `stream.pipeline()` com `Readable.from(body)` para async-iterable do AWS SDK v3
- Se o acesso público for ativado no painel Cloudflare R2: obter a URL `pub-*.r2.dev` do bucket `ikiss-media` e trocar `R2_PUBLIC_URL` — a rota `/api/cdn` pode ser removida ou mantida como fallback
