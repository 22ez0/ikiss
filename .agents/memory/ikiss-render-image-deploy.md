---
name: Ikiss Render service is image-based, not git-based
description: How to find/redeploy the real Render service for Ikiss API when docs are stale
---

The Ikiss API's real Render service is `ikiss-api` (env: `image`, pulls `ghcr.io/22ez0/ikiss-api:latest`), not the old `faren-api` git-connected service documented in SETUP.md/replit.md — that one was destroyed when the account was suspended in 2026-04 and recreated later as an image-deploy service with a new ID.

**Why:** Because it's image-based, pushing a new GHCR image (via `build-docker.yml`) does not always trigger an automatic Render redeploy — the live deploy can silently lag behind the latest built image for days, serving stale code (e.g. missing routes/features) even though the git repo and CI look fine.

**How to apply:** When behavior in prod doesn't match the current repo code (e.g. a route/feature "doesn't work" in prod but looks correct in source), check `GET /v1/services` (needs a working `RENDER_API_KEY` scoped to the right account — the account is `tea-d94lhg8js32c73epf53g`) for the current service id, compare the latest successful `build-docker.yml` run's timestamp against the service's latest deploy timestamp, and trigger `POST /v1/services/{id}/deploys` manually if the deploy is older than the image build.
