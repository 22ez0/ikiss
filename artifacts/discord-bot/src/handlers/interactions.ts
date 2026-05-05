import {
  type Client,
  type Interaction,
  Events,
  InteractionType,
} from "discord.js";
import { handleKCommand } from "../commands/k.js";
import { handleIdCommand } from "../commands/id.js";
import { handleSenhaCommand } from "../commands/senha.js";
import { handleSelectMenu, handleEmailPanelSelect, handleEmailInboxSelect } from "./select-menu.js";
import { handleModalSubmit } from "./modals.js";

export function registerInteractionHandlers(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "k") {
          await handleKCommand(interaction);
        } else if (interaction.commandName === "id") {
          await handleIdCommand(interaction);
        } else if (interaction.commandName === "senha") {
          await handleSenhaCommand(interaction);
        }
        return;
      }

      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === "email_panel_select") {
          await handleEmailPanelSelect(interaction);
        } else if (interaction.customId === "email_inbox_select") {
          await handleEmailInboxSelect(interaction);
        } else {
          await handleSelectMenu(interaction);
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
        return;
      }
    } catch (err) {
      console.error("[interaction error]", err);
      try {
        const reply = { content: "ocorreu um erro ao processar sua solicitação.", ephemeral: true };
        if ("replied" in interaction && !interaction.replied && "deferred" in interaction && !interaction.deferred) {
          await (interaction as any).reply(reply);
        } else if ("deferred" in interaction && interaction.deferred) {
          await (interaction as any).editReply(reply);
        }
      } catch {}
    }
  });
}
