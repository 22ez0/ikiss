---
name: GitHub push auth
description: Como fazer git push autenticado no projeto ikiss (22ez0/ikiss)
---

# GitHub Push Auth

**Rule:** Usar `GITHUB_PERSONAL_ACCESS_TOKEN` (não `GITHUB_PAT`) com formato `x-access-token:<token>@github.com`.

**Why:** O secret `GITHUB_PAT` retorna 403 ("Permission denied to 22ez0"). O `GITHUB_PERSONAL_ACCESS_TOKEN` funciona.

**How to apply:**
```js
execSync(`git remote set-url origin https://x-access-token:${pat}@github.com/22ez0/ikiss.git`);
execSync(`git push origin main`);
execSync(`git remote set-url origin https://github.com/22ez0/ikiss.git`); // restaurar depois
```

Sempre restaurar a URL sem token após o push por segurança.
