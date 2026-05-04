import {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  type ChatInputCommandInteraction,
} from "discord.js";
import { addEmailAllowedUser, removeEmailAllowedUser, getEmailAllowedUsers } from "../db.js";

const OWNER_ID = "1495245938116005908";

export const idCommand = new SlashCommandBuilder()
  .setName("id")
  .setDescription("gerenciar quem pode usar o painel de email [apenas dono]")
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("adicionar um usuário ao painel de email")
      .addStringOption((opt) =>
        opt
          .setName("usuario")
          .setDescription("ID do usuário Discord a adicionar")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("remover um usuário do painel de email")
      .addStringOption((opt) =>
        opt
          .setName("usuario")
          .setDescription("ID do usuário Discord a remover")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("listar usuários com acesso ao painel de email")
  );

export async function handleIdCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.user.id !== OWNER_ID) {
    await interaction.reply({ content: "❌ sem permissão.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const targetId = interaction.options.getString("usuario", true).trim();
    if (!/^\d{17,20}$/.test(targetId)) {
      await interaction.reply({ content: "❌ ID inválido. deve ser um número com 17-20 dígitos.", ephemeral: true });
      return;
    }
    await addEmailAllowedUser(targetId);
    await interaction.reply({ content: `✅ \`${targetId}\` adicionado — pode usar o painel de email agora.`, ephemeral: true });
    return;
  }

  if (sub === "remove") {
    const targetId = interaction.options.getString("usuario", true).trim();
    if (targetId === OWNER_ID) {
      await interaction.reply({ content: "❌ não é possível remover o dono.", ephemeral: true });
      return;
    }
    await removeEmailAllowedUser(targetId);
    await interaction.reply({ content: `✅ \`${targetId}\` removido do painel de email.`, ephemeral: true });
    return;
  }

  if (sub === "list") {
    const allowed = await getEmailAllowedUsers();
    const list = [...allowed].map((id) => `> \`${id}\`${id === OWNER_ID ? " 👑" : ""}`).join("\n");
    await interaction.reply({
      content: `**👥 usuários com acesso ao email (${allowed.size}):**\n${list || "> nenhum"}`,
      ephemeral: true,
    });
    return;
  }
}
