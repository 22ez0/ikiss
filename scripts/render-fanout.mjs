#!/usr/bin/env node
/**
 * Render multi-account fanout helper.
 *
 * Reads a list of Render API keys from RENDER_API_KEYS env var
 * (comma-separated) and performs the requested action against every account.
 *
 * Actions:
 *   list                    — list all services for every account
 *   set-env <KEY> <VALUE>   — set an env var on every ikiss-api service
 *   sync-env <FILE>         — read KEY=VALUE pairs from FILE and set on every service
 *   redeploy                — trigger a redeploy of every ikiss-api service
 *   health                  — hit /api/healthz on every service URL
 *
 * Examples:
 *   RENDER_API_KEYS=rnd_aaa,rnd_bbb node scripts/render-fanout.mjs list
 *   RENDER_API_KEYS=$KEYS node scripts/render-fanout.mjs sync-env .env.shared
 *   RENDER_API_KEYS=$KEYS node scripts/render-fanout.mjs redeploy
 *
 * The .env.shared file format (one per line, # = comment):
 *   DATABASE_URL=postgresql://...
 *   SESSION_SECRET=xxx
 *   ADMIN_SECRET=yyy
 */

import fs from "node:fs";

const API = "https://api.render.com/v1";
const KEYS = (process.env.RENDER_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
const SERVICE_NAME = process.env.RENDER_SERVICE_NAME || "ikiss-api";

if (KEYS.length === 0) {
  console.error("RENDER_API_KEYS is empty. Set it to a comma-separated list of Render API keys.");
  process.exit(1);
}

async function api(key, path, init = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}: ${typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
    err.status = r.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function findService(key) {
  const list = await api(key, `/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  const items = Array.isArray(list) ? list : (list.services || []);
  for (const item of items) {
    const svc = item.service || item;
    if (svc.name === SERVICE_NAME) return svc;
  }
  return null;
}

async function listAll() {
  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const owner = await api(key, "/owners");
      const ownerName = (owner[0]?.owner?.name || owner[0]?.owner?.email || "?");
      const list = await api(key, "/services?limit=50");
      const items = Array.isArray(list) ? list : (list.services || []);
      console.log(`\n[acct ${i + 1}/${KEYS.length}] owner=${ownerName}`);
      for (const item of items) {
        const svc = item.service || item;
        const url = svc.serviceDetails?.url || svc.serviceUrl || "(no url)";
        const suspended = svc.suspenders?.length ? ` SUSPENDED:${svc.suspenders.join(",")}` : "";
        console.log(`  ${svc.name.padEnd(20)} ${svc.type.padEnd(8)} ${url}${suspended}`);
      }
    } catch (e) {
      console.log(`[acct ${i + 1}/${KEYS.length}] ERROR: ${e.message}`);
    }
  }
}

async function setEnv(envKey, envValue) {
  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const svc = await findService(key);
      if (!svc) { console.log(`[acct ${i + 1}] no '${SERVICE_NAME}' service`); continue; }
      // PUT /v1/services/:id/env-vars/:key
      await api(key, `/services/${svc.id}/env-vars/${envKey}`, {
        method: "PUT",
        body: JSON.stringify({ value: envValue }),
      });
      console.log(`[acct ${i + 1}] set ${envKey}= (${envValue.length} chars) on ${svc.id}`);
    } catch (e) {
      console.log(`[acct ${i + 1}] ERROR set ${envKey}: ${e.message}`);
    }
  }
}

function parseEnvFile(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const k = trimmed.slice(0, i).trim();
    let v = trimmed.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

async function syncEnv(file) {
  const pairs = parseEnvFile(file);
  console.log(`Syncing ${Object.keys(pairs).length} env vars from ${file} to ${KEYS.length} accounts:`);
  console.log(`  keys: ${Object.keys(pairs).join(", ")}`);
  for (const [k, v] of Object.entries(pairs)) {
    await setEnv(k, v);
  }
}

async function redeployAll() {
  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const svc = await findService(key);
      if (!svc) { console.log(`[acct ${i + 1}] no '${SERVICE_NAME}' service`); continue; }
      const dep = await api(key, `/services/${svc.id}/deploys`, {
        method: "POST",
        body: JSON.stringify({ clearCache: "do_not_clear" }),
      });
      console.log(`[acct ${i + 1}] triggered deploy ${dep.id || dep.deploy?.id} on ${svc.id}`);
    } catch (e) {
      console.log(`[acct ${i + 1}] ERROR redeploy: ${e.message}`);
    }
  }
}

async function healthAll() {
  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const svc = await findService(key);
      if (!svc) { console.log(`[acct ${i + 1}] no '${SERVICE_NAME}' service`); continue; }
      const url = svc.serviceDetails?.url || svc.serviceUrl;
      if (!url) { console.log(`[acct ${i + 1}] no URL`); continue; }
      const t0 = Date.now();
      const r = await fetch(`${url}/api/healthz`, { signal: AbortSignal.timeout(15000) });
      console.log(`[acct ${i + 1}] ${url} → ${r.status} (${Date.now() - t0}ms)`);
    } catch (e) {
      console.log(`[acct ${i + 1}] ERROR health: ${e.message}`);
    }
  }
}

const cmd = process.argv[2];
const args = process.argv.slice(3);

if (cmd === "list") await listAll();
else if (cmd === "set-env") {
  if (args.length < 2) { console.error("usage: set-env KEY VALUE"); process.exit(1); }
  await setEnv(args[0], args.slice(1).join(" "));
} else if (cmd === "sync-env") {
  if (!args[0]) { console.error("usage: sync-env FILE"); process.exit(1); }
  await syncEnv(args[0]);
} else if (cmd === "redeploy") await redeployAll();
else if (cmd === "health") await healthAll();
else {
  console.error(`Usage:
  RENDER_API_KEYS=k1,k2,k3 node scripts/render-fanout.mjs list
  RENDER_API_KEYS=k1,k2,k3 node scripts/render-fanout.mjs set-env DATABASE_URL "postgresql://..."
  RENDER_API_KEYS=k1,k2,k3 node scripts/render-fanout.mjs sync-env .env.shared
  RENDER_API_KEYS=k1,k2,k3 node scripts/render-fanout.mjs redeploy
  RENDER_API_KEYS=k1,k2,k3 node scripts/render-fanout.mjs health`);
  process.exit(1);
}
