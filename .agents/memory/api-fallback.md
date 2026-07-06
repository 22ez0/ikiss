---
name: API fallback URL no frontend
description: home.tsx e register.tsx precisam de fallback explícito para https://api.ikiss.me quando VITE_API_URL não está definido em runtime.
---

# Fallback de URL da API no frontend

**Regra:** Qualquer `fetch` no frontend que usa `import.meta.env.VITE_API_URL` precisa ter fallback explícito para `https://api.ikiss.me`, não para string vazia ou `BASE_URL`.

**Por quê:** O frontend é hospedado no GitHub Pages (domínio estático). Se `VITE_API_URL` for vazio, as chamadas viram URLs relativas (`/api/users/foo`) que vão para o GitHub Pages — não para a API Express. GitHub Pages retorna 404 ou erro, causando "ERRO AO VERIFICAR" na verificação de username e "Failed to fetch" no cadastro.

`BASE_URL` do Vite é `/` em produção no GitHub Pages — também não funciona como base para API externa.

**Padrão correto:**
```ts
// home.tsx - username check
const apiBase = (import.meta.env.VITE_API_URL || 'https://api.ikiss.me').replace(/\/+$/, '');

// register.tsx - API base
const API_BASE = `${(import.meta.env.VITE_API_URL || 'https://api.ikiss.me').replace(/\/+$/, "")}/api`;
```

**Nota:** O CI do GitHub Actions (`deploy-frontend.yml`) já define `VITE_API_URL=https://api.ikiss.me` no build. O fallback protege contra builds locais sem essa var, e contra qualquer caso onde a var seja perdida.

**How to apply:** Ao adicionar qualquer novo fetch que use `VITE_API_URL` no frontend, sempre usar `|| 'https://api.ikiss.me'` como fallback, nunca `|| ''` ou `|| import.meta.env.BASE_URL`.
