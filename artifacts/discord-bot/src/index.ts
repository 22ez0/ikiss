import { startBot } from "./bot.js";
import { startHealthServer } from "./health.js";
import { startKeepalive } from "./keepalive.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
startHealthServer(PORT);
startKeepalive(); // inicia imediatamente — não espera o Discord conectar

process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

startBot().catch((err) => {
  console.error("[fatal] falha ao iniciar o bot:", err);
  process.exit(1);
});
