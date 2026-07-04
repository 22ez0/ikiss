import { useAuth } from "@/lib/auth";
import { useGetProfileAnalytics, useGetMyProfile } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  AtSign,
  Hash,
  Check,
  Circle,
  ArrowRight,
  Sparkles,
  Globe2,
  ExternalLink,
  Pencil,
  Mail,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionHeader } from "@/components/edit/VisualOptionCard";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  const { data: analytics, isLoading: analyticsLoading } = useGetProfileAnalytics({
    query: { enabled: isAuthenticated },
  });
  const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated } });

  if (authLoading || !isAuthenticated) return null;

  const username = (profile as any)?.username || user?.username || "—";
  const displayName = (profile as any)?.displayName || username;
  const uid = user?.id ?? "—";
  const totalViews = analytics?.totalViews ?? 0;
  const viewsThisWeek = analytics?.viewsThisWeek ?? 0;
  const accentColor = (profile as any)?.accentColor || "#ffffff";
  const avatarUrl = (profile as any)?.avatarUrl || "";
  const bio = (profile as any)?.bio || "";

  /* ── Profile completion ─────────────────────────────────── */
  const steps = useMemo(() => {
    const p: any = profile || {};
    return [
      { key: "avatar", label: "Enviar um avatar", done: !!p.avatarUrl },
      { key: "bio", label: "Adicionar uma descrição", done: !!(p.bio && p.bio.trim().length > 0) },
      { key: "discord", label: "Vincular conta do Discord", done: !!p.discordConnected },
      { key: "links", label: "Adicionar redes sociais", done: Array.isArray(p.links) && p.links.length > 0 },
      { key: "views", label: "Alcance 10 visualizações de perfil", done: totalViews >= 10 },
    ];
  }, [profile, totalViews]);
  const completionPct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);

  /* ── Sparkline data (views per day) ─────────────────────── */
  const viewsByDay = analytics?.viewsByDay ?? [];
  const spark = useMemo(() => {
    if (!viewsByDay.length) return null;
    const w = 600;
    const h = 110;
    const maxV = Math.max(1, ...viewsByDay.map((d) => d.count));
    const stepX = viewsByDay.length > 1 ? w / (viewsByDay.length - 1) : 0;
    const points = viewsByDay.map((d, i) => {
      const x = i * stepX;
      const y = h - (d.count / maxV) * (h - 10) - 4;
      return [x, y] as const;
    });
    const path =
      "M " +
      points.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
    const area =
      `M 0 ${h} L ` +
      points.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ") +
      ` L ${w} ${h} Z`;
    return { w, h, path, area };
  }, [viewsByDay]);

  const initials = (displayName || username || "?").slice(0, 2).toUpperCase();
  const linksCount = Array.isArray((profile as any)?.links) ? (profile as any).links.length : 0;
  const badgesCount = Array.isArray((profile as any)?.badges) ? (profile as any).badges.length : 0;

  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);
  const showEmailBanner = !emailBannerDismissed && (
    window.location.search.includes("emailVerification=pending") ||
    (user as any)?.emailVerified === false
  );

  return (
    <DashboardLayout active="overview">
      {/* ── Email Verification Banner ─────────────────────── */}
      {showEmailBanner && (
        <div className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-200 font-medium">Verifique seu email</p>
            <p className="text-xs text-amber-200/60 mt-0.5">
              Enviamos um link para <strong>{user?.email ?? "seu email"}</strong>. Clique nele para confirmar sua conta.
            </p>
          </div>
          <button
            onClick={() => setEmailBannerDismissed(true)}
            className="text-amber-400/60 hover:text-amber-400 transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Title ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-[0.04em] uppercase">
            Visão geral
          </h1>
          <p className="mt-1.5 text-[10px] tracking-[0.25em] uppercase text-white/40 font-semibold">
            ikiss.me/{username}
          </p>
        </div>
        <Link
          href="/dashboard/edit"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white/90 transition-colors"
          data-testid="link-edit-profile"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar perfil
        </Link>
      </div>

      {/* ── HERO: real profile preview + KPI sidebar ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        {/* Live profile card */}
        <div
          className="lg:col-span-2 relative rounded-2xl border border-white/10 overflow-hidden min-h-[320px] bg-gradient-to-br from-zinc-900 via-black to-zinc-950"
          data-testid="hero-profile-preview"
        >
          {/* Soft accent glow keyed off the user's accent color */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{
              background: `radial-gradient(circle at 25% 20%, ${accentColor}33 0%, transparent 55%), radial-gradient(circle at 80% 90%, ${accentColor}1f 0%, transparent 55%)`,
            }}
          />
          {/* Header strip */}
          <div className="relative flex items-center justify-between px-5 py-3 border-b border-white/8 bg-black/30 backdrop-blur-sm">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold">
              Sua página pública
            </span>
            <a
              href={`/${username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
              data-testid="link-open-profile"
            >
              Abrir <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative p-6 md:p-8 flex flex-col items-center text-center min-h-[260px] justify-center">
            <div
              className="w-24 h-24 rounded-full overflow-hidden border-2 flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-black/60"
              style={{
                borderColor: `${accentColor}66`,
                background: `${accentColor}10`,
                boxShadow: `0 0 36px ${accentColor}33`,
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <p className="mt-4 text-xl md:text-2xl font-bold text-white">{displayName}</p>
            <p className="mt-1 text-[11px] tracking-[0.2em] uppercase text-white/40 font-semibold">
              @{username}
            </p>
            {bio && (
              <p className="mt-4 text-sm text-white/70 max-w-md leading-relaxed">{bio}</p>
            )}
            {!bio && (
              <Link
                href="/dashboard/edit"
                className="mt-4 text-[11px] tracking-[0.2em] uppercase text-white/40 hover:text-white transition-colors"
              >
                + Adicionar uma bio
              </Link>
            )}

            {/* Stat strip */}
            <div className="mt-6 flex items-center gap-6 text-center">
              <Stat label="Views" value={totalViews.toLocaleString()} />
              <Divider />
              <Stat label="Links" value={String(linksCount)} />
              <Divider />
              <Stat label="Badges" value={String(badgesCount)} />
              <Divider />
              <Stat label="UID" value={String(uid)} />
            </div>
          </div>
        </div>

        {/* KPI compact stack */}
        <div className="flex flex-col gap-4">
          <KpiCard
            icon={<Eye className="w-3.5 h-3.5" />}
            label="Visualizações totais"
            value={analyticsLoading ? <Skeleton className="h-7 w-16 bg-white/5" /> : totalViews.toLocaleString()}
            sub={`+${viewsThisWeek} nos últimos 7 dias`}
            accent={accentColor}
          />
          <KpiCard
            icon={<AtSign className="w-3.5 h-3.5" />}
            label="Aliases livres"
            value={<span className="text-white/45">0 / 0</span>}
            sub="Disponível em planos futuros"
            accent={accentColor}
          />
          <KpiCard
            icon={<Hash className="w-3.5 h-3.5" />}
            label="Sua posição"
            value={`#${uid}`}
            sub="Entre os primeiros usuários"
            accent={accentColor}
          />
        </div>
      </div>

      {/* ── Completion ───────────────────────────────────────── */}
      <div className="border border-white/10 p-5 md:p-6 bg-white/[0.02] rounded-2xl mb-10">
        <SectionHeader
          title="Conclusão do perfil"
          subtitle="Cada item completo aumenta o quanto seu perfil aparece e converte visitantes."
          right={
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white">
              {completionPct}%
            </span>
          }
        />
        <div className="h-1.5 bg-white/5 overflow-hidden rounded-full">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, #fff, ${accentColor})` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {steps.map((s) => (
            <Link
              key={s.key}
              href="/dashboard/edit"
              data-testid={`step-${s.key}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                s.done
                  ? "border-white/15 bg-white/[0.04] text-white"
                  : "border-white/10 hover:border-white/30 hover:bg-white/[0.03] text-white/70 hover:text-white"
              }`}
            >
              {s.done ? (
                <Check className="w-3.5 h-3.5 text-white shrink-0" strokeWidth={2.5} />
              ) : (
                <Circle className="w-3.5 h-3.5 text-white/40 shrink-0" />
              )}
              <span className="text-[12px] font-semibold tracking-[0.08em] uppercase">{s.label}</span>
              <ArrowRight className="w-3 h-3 ml-auto text-white/30" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── Stats: views chart + top countries ──────────────── */}
      <div id="stats" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-white/10 p-5 md:p-6 bg-white/[0.02] rounded-2xl">
          <SectionHeader
            title="Visitas nos últimos 7 dias"
            right={
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white">
                {viewsThisWeek.toLocaleString()}
              </span>
            }
          />
          {analyticsLoading ? (
            <Skeleton className="h-32 w-full bg-white/5" />
          ) : spark && viewsByDay.length > 0 ? (
            <svg viewBox={`0 0 ${spark.w} ${spark.h}`} className="w-full h-32" preserveAspectRatio="none">
              <defs>
                <linearGradient id="vSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`${accentColor}55`} />
                  <stop offset="100%" stopColor={`${accentColor}00`} />
                </linearGradient>
              </defs>
              <path d={spark.area} fill="url(#vSpark)" />
              <path d={spark.path} fill="none" stroke={accentColor} strokeWidth={1.4} />
            </svg>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-center gap-2">
              <Sparkles className="w-5 h-5 text-white/20" />
              <p className="text-[11px] tracking-[0.2em] uppercase text-white/30 font-semibold">
                Sem visitas ainda
              </p>
              <Link
                href="/dashboard/edit"
                className="text-[11px] text-white/55 hover:text-white underline underline-offset-4"
              >
                Compartilhe seu link para começar
              </Link>
            </div>
          )}
        </div>

        <div className="border border-white/10 p-5 md:p-6 bg-white/[0.02] rounded-2xl">
          <SectionHeader title="Principais países" />
          {analyticsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 bg-white/5" />
              ))}
            </div>
          ) : analytics?.topCountries && analytics.topCountries.length > 0 ? (
            <div className="space-y-2">
              {analytics.topCountries.slice(0, 5).map((c, i) => {
                const max = analytics.topCountries[0].count;
                const pct = Math.round((c.count / max) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.1em] uppercase text-white/80">
                        <Globe2 className="w-3 h-3 text-white/30" /> {c.country || "Desconhecido"}
                      </span>
                      <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 font-semibold">
                        {c.count}
                      </span>
                    </div>
                    <div className="h-px bg-white/5">
                      <div className="h-full" style={{ width: `${pct}%`, background: accentColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Globe2 className="w-5 h-5 text-white/20 mx-auto" />
              <p className="mt-2 text-[10px] tracking-[0.22em] uppercase text-white/30 font-semibold">
                Sem dados ainda
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg md:text-xl font-bold text-white leading-none">{value}</p>
      <p className="mt-1.5 text-[9px] tracking-[0.25em] uppercase text-white/40 font-semibold">
        {label}
      </p>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="w-px h-6 bg-white/10" />;
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  accent: string;
}) {
  return (
    <div className="relative border border-white/10 p-5 bg-white/[0.02] flex flex-col gap-2 rounded-2xl overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(circle at 100% 0%, ${accent}1f 0%, transparent 60%)` }}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">{label}</p>
        <span className="text-white/35">{icon}</span>
      </div>
      <div className="relative text-2xl font-bold tracking-tight text-white">{value}</div>
      <p className="relative text-[10px] tracking-[0.18em] uppercase text-white/35 font-semibold">{sub}</p>
    </div>
  );
}
