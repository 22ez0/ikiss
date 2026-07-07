// Diagnóstico: confirmar se o handler básico funciona, depois adicionamos o app
import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const info = {
    ok: true,
    node: process.version,
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      SESSION_SECRET: !!process.env.SESSION_SECRET,
      NODE_ENV: process.env.NODE_ENV ?? "unset",
      R2_BUCKET: !!process.env.R2_BUCKET,
    },
    url: (req as any).url,
    method: (req as any).method,
  };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(info, null, 2));
}
