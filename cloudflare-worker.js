// Ikiss — Cloudflare Worker on route ikiss.me/*
// Last sync from production: 2026-04-27
// Five responsibilities:
//   1. Proxy /api/* to one of N Render backends (failover on 5xx/timeout)
//   2. Edge-cache GETs (90s trending, 20s profile)
//   3. SSR Open Graph previews for social-bot UAs on profile paths
//   4. Scheduled keep-alive ping every 14 min for ALL backends
//   5. Expose /__backends/health for ops visibility
//
// CONFIG (set as Worker env vars in Cloudflare dashboard):
//   BACKENDS         — comma-separated list of Render origins, in priority order
//                      e.g. "https://faren-api-1.onrender.com,https://faren-api-2.onrender.com"
//                      Falls back to the legacy single backend if unset.
//   BACKEND_TIMEOUT_MS  — per-backend request timeout (default 8000)
//   UNHEALTHY_TTL_SEC   — how long a failed backend is skipped (default 60)

const SOCIAL_BOTS = /facebookexternalhit|facebookbot|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|pinterestbot|applebot|googlebot|bingbot|duckduckbot|ia_archiver|embedly|outbrain|vkshare|viber|line\/|snapchat|iframely/i;
const LEGACY_API_ORIGIN = "https://faren-api-wn1z.onrender.com";
const RESERVED = new Set(["api","health","og","favicon.ico","favicon.png","robots.txt","sitemap.xml","opengraph.jpg","CNAME","404.html","__backends"]);

// Cache TTLs (seconds)
const CACHE_TTL = {
  trending: 90,
  profile: 20,
  default: 0,
};

function getBackends(env) {
  const raw = (env && env.BACKENDS) || LEGACY_API_ORIGIN;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function unhealthyKey(origin) {
  // Use a fake hostname inside the worker's cache so it doesn't collide with anything else
  return new Request(`https://faren-internal.invalid/__unhealthy/${encodeURIComponent(origin)}`);
}

async function isUnhealthy(origin) {
  const r = await caches.default.match(unhealthyKey(origin));
  return !!r;
}

async function markUnhealthy(origin, ttl, ctx) {
  const res = new Response("dead", {
    headers: { "cache-control": `public, max-age=${ttl}` },
  });
  ctx.waitUntil(caches.default.put(unhealthyKey(origin), res));
}

// Forward an incoming request to one of the backends with failover.
// Returns { response, origin } where origin is the backend that served it (or null).
async function forwardWithFailover(request, env, ctx, pathname, search) {
  const backends = getBackends(env);
  const timeoutMs = parseInt((env && env.BACKEND_TIMEOUT_MS) || "8000", 10);
  const unhealthyTtl = parseInt((env && env.UNHEALTHY_TTL_SEC) || "60", 10);
  const isGetOrHead = request.method === "GET" || request.method === "HEAD";

  // For non-GET/HEAD, buffer the body once so we can retry against multiple backends.
  let bodyBuffer = null;
  if (!isGetOrHead && request.body) {
    bodyBuffer = await request.arrayBuffer();
  }

  let lastResponse = null;
  let lastOrigin = null;

  // First pass: skip backends marked unhealthy
  // Second pass: try ALL backends (in case the unhealthy cache is stale)
  for (let pass = 0; pass < 2; pass++) {
    for (const origin of backends) {
      if (pass === 0 && (await isUnhealthy(origin))) continue;

      const upstreamUrl = origin + pathname + search;
      const upstreamHost = new URL(origin).host;

      const headers = new Headers(request.headers);
      headers.set("host", upstreamHost);
      headers.delete("cf-connecting-ip");
      headers.delete("cf-ipcountry");
      headers.delete("cf-ray");
      headers.delete("cf-visitor");
      headers.delete("x-forwarded-host");

      const init = {
        method: request.method,
        headers,
        redirect: "manual",
      };
      if (!isGetOrHead) init.body = bodyBuffer;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      init.signal = controller.signal;

      try {
        const upRes = await fetch(upstreamUrl, init);
        clearTimeout(timeoutId);

        // 5xx (except 501/505) or 502/503/504 → consider this backend bad
        const isBackendError =
          upRes.status === 502 || upRes.status === 503 || upRes.status === 504 || upRes.status === 521 || upRes.status === 522 || upRes.status === 523;

        if (isBackendError) {
          await markUnhealthy(origin, unhealthyTtl, ctx);
          lastResponse = upRes;
          lastOrigin = origin;
          continue;
        }

        return { response: upRes, origin };
      } catch (e) {
        clearTimeout(timeoutId);
        await markUnhealthy(origin, unhealthyTtl, ctx);
        lastResponse = null;
        lastOrigin = origin;
        continue;
      }
    }
    if (lastResponse) break; // pass 0 exhausted but we have nothing — try pass 1
  }

  if (lastResponse) return { response: lastResponse, origin: lastOrigin };
  return {
    response: new Response(
      JSON.stringify({ error: "all_backends_unavailable", tried: backends.length }),
      { status: 503, headers: { "content-type": "application/json" } }
    ),
    origin: null,
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const ua = request.headers.get("user-agent") || "";

    // Diagnostics endpoint
    if (pathname === "/__backends/health") {
      const backends = getBackends(env);
      const out = await Promise.all(
        backends.map(async (origin) => ({
          origin,
          unhealthy_in_cache: await isUnhealthy(origin),
        }))
      );
      return new Response(JSON.stringify({ backends: out }, null, 2), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }

    // 1. Proxy /api/* with failover + edge cache
    if (pathname.startsWith("/api/")) {
      const isGet = request.method === "GET";
      let ttl = CACHE_TTL.default;
      if (isGet && pathname.includes("/discover/trending")) ttl = CACHE_TTL.trending;
      else if (isGet && pathname.match(/^\/api\/users\/[^/]+$/)) ttl = CACHE_TTL.profile;

      // Cache key uses the legacy API origin so cache stays consistent regardless of which backend served it
      const cacheKey = new Request(LEGACY_API_ORIGIN + pathname + url.search, { method: "GET" });
      const cache = caches.default;

      if (isGet && ttl > 0) {
        const cached = await cache.match(cacheKey);
        if (cached) {
          const r = new Response(cached.body, cached);
          r.headers.set("X-Edge-Cache", "HIT");
          return r;
        }
      }

      const { response: apiRes, origin: servedBy } = await forwardWithFailover(
        request, env, ctx, pathname, url.search
      );

      const response = new Response(apiRes.body, apiRes);

      // CORS for ikiss.me
      const reqOrigin = request.headers.get("origin") || "";
      if (reqOrigin.includes("ikiss.me")) {
        response.headers.set("Access-Control-Allow-Origin", reqOrigin);
        response.headers.set("Access-Control-Allow-Credentials", "true");
        response.headers.set("Vary", "Origin");
      }

      if (servedBy) response.headers.set("X-Backend", new URL(servedBy).host);

      if (isGet && ttl > 0 && apiRes.ok) {
        response.headers.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
        response.headers.set("X-Edge-Cache", "MISS");
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    }

    // 2. OG preview for social bots on profile paths
    const pathParts = pathname.split("/").filter(Boolean);
    const isProfilePath = pathParts.length === 1 && /^[a-zA-Z0-9_.]{1,30}$/.test(pathParts[0]) && !RESERVED.has(pathParts[0]);
    const isBot = SOCIAL_BOTS.test(ua);

    if (isBot && isProfilePath) {
      const username = pathParts[0];
      const { response: ogRes } = await forwardWithFailover(
        request, env, ctx, "/" + username, ""
      );
      if (ogRes.ok) {
        const html = await ogRes.text();
        return new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60, stale-while-revalidate=300",
          },
        });
      }
    }

    // 3. Pass through to GitHub Pages (origin)
    return fetch(request);
  },

  async scheduled(event, env, ctx) {
    // Keep-alive ping for ALL configured backends to avoid Render free cold starts
    const backends = getBackends(env);
    await Promise.allSettled(
      backends.map((origin) =>
        fetch(`${origin}/api/healthz`, {
          headers: { "user-agent": "CloudflareWorker/keepalive" },
          signal: AbortSignal.timeout(10000),
        }).catch(() => {})
      )
    );
  },
};
