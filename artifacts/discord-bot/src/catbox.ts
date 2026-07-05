async function tryUguuUpload(buffer: ArrayBuffer, contentType: string, ext: string): Promise<string> {
  const form = new FormData();
  form.append(
    "files[]",
    new Blob([buffer], { type: contentType }),
    `icon.${ext}`
  );

  const res = await fetch("https://uguu.se/upload.php", {
    method: "POST",
    body: form,
    headers: { "User-Agent": "ikiss-bot/1.0" },
  });

  if (!res.ok) throw new Error(`uguu retornou ${res.status}`);

  const data = (await res.json()) as { success: boolean; files?: { url: string }[] };
  if (!data.success || !data.files?.[0]?.url) throw new Error("uguu: resposta inválida");

  return data.files[0].url;
}

async function downloadImage(imageUrl: string): Promise<{ buffer: ArrayBuffer; contentType: string; ext: string }> {
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ikiss-bot/1.0)" },
  });
  if (!res.ok) throw new Error(`falha ao baixar imagem: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/png";

  const ext = contentType.includes("gif")
    ? "gif"
    : contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
    ? "webp"
    : "jpg";

  if (ext === "gif" && buffer.byteLength / (1024 * 1024) > 5) {
    throw new Error("gif muito grande. limite: 5mb");
  }

  return { buffer, contentType, ext };
}

export async function uploadToCatbox(imageUrl: string): Promise<string> {
  // Tenta catbox via URL upload
  try {
    const form = new FormData();
    form.append("reqtype", "urlupload");
    form.append("userhash", "");
    form.append("url", imageUrl);

    const res = await fetch("https://catbox.moe/user.php", {
      method: "POST",
      body: form,
      headers: { "User-Agent": "ikiss-bot/1.0" },
    });

    if (res.ok) {
      const text = await res.text();
      if (text.trim().startsWith("https://")) return text.trim();
    }
  } catch {}

  // Baixa a imagem
  const { buffer, contentType, ext } = await downloadImage(imageUrl);

  // Tenta catbox via file upload
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("userhash", "");
    form.append("fileToUpload", new Blob([buffer], { type: contentType }), `icon.${ext}`);

    const res = await fetch("https://catbox.moe/user.php", {
      method: "POST",
      body: form,
      headers: { "User-Agent": "ikiss-bot/1.0" },
    });

    if (res.ok) {
      const text = await res.text();
      if (text.trim().startsWith("https://")) return text.trim();
    }
  } catch {}

  // Fallback: uguu.se
  return tryUguuUpload(buffer, contentType, ext);
}
