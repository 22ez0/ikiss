import { Router } from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "../lib/r2";
import { Readable } from "node:stream";

const router = Router();

/**
 * GET /cdn/<key>
 * Proxy autenticado para arquivos do Cloudflare R2.
 * Permite servir arquivos do bucket sem precisar de acesso público
 * habilitado no painel do Cloudflare.
 *
 * Cache: 1 ano (imutável) — os keys incluem hash do conteúdo.
 */
router.use("/cdn", async (req, res, next): Promise<void> => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  // req.path is the path after /cdn, e.g. "/avatars/2/abc.png"
  const key = req.path.replace(/^\/+/, "");
  if (!key) {
    res.status(400).json({ error: "Missing key" });
    return;
  }

  try {
    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const obj = await r2.send(cmd);

    const contentType = obj.ContentType || "application/octet-stream";
    const cacheControl = obj.CacheControl || "public, max-age=31536000, immutable";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (obj.ContentLength) {
      res.setHeader("Content-Length", obj.ContentLength);
    }

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    // Stream the body
    const body = obj.Body;
    if (body && typeof (body as any).pipe === "function") {
      (body as unknown as Readable).pipe(res);
    } else if (body) {
      // AWS SDK v3 returns an async iterable in some environments
      const chunks: Buffer[] = [];
      for await (const chunk of body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      res.end(Buffer.concat(chunks));
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (err?.name === "NoSuchKey" || err?.Code === "NoSuchKey" || status === 404) {
      res.status(404).json({ error: "Not found" });
    } else {
      console.error("[cdn] R2 error:", err?.message);
      res.status(502).json({ error: "Failed to fetch file" });
    }
  }
});

export default router;
