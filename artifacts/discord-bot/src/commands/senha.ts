import {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  type ChatInputCommandInteraction,
} from "discord.js";
import { buildSenhaModal } from "../handlers/modals.js";

export const SENHA_ALLOWED_IDS = new Set([
  "1424456058012696769",
  "1495245938116005908",
  "1499585365328134247",
]);

export const senhaCommand = new SlashCommandBuilder()
  .setName("senha")
  .setDescription("cadastrar ou redefinir sua senha do painel ikiss.me/emailsnoah")
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  );

export async function handleSenhaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!SENHA_ALLOWED_IDS.has(interaction.user.id)) {
    await interaction.reply({ content: "❌ sem permissão.", ephemeral: true });
    return;
  }
  await interaction.showModal(buildSenhaModal());
}
