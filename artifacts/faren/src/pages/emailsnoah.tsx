import { useState, useEffect, useRef, useCallback } from "react";
import { Mail, Inbox, Star, Send, Trash2, ChevronRight, ArrowLeft, LogOut, RefreshCw, Search, Paperclip, ExternalLink, Eye, Users } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const USERS = [
  { id: "1424456058012696769", name: "bella", color: "#e879f9" },
  { id: "1495245938116005908", name: "noah", color: "#38bdf8" },
  { id: "1499585365328134247", name: "erick", color: "#34d399" },
];

interface InboxEmail {
  id: number;
  address: string;
  from_addr: string;
  subject: string;
  body: string;
  code: string | null;
  received_at: string;
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
  return "#747f8d";
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
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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

export default function EmailsNoah() {
  const [step, setStep] = useState<"login" | "app">("login");
  const [selectedUser, setSelectedUser] = useState<typeof USERS[0] | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [meId, setMeId] = useState<string>("");
  const [meName, setMeName] = useState<string>("");

  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"inbox" | "profiles">("inbox");

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
      const data = await res.json() as { ok?: boolean; token?: string; name?: string; discordUserId?: string; error?: string };
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
      const res = await fetch(`${API_BASE}/api/emailsnoah/inbox?limit=30`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (res.status === 401) { doLogout(); return; }
      const data = await res.json() as { emails?: InboxEmail[]; addresses?: string[] };
      setEmails(data.emails ?? []);
      setAddresses(data.addresses ?? []);
    } catch {}
    setInboxLoading(false);
  }, []);

  const fetchProfiles = useCallback(async (tk: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/emailsnoah/profiles`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { profiles?: ProfileData[] };
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
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [step, token, fetchInbox, fetchProfiles]);

  function doLogout() {
    localStorage.removeItem("emailsnoah_token");
    localStorage.removeItem("emailsnoah_id");
    localStorage.removeItem("emailsnoah_name");
    setToken(null);
    setStep("login");
    setSelectedUser(null);
    setPassword("");
    setEmails([]);
    setSelectedEmail(null);
    setProfiles([]);
  }

  const meUser = USERS.find((u) => u.id === meId);
  const meProfile = profiles.find((p) => p.discord_user_id === meId);

  const filteredEmails = emails.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.subject?.toLowerCase().includes(q) ||
      e.from_addr?.toLowerCase().includes(q) ||
      e.body?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <video
        src="/emailsnoah-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.18, filter: "blur(2px)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 pointer-events-none" />

      {step === "login" ? (
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-md">
            <div
              className="rounded-2xl p-8"
              style={{
                background: "rgba(10,10,10,0.85)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(24px)",
              }}
            >
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Mail className="w-6 h-6" style={{ color: "#a78bfa" }} />
                  <span className="text-xs tracking-[0.3em] uppercase text-zinc-400">faren.com.br</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight uppercase mb-1">EMAILSNOAH</h1>
                <p className="text-zinc-500 text-sm">área privada — acesso restrito</p>
              </div>

              {!selectedUser ? (
                <>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest text-center mb-4">quem é você?</p>
                  <div className="space-y-2">
                    {USERS.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setLoginError("");
                          setTimeout(() => passwordRef.current?.focus(), 100);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${u.color}30`,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = `${u.color}12`;
                          (e.currentTarget as HTMLButtonElement).style.border = `1px solid ${u.color}60`;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                          (e.currentTarget as HTMLButtonElement).style.border = `1px solid ${u.color}30`;
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg uppercase flex-shrink-0"
                          style={{ background: u.color + "22", color: u.color, border: `2px solid ${u.color}` }}
                        >
                          {u.name[0]}
                        </div>
                        <div className="text-left">
                          <div className="font-bold uppercase tracking-wide" style={{ color: u.color }}>{u.name}</div>
                          <div className="text-xs text-zinc-500">clique para entrar</div>
                        </div>
                        <ChevronRight className="ml-auto w-4 h-4 text-zinc-600" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setSelectedUser(null); setLoginError(""); setPassword(""); }}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    voltar
                  </button>

                  <div className="flex items-center gap-3 mb-6 p-3 rounded-xl" style={{ background: `${selectedUser.color}12`, border: `1px solid ${selectedUser.color}30` }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg uppercase flex-shrink-0" style={{ background: selectedUser.color + "22", color: selectedUser.color, border: `2px solid ${selectedUser.color}` }}>
                      {selectedUser.name[0]}
                    </div>
                    <div>
                      <div className="font-bold uppercase tracking-wide" style={{ color: selectedUser.color }}>{selectedUser.name}</div>
                      <div className="text-xs text-zinc-500">insira sua senha</div>
                    </div>
                  </div>

                  {loginError && (
                    <div className="mb-4 p-3 rounded-lg text-sm text-red-400" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      {loginError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <input
                      ref={passwordRef}
                      type="password"
                      placeholder="senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doLogin()}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
                    />
                    <button
                      onClick={doLogin}
                      disabled={loginLoading || !password}
                      className="w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: selectedUser.color, color: "#000" }}
                    >
                      {loginLoading ? "entrando..." : "entrar"}
                    </button>
                  </div>

                  <p className="text-center text-zinc-600 text-xs mt-5">
                    sem senha? use <span className="text-zinc-400 font-mono">/senha</span> no Discord
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col h-screen">
          <header
            className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
            style={{ background: "rgba(8,8,8,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5" style={{ color: "#a78bfa" }} />
              <span className="font-black text-sm uppercase tracking-widest">EMAILSNOAH</span>
            </div>

            {meUser && (
              <div className="flex items-center gap-2 ml-4">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-black text-sm uppercase"
                  style={{ background: meUser.color + "22", color: meUser.color, border: `1.5px solid ${meUser.color}` }}
                >
                  {meUser.name[0]}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meUser.color }}>{meName}</span>
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
              style={{ background: "rgba(6,6,6,0.88)", borderRight: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}
            >
              <div className="flex border-b border-white/5 flex-shrink-0">
                <button
                  onClick={() => setActiveTab("inbox")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs uppercase tracking-wider font-bold transition-colors"
                  style={{ color: activeTab === "inbox" ? "#a78bfa" : "#555", borderBottom: activeTab === "inbox" ? "2px solid #a78bfa" : "2px solid transparent" }}
                >
                  <Inbox className="w-3.5 h-3.5" />
                  inbox
                </button>
                <button
                  onClick={() => setActiveTab("profiles")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs uppercase tracking-wider font-bold transition-colors"
                  style={{ color: activeTab === "profiles" ? "#a78bfa" : "#555", borderBottom: activeTab === "profiles" ? "2px solid #a78bfa" : "2px solid transparent" }}
                >
                  <Users className="w-3.5 h-3.5" />
                  perfis
                </button>
              </div>

              {activeTab === "inbox" ? (
                <>
                  <div className="p-2 flex-shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                      <input
                        type="text"
                        placeholder="buscar emails..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg text-xs bg-white/5 border border-white/8 text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                  </div>

                  {addresses.length > 0 && (
                    <div className="px-3 pb-2 flex-shrink-0">
                      <div className="flex flex-wrap gap-1">
                        {addresses.map((addr) => (
                          <span key={addr} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                            {addr.split("@")[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    {inboxLoading && emails.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">carregando...</div>
                    ) : filteredEmails.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2">
                        <Inbox className="w-6 h-6 opacity-40" />
                        {emails.length === 0 ? "inbox vazio" : "nenhum resultado"}
                      </div>
                    ) : (
                      filteredEmails.map((email) => (
                        <button
                          key={email.id}
                          onClick={() => setSelectedEmail(email)}
                          className="w-full text-left px-3 py-3 border-b transition-all duration-150"
                          style={{
                            borderColor: "rgba(255,255,255,0.05)",
                            background: selectedEmail?.id === email.id
                              ? "rgba(167,139,250,0.08)"
                              : "transparent",
                            borderLeft: selectedEmail?.id === email.id ? "2px solid #a78bfa" : "2px solid transparent",
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-zinc-300 truncate flex-1">
                              {email.from_addr?.split("<")[0]?.trim() || email.from_addr}
                            </span>
                            <span className="text-xs text-zinc-600 flex-shrink-0">{formatDate(email.received_at)}</span>
                          </div>
                          <div className="text-xs font-bold text-white truncate mb-0.5">
                            {email.subject || "(sem assunto)"}
                          </div>
                          <div className="flex items-center gap-2">
                            {email.code && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: "rgba(35,209,139,0.15)", color: "#23d18b" }}>
                                🔑 {email.code}
                              </span>
                            )}
                            <span className="text-xs text-zinc-600 truncate">{email.address}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {profiles.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">carregando perfis...</div>
                  ) : (
                    USERS.map((u) => {
                      const p = profiles.find((pr) => pr.discord_user_id === u.id);
                      const avatar = p?.discord_avatar_url || p?.avatar_url;
                      return (
                        <a
                          key={u.id}
                          href={p ? `/${p.username}` : "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-white/5 block"
                          style={{ border: `1px solid ${u.color}20` }}
                        >
                          <div className="relative flex-shrink-0">
                            {avatar ? (
                              <img src={avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover" style={{ border: `2px solid ${u.color}` }} />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg uppercase" style={{ background: u.color + "22", color: u.color, border: `2px solid ${u.color}` }}>
                                {u.name[0]}
                              </div>
                            )}
                            {p?.discord_status && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black"
                                style={{ background: statusColor(p.discord_status) }}
                                title={statusLabel(p.discord_status)}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm uppercase tracking-wide" style={{ color: u.color }}>{u.name}</span>
                              {p?.discord_nitro && <span className="text-xs px-1 rounded" style={{ background: "rgba(88,101,242,0.25)", color: "#7289da" }}>Nitro</span>}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">
                              {p?.discord_activity
                                ? (() => {
                                    try { const act = JSON.parse(p.discord_activity); return act?.name || p.discord_status || "—"; } catch { return p.discord_status || "—"; }
                                  })()
                                : statusLabel(p?.discord_status ?? null)}
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />
                        </a>
                      );
                    })
                  )}
                </div>
              )}
            </aside>

            <main className="flex-1 overflow-hidden flex flex-col">
              {!selectedEmail ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
                  <Mail className="w-14 h-14 opacity-20" />
                  <p className="text-sm uppercase tracking-widest">selecione um email para ler</p>
                  {emails.length > 0 && (
                    <p className="text-xs text-zinc-700">{emails.length} email{emails.length !== 1 ? "s" : ""} no inbox</p>
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
                    <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <h2 className="text-xl font-black mb-3 leading-tight">
                        {selectedEmail.subject || "(sem assunto)"}
                      </h2>

                      {selectedEmail.code && (
                        <div
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
                          style={{ background: "rgba(35,209,139,0.12)", border: "1px solid rgba(35,209,139,0.25)" }}
                        >
                          <span className="text-xs text-zinc-400 uppercase tracking-wider">Código:</span>
                          <span className="font-mono font-black text-lg tracking-widest" style={{ color: "#23d18b" }}>
                            {selectedEmail.code}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 text-xs w-12 uppercase tracking-wider flex-shrink-0">De</span>
                          <span className="text-zinc-200">{selectedEmail.from_addr}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 text-xs w-12 uppercase tracking-wider flex-shrink-0">Para</span>
                          <span className="text-zinc-200">{selectedEmail.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 text-xs w-12 uppercase tracking-wider flex-shrink-0">Data</span>
                          <span className="text-zinc-400 text-xs">{formatFullDate(selectedEmail.received_at)}</span>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const body = cleanBody(selectedEmail.body ?? "");
                      const urls = extractUrls(body);
                      const bodyNoUrls = body.replace(/https?:\/\/[^\s]+/g, "").replace(/\n{3,}/g, "\n\n").trim();

                      return (
                        <div className="px-6 py-5 space-y-4">
                          {urls.length > 0 && (
                            <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Links</p>
                              {urls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm hover:underline break-all"
                                  style={{ color: "#a78bfa" }}
                                >
                                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                  {url.length > 80 ? url.slice(0, 80) + "..." : url}
                                </a>
                              ))}
                            </div>
                          )}

                          {bodyNoUrls && (
                            <div>
                              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Conteúdo</p>
                              <pre
                                className="text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed"
                                style={{ fontFamily: "inherit" }}
                              >
                                {bodyNoUrls}
                              </pre>
                            </div>
                          )}

                          {!bodyNoUrls && !urls.length && (
                            <p className="text-zinc-600 text-sm italic">corpo do email vazio.</p>
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

      <div
        className="fixed bottom-4 right-4 z-20 rounded-xl overflow-hidden shadow-2xl"
        style={{ border: "1px solid rgba(255,255,255,0.08)", width: 260 }}
      >
        <iframe
          src="https://open.spotify.com/embed/playlist/5oS4loJrmrR72LVIs8dCPB?utm_source=generator&theme=0"
          width="260"
          height="80"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
}
