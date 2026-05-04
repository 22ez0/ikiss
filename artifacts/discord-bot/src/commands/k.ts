import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  type ChatInputCommandInteraction,
} from "discord.js";

export const ALLOWED_EMAIL_IDS = new Set([
  "1495245938116005908",
  "1499585365328134247",
  "1424456058012696769",
]);

export const kCommand = new SlashCommandBuilder()
  .setName("k")
  .setDescription("acesse o painel de controle da sua conta")
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  );

const EMOJI_ESTRELA_ID = "1500092244819054622";
const EMOJI_BOLA_ID = "1500092309105020998";

export async function handleKCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const hasEmailAccess = ALLOWED_EMAIL_IDS.has(interaction.user.id);
  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setDescription(
      `> # _ k_ <a:estrela:${EMOJI_ESTRELA_ID}>\n> \n> tenha acesso à sua conta através do bot!\n> seu id: \`${interaction.user.id}\` ${hasEmailAccess ? "✅" : "❌"}`
    );

  const options = [
    new StringSelectMenuOptionBuilder()
      .setLabel("conectar")
      .setDescription("informar token")
      .setValue("connect_token")
      .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" }),
    new StringSelectMenuOptionBuilder()
      .setLabel("ver status")
      .setDescription("ver conexão atual e status do rpc")
      .setValue("view_status")
      .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" }),
    new StringSelectMenuOptionBuilder()
      .setLabel("ativar rpc")
      .setDescription("configurar e ativar rpc personalizado com ícone")
      .setValue("activate_rpc")
      .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" }),
    new StringSelectMenuOptionBuilder()
      .setLabel("editar rpc")
      .setDescription("editar campos do rpc sem trocar o ícone")
      .setValue("edit_rpc")
      .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" }),
    new StringSelectMenuOptionBuilder()
      .setLabel("desativar rpc")
      .setDescription("remove o rpc do seu perfil")
      .setValue("deactivate_rpc")
      .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" }),
    new StringSelectMenuOptionBuilder()
      .setLabel("limpar dm")
      .setDescription("apagar suas mensagens de uma dm")
      .setValue("clear_dm")
      .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" }),
    new StringSelectMenuOptionBuilder()
      .setLabel("sair dos servidores")
      .setDescription("sai de todos os servidores")
      .setValue("leave_servers")
      .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" }),
    new StringSelectMenuOptionBuilder()
      .setLabel("clonar servidor")
      .setDescription("copia canais, categorias e cargos de um servidor para outro")
      .setValue("clone_server")
      .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" }),
  ];

  if (ALLOWED_EMAIL_IDS.has(interaction.user.id)) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel("📧 email")
        .setDescription("criar emails @faren.com.br e ver inbox")
        .setValue("email_panel")
        .setEmoji({ id: EMOJI_BOLA_ID, name: "bola" })
    );
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("k_panel_select")
    .setPlaceholder("selecionar opções")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  await interaction.reply({ embeds: [embed], components: [row] });
}
