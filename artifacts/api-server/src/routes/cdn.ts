import { Router } from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "../lib/r2";
import { Readable, pipeline } from "node:stream";
import { promisify } from "node:util";

const router = Router();
const pipelineAsync = promisify(pipeline);

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

    const body = obj.Body;
    if (!body) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // AWS SDK v3 body is always an async-iterable (SdkStreamMixin).
    // Convert to a Node.js Readable so we can use stream.pipeline(),
    // which handles backpressure, cleanup, and error propagation correctly.
    const readable = body instanceof Readable
      ? body
      : Readable.from(body as AsyncIterable<Uint8Array>);

    try {
      await pipelineAsync(readable, res);
    } catch (pipeErr: any) {
      // If headers are already sent (stream started), we can't send an error
      // response — just destroy the streams and log.
      if (!res.headersSent) {
        res.status(502).json({ error: "Stream error" });
      }
      console.error("[cdn] Stream error:", pipeErr?.message);
    }
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (err?.name === "NoSuchKey" || err?.Code === "NoSuchKey" || status === 404) {
      res.status(404).json({ error: "Not found" });
    } else {
      console.error("[cdn] R2 error:", err?.message);
      if (!res.headersSent) {
        res.status(502).json({ error: "Failed to fetch file" });
      }
    }
  }
});

export default router;
