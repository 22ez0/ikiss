import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ModalSubmitInteraction,
} from "discord.js";
import { getToken, setToken, setRpc, getRpc, setSession, getSession, clearRpc } from "../store.js";
import { activateRpc, deactivateRpc } from "../selfbot.js";

export function buildConnectModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("modal_connect_token")
    .setTitle("conectar conta")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("token_input")
          .setLabel("token do discord")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("informe seu token aqui")
          .setRequired(true)
      )
    );
}

export function buildClearDmModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("modal_clear_dm")
    .setTitle("limpar dm")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("user_id_input")
          .setLabel("id do usuário")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("id do usuário com dm aberta")
          .setRequired(true)
      )
    );
}

export function buildCloneServerModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("modal_clone_server")
    .setTitle("clonar servidor")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("source_guild_id")
          .setLabel("id do servidor de origem")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("id do servidor a ser clonado")
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("target_guild_id")
          .setLabel("id do servidor de destino")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("id do servidor que vai receber a clonagem")
          .setRequired(true)
      )
    );
}

export function buildRpcFieldsModal(
  statusType: "playing" | "watching" | "streaming",
  existing?: {
    title?: string;
    subtitle?: string;
    detail?: string;
    customUrl?: string;
    buttonLabel?: string;
    buttonUrl?: string;
  }
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("modal_rpc_fields")
    .setTitle("configurar rpc");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rpc_title")
        .setLabel("nome da atividade")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("ex: assistindo anime, ouvindo música...")
        .setValue(existing?.title ?? "")
        .setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rpc_subtitle")
        .setLabel("linha 1")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("primeira linha de descrição")
        .setValue(existing?.subtitle ?? "")
        .setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rpc_detail")
        .setLabel("linha 2")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("segunda linha de descrição")
        .setValue(existing?.detail ?? "")
        .setRequired(false)
    )
  );

  if (statusType === "streaming") {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("rpc_stream_url")
          .setLabel("url da stream (twitch/youtube)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("https://twitch.tv/seucanal")
          .setValue(existing?.customUrl ?? "")
          .setRequired(false)
      )
    );
  } else {
    // dois campos separados para botão (max 5 campos no modal)
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("rpc_button_label")
          .setLabel("nome do botão (opcional)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("ex: meu perfil")
          .setValue(existing?.buttonLabel ?? "")
          .setRequired(false)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("rpc_button_url")
          .setLabel("url do botão (opcional)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("https://faren.com.br/seuuser")
          .setValue(existing?.buttonUrl ?? "")
          .setRequired(false)
      )
    );
  }

  return modal;
}

export function buildSenhaModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("modal_set_senha")
    .setTitle("cadastrar senha — faren.com.br/emailsnoah")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("senha_input")
          .setLabel("nova senha")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("mínimo 4 caracteres")
          .setMinLength(4)
          .setMaxLength(64)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("senha_confirm")
          .setLabel("confirmar senha")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("repita a senha acima")
          .setMinLength(4)
          .setMaxLength(64)
          .setRequired(true)
      )
    );
}

export function buildCreateEmailModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("modal_create_email")
    .setTitle("criar email @faren.com.br")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("email_prefix")
          .setLabel("prefixo do email")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("ex: discord, conta, meu, qualquer coisa")
          .setMinLength(2)
          .setMaxLength(40)
          .setRequired(true)
      )
    );
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId, user } = interaction;

  if (customId === "modal_set_senha") {
    await interaction.deferReply({ ephemeral: true });
    const { SENHA_ALLOWED_IDS } = await import("../commands/senha.js");
    if (!SENHA_ALLOWED_IDS.has(user.id)) {
      await interaction.editReply({ content: "❌ sem permissão." });
      return;
    }
    const senha = interaction.fields.getTextInputValue("senha_input").trim();
    const confirm = interaction.fields.getTextInputValue("senha_confirm").trim();
    if (senha !== confirm) {
      await interaction.editReply({ content: "❌ as senhas não coincidem. tente novamente." });
      return;
    }
    if (senha.length < 4) {
      await interaction.editReply({ content: "❌ senha muito curta (mínimo 4 caracteres)." });
      return;
    }
    try {
      const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8080";
      const SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? "";
      const res = await fetch(`${API_BASE}/api/emailsnoah/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": SECRET },
        body: JSON.stringify({ discordUserId: user.id, password: senha }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        await interaction.editReply({
          content: `✅ senha cadastrada com sucesso!\n\nacesse **faren.com.br/emailsnoah** e faça login com sua conta.`,
        });
      } else {
        await interaction.editReply({ content: `❌ ${data.error ?? "erro ao salvar senha"}` });
      }
    } catch (e: any) {
      await interaction.editReply({ content: `erro: ${e?.message}` });
    }
    return;
  }

  if (customId === "modal_create_email") {
    await interaction.deferReply({ ephemeral: true });
    const { ALLOWED_EMAIL_IDS } = await import("../commands/k.js");
    if (!ALLOWED_EMAIL_IDS.has(user.id)) {
      await interaction.editReply({ content: "❌ sem permissão." });
      return;
    }
    const prefix = interaction.fields.getTextInputValue("email_prefix").trim().toLowerCase().replace(/[^a-z0-9._+-]/g, "");
    if (!prefix) { await interaction.editReply({ content: "prefixo inválido. use apenas letras e números." }); return; }
    try {
      const { createEmailAddress } = await import("../email-api.js");
      const result = await createEmailAddress(user.id, prefix);
      if ("error" in result) {
        await interaction.editReply({ content: `❌ ${result.error}` });
      } else {
        await interaction.editReply({
          content: `✅ email criado com sucesso!\n\n> **\`${result.address}\`**\n\nQualquer email enviado pra este endereço vai aparecer aqui no Discord automaticamente.`,
        });
      }
    } catch (e: any) {
      await interaction.editReply({ content: `erro: ${e?.message}` });
    }
    return;
  }

  if (customId === "modal_connect_token") {
    await interaction.deferReply({ ephemeral: true });
    const token = interaction.fields.getTextInputValue("token_input").trim();

    try {
      const { validateToken } = await import("../selfbot.js");
      const info = await validateToken(token, user.id);
      setToken(user.id, token);
      await interaction.editReply({
        content: `conectado como **${info.username}** (\`${info.id}\`). token salvo.`,
      });
    } catch (e: any) {
      console.error("[modal_connect_token] erro:", e?.message ?? e);
      await interaction.editReply({ content: `erro ao conectar: ${e?.message ?? e}` });
    }
    return;
  }

  if (customId === "modal_clear_dm") {
    await interaction.deferReply({ ephemeral: true });
    const token = getToken(user.id);
    if (!token) {
      await interaction.editReply({ content: "conecte primeiro usando a opção **conectar**." });
      return;
    }
    const targetId = interaction.fields.getTextInputValue("user_id_input").trim();
    try {
      const { clearDm } = await import("../selfbot.js");
      await clearDm(token, user.id, targetId);
      await interaction.editReply({ content: `dm com \`${targetId}\` limpa.` });
    } catch (e: any) {
      await interaction.editReply({ content: `erro: ${e?.message ?? e}` });
    }
    return;
  }

  if (customId === "modal_clone_server") {
    await interaction.deferReply({ ephemeral: true });
    const token = getToken(user.id);
    if (!token) {
      await interaction.editReply({ content: "conecte primeiro usando a opção **conectar**." });
      return;
    }

    const sourceId = interaction.fields.getTextInputValue("source_guild_id").trim();
    const targetId = interaction.fields.getTextInputValue("target_guild_id").trim();

    await interaction.editReply({ content: "⏳ clonando servidor... isso pode levar alguns minutos." });

    try {
      const { cloneServer } = await import("../selfbot.js");
      const result = await cloneServer(token, user.id, sourceId, targetId);

      const errLine = result.errors.length
        ? `\n> **erros (${result.errors.length}):** ${result.errors.slice(0, 3).join(", ")}${result.errors.length > 3 ? "..." : ""}`
        : "";

      await interaction.editReply({
        content:
          `clonagem concluída!\n\n` +
          `> **cargos:** ${result.roles}\n` +
          `> **categorias:** ${result.categories}\n` +
          `> **canais:** ${result.channels}` +
          errLine,
      });
    } catch (e: any) {
      await interaction.editReply({ content: `erro ao clonar: ${e?.message ?? e}` });
    }
    return;
  }

  if (customId === "modal_rpc_fields") {
    await interaction.deferReply({ ephemeral: true });

    const session = getSession(user.id);
    const token = getToken(user.id);

    if (!token) {
      await interaction.editReply({ content: "conecte primeiro usando a opção **conectar**." });
      return;
    }

    const statusType = session.pendingStatusType ?? "playing";
    const title = interaction.fields.getTextInputValue("rpc_title").trim();
    const subtitle = interaction.fields.getTextInputValue("rpc_subtitle").trim();
    const detail = interaction.fields.getTextInputValue("rpc_detail").trim();
    const iconUrl = session.pendingIconUrl ?? getRpc(user.id)?.iconUrl ?? "";

    let customUrl = "";
    let buttonLabel = "";
    let buttonUrl = "";

    if (statusType === "streaming") {
      try { customUrl = interaction.fields.getTextInputValue("rpc_stream_url").trim(); } catch {}
      if (!customUrl) customUrl = getRpc(user.id)?.customUrl || "https://twitch.tv/twitch";
    } else {
      try { buttonLabel = interaction.fields.getTextInputValue("rpc_button_label").trim(); } catch {}
      try { buttonUrl = interaction.fields.getTextInputValue("rpc_button_url").trim(); } catch {}
    }

    const rpcConfig = { statusType, title, subtitle, detail, customUrl, iconUrl, buttonLabel, buttonUrl };

    try {
      await activateRpc(token, user.id, rpcConfig);
      setRpc(user.id, rpcConfig);
      setSession(user.id, { pendingStatusType: undefined, pendingIconUrl: undefined });

      const emoji = statusType === "streaming" ? "🟣" : statusType === "watching" ? "🔵" : "🔴";
      const btnLine = buttonLabel && buttonUrl ? `\n> **botão:** ${buttonLabel} → ${buttonUrl}` : "";
      const iconLine = iconUrl ? `\n> **ícone:** definido` : "";

      await interaction.editReply({
        content:
          `rpc ativado ${emoji}\n\n` +
          `> **nome:** ${title}\n> **linha 1:** ${subtitle || "—"}\n> **linha 2:** ${detail || "—"}\n> **status:** ${statusType}` +
          iconLine + btnLine,
      });
    } catch (e: any) {
      console.error("[modal_rpc_fields] erro:", e?.message ?? e);
      await interaction.editReply({ content: `erro ao ativar rpc: ${e?.message ?? e}` });
    }
    return;
  }
}
