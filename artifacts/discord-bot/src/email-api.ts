const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8080";
const SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? "";

const headers = () => ({
  "Content-Type": "application/json",
  "x-webhook-secret": SECRET,
});

export interface EmailAddress {
  address: string;
  created_at: string;
}

export interface InboxEmail {
  id: number;
  address: string;
  from_addr: string;
  subject: string;
  body: string;
  code: string | null;
  received_at: string;
}

export async function createEmailAddress(discordUserId: string, prefix: string): Promise<{ ok: true; address: string } | { error: string }> {
  const res = await fetch(`${API_BASE}/api/email/addresses`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ discordUserId, address: prefix }),
  });
  return res.json() as Promise<{ ok: true; address: string } | { error: string }>;
}

export async function getEmailAddresses(discordUserId: string): Promise<EmailAddress[]> {
  const res = await fetch(`${API_BASE}/api/email/addresses?discordUserId=${discordUserId}&secret=${SECRET}`, {
    headers: headers(),
  });
  const j = await res.json() as { addresses?: EmailAddress[] };
  return j.addresses ?? [];
}

export async function getInbox(discordUserId: string, address?: string, limit = 5): Promise<InboxEmail[]> {
  const params = new URLSearchParams({ discordUserId, limit: String(limit), secret: SECRET });
  if (address) params.set("address", address);
  const res = await fetch(`${API_BASE}/api/email/inbox?${params}`, { headers: headers() });
  const j = await res.json() as { emails?: InboxEmail[] };
  return j.emails ?? [];
}
