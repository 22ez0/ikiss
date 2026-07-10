---
name: Never dump full env-var listings from third-party provider APIs
description: Lesson from accidentally printing live secret values into chat while debugging Render env vars
---

When inspecting a third-party provider's env vars via API (e.g. Render `GET /v1/services/{id}/env-vars`) for debugging, never print the full response including values — pipe/filter to keys only (or existence checks). Full values (DB URLs, API tokens, session secrets) can end up echoed directly into chat/logs, which counts as exposure and forces rotation of every printed secret.

**Why:** A Render env-vars dump was printed with real values in one debugging session, requiring the user to rotate R2 keys, Discord bot token, Resend key, session secret, Turnstile secret, Cloudflare purge token, and DB password.

**How to apply:** For any provider env-var/secrets listing endpoint, always transform the response to show only keys (e.g. `.map(e => e.envVar.key)`) before printing, never the values, even when debugging locally in a sandboxed shell.
