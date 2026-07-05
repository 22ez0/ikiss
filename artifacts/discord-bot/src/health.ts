import { createServer } from "node:http";

export function startHealthServer(port = 3000): void {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", bot: "ikiss-discord-bot" }));
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[health] servidor http rodando na porta ${port}`);
  });
}
