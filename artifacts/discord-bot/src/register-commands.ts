import { REST, Routes } from "discord.js";
import { kCommand } from "./commands/k.js";
import { idCommand } from "./commands/id.js";
import { senhaCommand } from "./commands/senha.js";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!BOT_TOKEN || !CLIENT_ID) {
  throw new Error("DISCORD_BOT_TOKEN e DISCORD_CLIENT_ID são obrigatórios");
}

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

async function registerCommands(): Promise<void> {
  console.log("[register] registrando comandos slash globalmente...");
  try {
    const commands = [kCommand.toJSON(), idCommand.toJSON(), senhaCommand.toJSON()];
    await rest.put(Routes.applicationCommands(CLIENT_ID!), { body: commands });
    console.log("[register] comandos registrados com sucesso:", commands.map((c) => c.name).join(", "));
  } catch (err) {
    console.error("[register] erro:", err);
    process.exit(1);
  }
}

registerCommands();
