import {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  type ChatInputCommandInteraction,
} from "discord.js";

export const EMAIL_ALLOWED_IDS = new Set([
  "1424456058012696769",
  "1495245938116005908",
  "1499585365328134247",
]);

const NAMES: Record<string, string> = {
  "1424456058012696769": "bella",
  "1495245938116005908": "noah",
  "1499585365328134247": "erick",
};

export const emailCommand = new SlashCommandBuilder()
  .setName("email")
  .setDescription("enviar um email para bella, noah ou erick")
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  )
  .addStringOption((o) =>
    o
      .setName("para")
      .setDescription("destinatário")
      .setRequired(true)
      .addChoices(
        { name: "bella", value: "1424456058012696769" },
        { name: "noah", value: "1495245938116005908" },
        { name: "erick", value: "1499585365328134247" }
      )
  )
  .addStringOption((o) =>
    o
      .setName("assunto")
      .setDescription("assunto do email")
      .setRequired(true)
      .setMaxLength(100)
  )
  .addStringOption((o) =>
    o
      .setName("mensagem")
      .setDescription("conteúdo do email")
      .setRequired(true)
      .setMaxLength(1000)
  );

export async function handleEmailCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!EMAIL_ALLOWED_IDS.has(interaction.user.id)) {
    await interaction.reply({ content: "❌ sem permissão.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const toId = interaction.options.getString("para", true);
  const toName = NAMES[toId] ?? toId;
  const fromId = interaction.user.id;
  const fromName = NAMES[fromId] ?? interaction.user.username;
  const assunto = interaction.options.getString("assunto", true);
  const mensagem = interaction.options.getString("mensagem", true);

  try {
    const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8080";
    const SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? "";

    const res = await fetch(`${API_BASE}/api/emailsnoah/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": SECRET,
      },
      body: JSON.stringify({
        fromDiscordId: fromId,
        fromName,
        toDiscordId: toId,
        toName,
        subject: assunto,
        body: mensagem,
      }),
    });

    const data = (await res.json()) as { ok?: boolean; error?: string };

    if (data.ok) {
      await interaction.editReply({
        content: `✅ email enviado para **${toName}**!\n\n> **Assunto:** ${assunto}\n> **Para:** ${toName} · [faren.com.br/emailsnoah](https://faren.com.br/emailsnoah)`,
      });
    } else {
      await interaction.editReply({
        content: `❌ ${data.error ?? "erro ao enviar email"}`,
      });
    }
  } catch (e: any) {
    await interaction.editReply({ content: `erro: ${e?.message ?? e}` });
  }
}
