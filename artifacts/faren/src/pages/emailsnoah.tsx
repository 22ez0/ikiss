import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mail,
  Inbox,
  Send,
  ArrowLeft,
  LogOut,
  RefreshCw,
  Search,
  ExternalLink,
  Users,
  MessageSquare,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const USERS = [
  { id: "1424456058012696769", name: "bella", color: "#e879f9" },
  { id: "1495245938116005908", name: "noah", color: "#38bdf8" },
  { id: "1499585365328134247", name: "erick", color: "#34d399" },
];

interface DiscordStatus {
  status: string;
  activity: string;
  avatarUrl: string;
}

interface InboxEmail {
  id: number;
  address: string;
  from_addr: string;
  subject: string;
  body: string;
  code: string | null;
  received_at: string;
}

interface DiscordMessage {
  id: number;
  from_discord_id: string;
  from_name: string;
  to_discord_id: string;
  to_name: string;
  subject: string;
  body: string;
  sent_at: string;
  _type: "dm";
}

interface ProfileData {
  id: number;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar_url: string | null;
  discord_status: string | null;
  discord_activity: string | null;
  discord_nitro: boolean;
  music_title: string | null;
  music_url: string | null;
  status_text: string | null;
  followers_count: number;
  views_count: number;
}

function statusColor(status: string | null) {
  if (status === "online") return "#23d18b";
  if (status === "idle") return "#f0b232";
  if (status === "dnd") return "#f23f43";
  return "#4f545c";
}

function statusLabel(status: string | null) {
  if (status === "online") return "online";
  if (status === "idle") return "ausente";
  if (status === "dnd") return "ocupado";
  return "offline";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>")\]]+/g;
  return [...new Set(text.match(re) ?? [])].slice(0, 8);
}

function cleanBody(raw: string): string {
  if (!raw) return "";
  let text = raw;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function UserAvatar({
  user,
  avatarUrl,
  size = 44,
  statusDot,
}: {
  user: (typeof USERS)[0];
  avatarUrl?: string;
  size?: number;
  statusDot?: string | null;
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={user.name}
          className="rounded-full object-cover w-full h-full"
          style={{ border: `2px solid ${user.color}` }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-black uppercase w-full h-full"
          style={{
            fontSize: size * 0.4,
            background: user.color + "22",
            color: user.color,
            border: `2px solid ${user.color}`,
          }}
        >
          {user.name[0]}
        </div>
      )}
      {statusDot !== undefined && (
        <span
          className="absolute rounded-full border-2 border-black"
          style={{
            background: statusColor(statusDot),
            width: size * 0.3,
            height: size * 0.3,
            bottom: -1,
            right: -1,
          }}
        />
      )}
    </div>
  );
}

export default function EmailsNoah() {
  const [step, setStep] = useState<"login" | "app">("login");
  const [selectedUser, setSelectedUser] = useState<(typeof USERS)[0] | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [discordStatuses, setDiscordStatuses] = useState<Record<string, DiscordStatus>>({});

  const [token, setToken] = useState<string | null>(null);
  const [meId, setMeId] = useState<string>("");
  const [meName, setMeName] = useState<string>("");

  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [discordMessages, setDiscordMessages] = useState<DiscordMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [selectedDm, setSelectedDm] = useState<DiscordMessage | null>(null);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"inbox" | "mensagens" | "perfis">("inbox");

  const [musicPlaying, setMusicPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("emailsnoah_token");
    const savedId = localStorage.getItem("emailsnoah_id");
    const savedName = localStorage.getItem("emailsnoah_name");
    if (saved && savedId && savedName) {
      setToken(saved);
      setMeId(savedId);
      setMeName(savedName);
      setStep("app");
    }
  }, []);

  const fetchStatuses = useCallback(() => {
    fetch(`${API_BASE}/api/emailsnoah/discord-status`)
      .then((r) => r.json())
      .then((d: any) => {
        if (d.statuses) setDiscordStatuses(d.statuses);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatuses();
    const i = setInterval(fetchStatuses, 15000);
    return () => clearInterval(i);
  }, [fetchStatuses]);

  const startMusic = useCallback(() => {
    if (iframeRef.current && !musicPlaying) {
      const url =
        "https://open.spotify.com/embed/playlist/5oS4loJrmrR72LVIs8dCPB?utm_source=generator&autoplay=1&theme=0";
      iframeRef.current.src = url;
      setMusicPlaying(true);
    }
  }, [musicPlaying]);

  useEffect(() => {
    const handler = () => startMusic();
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, [startMusic]);

  const doLogin = useCallback(async () => {
    if (!selectedUser || !password) return;
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE}/api/emailsnoah/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordUserId: selectedUser.id, password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        token?: string;
        name?: string;
        discordUserId?: string;
        error?: string;
      };
      if (data.ok && data.token && data.discordUserId) {
        localStorage.setItem("emailsnoah_token", data.token);
        localStorage.setItem("emailsnoah_id", data.discordUserId);
        localStorage.setItem("emailsnoah_name", data.name ?? "");
        setToken(data.token);
        setMeId(data.discordUserId);
        setMeName(data.name ?? "");
        setStep("app");
        setPassword("");
      } else {
        setLoginError(data.error ?? "Erro ao fazer login");
      }
    } catch {
      setLoginError("Erro de conexão. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  }, [selectedUser, password]);

  const fetchInbox = useCallback(async (tk: string) => {
    setInboxLoading(true);
    try {
      const [emailRes, msgRes] = await Promise.all([
        fetch(`${API_BASE}/api/emailsnoah/inbox?limit=30`, {
          headers: { Authorization: `Bearer ${tk}` },
        }),
        fetch(`${API_BASE}/api/emailsnoah/messages`, {
          headers: { Authorization: `Bearer ${tk}` },
        }),
      ]);
      if (emailRes.status === 401) {
        doLogout();
        return;
      }
      const emailData = (await emailRes.json()) as {
        emails?: InboxEmail[];
        addresses?: string[];
      };
      setEmails(emailData.emails ?? []);
      setAddresses(emailData.addresses ?? []);

      if (msgRes.ok) {
        const msgData = (await msgRes.json()) as { messages?: any[] };
        setDiscordMessages(
          (msgData.messages ?? []).map((m: any) => ({ ...m, _type: "dm" }))
        );
      }
    } catch {}
    setInboxLoading(false);
  }, []);

  const fetchProfiles = useCallback(async (tk: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/emailsnoah/profiles`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { profiles?: ProfileData[] };
      setProfiles(data.profiles ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    if (step === "app" && token) {
      fetchInbox(token);
      fetchProfiles(token);
      const interval = setInterval(() => {
        fetchInbox(token);
        fetchProfiles(token);
        fetchStatuses();
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [step, token, fetchInbox, fetchProfiles, fetchStatuses]);

  function doLogout() {
    localStorage.removeItem("emailsnoah_token");
    localStorage.removeItem("emailsnoah_id");
    localStorage.removeItem("emailsnoah_name");
    setToken(null);
    setStep("login");
    setSelectedUser(null);
    setPassword("");
    setEmails([]);
    setDiscordMessages([]);
    setSelectedEmail(null);
    setSelectedDm(null);
    setProfiles([]);
  }

  const meUser = USERS.find((u) => u.id === meId);

  const filteredEmails = emails.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.subject?.toLowerCase().includes(q) ||
      e.from_addr?.toLowerCase().includes(q) ||
      e.body?.toLowerCase().includes(q)
    );
  });

  const filteredDms = discordMessages.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.subject?.toLowerCase().includes(q) ||
      m.from_name?.toLowerCase().includes(q) ||
      m.body?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black text-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <video
        src="/emailsnoah-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.2, filter: "blur(1px)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80 pointer-events-none" />

      {/* Spotify floating player — always visible */}
      <div
        className="absolute z-50 rounded-xl overflow-hidden shadow-2xl"
        style={{
          bottom: 20,
          right: 20,
          width: 280,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {!musicPlaying && (
          <button
            onClick={startMusic}
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <span style={{ fontSize: 20 }}>▶</span>
            iniciar música
          </button>
        )}
        <iframe
          ref={iframeRef}
          src="https://open.spotify.com/embed/playlist/5oS4loJrmrR72LVIs8dCPB?utm_source=generator&theme=0"
          width="280"
          height="80"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ display: "block" }}
        />
      </div>

      {step === "login" ? (
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          {!selectedUser ? (
            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              {USERS.map((u) => {
                const st = discordStatuses[u.id];
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setLoginError("");
                      setTimeout(() => passwordRef.current?.focus(), 100);
                    }}
                    className="flex items-center gap-3.5 p-3.5 rounded-2xl transition-all duration-200 hover:scale-[1.02] group text-left w-full"
                    style={{
                      background: "rgba(22,22,28,0.80)",
                      border: `1px solid rgba(255,255,255,0.07)`,
                      backdropFilter: "blur(20px)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = `rgba(30,30,38,0.92)`;
                      (e.currentTarget as HTMLElement).style.borderColor = `${u.color}40`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = `rgba(22,22,28,0.80)`;
                      (e.currentTarget as HTMLElement).style.borderColor = `rgba(255,255,255,0.07)`;
                    }}
                  >
                    <UserAvatar
                      user={u}
                      avatarUrl={st?.avatarUrl}
                      size={46}
                      statusDot={st?.status ?? null}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm leading-tight">
                        {u.name}
                      </div>
                      <div className="text-xs text-zinc-500 truncate mt-0.5 leading-tight">
                        {st?.activity
                          ? st.activity
                          : st?.status
                          ? statusLabel(st.status)
                          : "last seen unknown"}
                      </div>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: u.color + "22", color: u.color }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className="w-full max-w-xs rounded-2xl p-6"
              style={{
                background: "rgba(18,18,22,0.90)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(24px)",
              }}
            >
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setLoginError("");
                  setPassword("");
                }}
                className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs mb-5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                voltar
              </button>

              <div className="flex items-center gap-3 mb-5">
                <UserAvatar
                  user={selectedUser}
                  avatarUrl={discordStatuses[selectedUser.id]?.avatarUrl}
                  size={44}
                  statusDot={discordStatuses[selectedUser.id]?.status ?? null}
                />
                <div>
                  <div className="font-semibold text-white text-sm">{selectedUser.name}</div>
                  <div className="text-xs text-zinc-500">
                    {discordStatuses[selectedUser.id]?.activity ||
                      statusLabel(discordStatuses[selectedUser.id]?.status ?? null)}
                  </div>
                </div>
              </div>

              {loginError && (
                <div
                  className="mb-4 p-2.5 rounded-lg text-xs text-red-400"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.15)",
                  }}
                >
                  {loginError}
                </div>
              )}

              <div className="space-y-2.5">
                <input
                  ref={passwordRef}
                  type="password"
                  placeholder="senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doLogin()}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white/5 border border-white/8 text-white placeholder-zinc-600 focus:outline-none focus:border-white/25 transition-colors"
                />
                <button
                  onClick={doLogin}
                  disabled={loginLoading || !password}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: selectedUser.color, color: "#000" }}
                >
                  {loginLoading ? "entrando..." : "entrar"}
                </button>
              </div>

              <p className="text-center text-zinc-700 text-xs mt-4">
                sem senha? use{" "}
                <span className="text-zinc-500 font-mono">/senha</span> no Discord
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex flex-col h-screen">
          <header
            className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
            style={{
              background: "rgba(8,8,8,0.92)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" style={{ color: "#a78bfa" }} />
              <span className="font-black text-xs uppercase tracking-widest">EMAILSNOAH</span>
            </div>

            {meUser && (
              <div className="flex items-center gap-2 ml-3">
                <UserAvatar
                  user={meUser}
                  avatarUrl={discordStatuses[meId]?.avatarUrl}
                  size={26}
                  statusDot={discordStatuses[meId]?.status ?? null}
                />
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: meUser.color }}
                >
                  {meName}
                </span>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => token && fetchInbox(token)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={doLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                sair
              </button>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <aside
              className="flex flex-col w-72 flex-shrink-0 overflow-hidden"
              style={{
                background: "rgba(6,6,6,0.88)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="flex border-b border-white/5 flex-shrink-0">
                {(
                  [
                    { key: "inbox", icon: Inbox, label: "inbox" },
                    { key: "mensagens", icon: MessageSquare, label: "msgs" },
                    { key: "perfis", icon: Users, label: "perfis" },
                  ] as const
                ).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs uppercase tracking-wider font-bold transition-colors"
                    style={{
                      color: activeTab === key ? "#a78bfa" : "#555",
                      borderBottom:
                        activeTab === key ? "2px solid #a78bfa" : "2px solid transparent",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "inbox" || activeTab === "mensagens" ? (
                <>
                  <div className="p-2 flex-shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                      <input
                        type="text"
                        placeholder="buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg text-xs bg-white/5 border border-white/8 text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                  </div>

                  {activeTab === "inbox" && addresses.length > 0 && (
                    <div className="px-3 pb-2 flex-shrink-0">
                      <div className="flex flex-wrap gap-1">
                        {addresses.map((addr) => (
                          <span
                            key={addr}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(167,139,250,0.12)",
                              color: "#a78bfa",
                              border: "1px solid rgba(167,139,250,0.2)",
                            }}
                          >
                            {addr.split("@")[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    {activeTab === "inbox" ? (
                      inboxLoading && emails.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
                          carregando...
                        </div>
                      ) : filteredEmails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2">
                          <Inbox className="w-6 h-6 opacity-40" />
                          {emails.length === 0 ? "inbox vazio" : "nenhum resultado"}
                        </div>
                      ) : (
                        filteredEmails.map((email) => (
                          <button
                            key={email.id}
                            onClick={() => {
                              setSelectedEmail(email);
                              setSelectedDm(null);
                            }}
                            className="w-full text-left px-3 py-3 border-b transition-all duration-150"
                            style={{
                              borderColor: "rgba(255,255,255,0.05)",
                              background:
                                selectedEmail?.id === email.id
                                  ? "rgba(167,139,250,0.08)"
                                  : "transparent",
                              borderLeft:
                                selectedEmail?.id === email.id
                                  ? "2px solid #a78bfa"
                                  : "2px solid transparent",
                            }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-zinc-300 truncate flex-1">
                                {email.from_addr?.split("<")[0]?.trim() || email.from_addr}
                              </span>
                              <span className="text-xs text-zinc-600 flex-shrink-0">
                                {formatDate(email.received_at)}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-white truncate mb-0.5">
                              {email.subject || "(sem assunto)"}
                            </div>
                            {email.code && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-mono font-bold"
                                style={{
                                  background: "rgba(35,209,139,0.15)",
                                  color: "#23d18b",
                                }}
                              >
                                🔑 {email.code}
                              </span>
                            )}
                          </button>
                        ))
                      )
                    ) : filteredDms.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2">
                        <MessageSquare className="w-6 h-6 opacity-40" />
                        {discordMessages.length === 0 ? "nenhuma mensagem" : "nenhum resultado"}
                      </div>
                    ) : (
                      filteredDms.map((dm) => {
                        const fromUser = USERS.find((u) => u.id === dm.from_discord_id);
                        return (
                          <button
                            key={dm.id}
                            onClick={() => {
                              setSelectedDm(dm);
                              setSelectedEmail(null);
                            }}
                            className="w-full text-left px-3 py-3 border-b transition-all duration-150"
                            style={{
                              borderColor: "rgba(255,255,255,0.05)",
                              background:
                                selectedDm?.id === dm.id
                                  ? "rgba(88,101,242,0.08)"
                                  : "transparent",
                              borderLeft:
                                selectedDm?.id === dm.id
                                  ? "2px solid #5865f2"
                                  : "2px solid transparent",
                            }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                              <span
                                className="text-xs font-semibold truncate flex-1"
                                style={{ color: fromUser?.color ?? "#a78bfa" }}
                              >
                                {dm.from_name}
                              </span>
                              <span className="text-xs text-zinc-600 flex-shrink-0">
                                {formatDate(dm.sent_at)}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-white truncate mb-0.5">
                              {dm.subject}
                            </div>
                            <div className="text-xs text-zinc-600 truncate">{dm.body}</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {USERS.map((u) => {
                    const p = profiles.find((pr) => pr.discord_user_id === u.id);
                    const st = discordStatuses[u.id];
                    const avatarUrl =
                      st?.avatarUrl ||
                      p?.discord_avatar_url ||
                      p?.avatar_url ||
                      undefined;
                    return (
                      <a
                        key={u.id}
                        href={p ? `/${p.username}` : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-white/5"
                        style={{ border: `1px solid ${u.color}18` }}
                      >
                        <UserAvatar
                          user={u}
                          avatarUrl={avatarUrl}
                          size={40}
                          statusDot={st?.status ?? p?.discord_status ?? null}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-bold text-sm uppercase tracking-wide"
                            style={{ color: u.color }}
                          >
                            {u.name}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {st?.activity ||
                              (p?.discord_activity
                                ? (() => {
                                    try {
                                      const act = JSON.parse(p.discord_activity!);
                                      return act?.name || statusLabel(p.discord_status ?? null);
                                    } catch {
                                      return statusLabel(p?.discord_status ?? null);
                                    }
                                  })()
                                : statusLabel(st?.status ?? p?.discord_status ?? null))}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
            </aside>

            <main className="flex-1 overflow-hidden flex flex-col">
              {selectedDm ? (
                <div className="flex-1 overflow-y-auto p-6">
                  <button
                    onClick={() => setSelectedDm(null)}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    voltar
                  </button>
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "rgba(10,10,10,0.80)",
                      border: "1px solid rgba(88,101,242,0.15)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    <div
                      className="px-6 py-5"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(88,101,242,0.05)",
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {(() => {
                          const fromUser = USERS.find((u) => u.id === selectedDm.from_discord_id);
                          return fromUser ? (
                            <UserAvatar
                              user={fromUser}
                              avatarUrl={discordStatuses[fromUser.id]?.avatarUrl}
                              size={36}
                            />
                          ) : null;
                        })()}
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="font-bold text-sm"
                              style={{
                                color:
                                  USERS.find((u) => u.id === selectedDm.from_discord_id)?.color ??
                                  "#a78bfa",
                              }}
                            >
                              {selectedDm.from_name}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(88,101,242,0.2)", color: "#7289da" }}>
                              Discord
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500">
                            para {selectedDm.to_name} · {formatFullDate(selectedDm.sent_at)}
                          </div>
                        </div>
                      </div>
                      <h2 className="text-xl font-black leading-tight">{selectedDm.subject}</h2>
                    </div>
                    <div className="px-6 py-5">
                      <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedDm.body}
                      </p>
                    </div>
                  </div>
                </div>
              ) : !selectedEmail ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
                  <Mail className="w-14 h-14 opacity-20" />
                  <p className="text-sm uppercase tracking-widest">selecione um item para ler</p>
                  {(emails.length > 0 || discordMessages.length > 0) && (
                    <p className="text-xs text-zinc-700">
                      {emails.length} email{emails.length !== 1 ? "s" : ""} · {discordMessages.length} mensagem{discordMessages.length !== 1 ? "ns" : ""}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    voltar ao inbox
                  </button>

                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "rgba(10,10,10,0.80)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    <div
                      className="px-6 py-5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <h2 className="text-xl font-black mb-3 leading-tight">
                        {selectedEmail.subject || "(sem assunto)"}
                      </h2>

                      {selectedEmail.code && (
                        <div
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
                          style={{
                            background: "rgba(35,209,139,0.12)",
                            border: "1px solid rgba(35,209,139,0.25)",
                          }}
                        >
                          <span className="text-xs text-zinc-400 uppercase tracking-wider">
                            Código:
                          </span>
                          <span
                            className="font-mono font-black text-lg tracking-widest"
                            style={{ color: "#23d18b" }}
                          >
                            {selectedEmail.code}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 text-xs w-12 uppercase tracking-wider flex-shrink-0">
                            De
                          </span>
                          <span className="text-zinc-200">{selectedEmail.from_addr}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 text-xs w-12 uppercase tracking-wider flex-shrink-0">
                            Para
                          </span>
                          <span className="text-zinc-200">{selectedEmail.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 text-xs w-12 uppercase tracking-wider flex-shrink-0">
                            Data
                          </span>
                          <span className="text-zinc-400 text-xs">
                            {formatFullDate(selectedEmail.received_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const body = cleanBody(selectedEmail.body ?? "");
                      const urls = extractUrls(body);
                      const bodyNoUrls = body
                        .replace(/https?:\/\/[^\s]+/g, "")
                        .replace(/\n{3,}/g, "\n\n")
                        .trim();

                      return (
                        <div className="px-6 py-5 space-y-4">
                          {urls.length > 0 && (
                            <div
                              className="p-3 rounded-xl space-y-1.5"
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                                Links
                              </p>
                              {urls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors truncate"
                                >
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  {url}
                                </a>
                              ))}
                            </div>
                          )}
                          {bodyNoUrls && (
                            <pre
                              className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-sans"
                              style={{ wordBreak: "break-word" }}
                            >
                              {bodyNoUrls}
                            </pre>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
