import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  Sparkles,
  Link2,
  Users,
  HelpCircle,
  ExternalLink,
  Share2,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { FarenGlyph } from "@/components/edit/VisualOptionCard";

type Item = {
  label: string;
  icon: typeof LayoutGrid;
  href?: string;
  external?: boolean;
  soon?: boolean;
  active?: boolean;
  children?: Item[];
};

interface Props {
  children: ReactNode;
  /** Active key — "overview" / "personalize" / "links" / "comunidade" */
  active?: string;
}

export function DashboardLayout({ children, active = "overview" }: Props) {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const username = user?.username || "";
  const initials = (user?.displayName || username || "?").slice(0, 2).toUpperCase();
  const profileUrl = username ? `https://ikiss.me/${username}` : "";

  // Single-section sidebar — only what actually exists. No "soon" placeholders,
  // no duplicate links to the same edit page.
  const sections: { title: string; items: (Item & { key: string })[] }[] = [
    {
      title: "Painel",
      items: [
        { key: "overview", label: "Visão geral", icon: LayoutGrid, href: "/dashboard" },
        { key: "comunidade", label: "Comunidade", icon: Users, href: "/dashboard/comunidade" },
      ],
    },
  ];

  const copyShareLink = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({ title: "Link copiado", description: profileUrl });
    } catch {
      toast({ title: "Não foi possível copiar", description: "Copie manualmente: " + profileUrl });
    }
  };

  const renderItem = (item: Item & { key: string }) => {
    const Icon = item.icon;
    const isActive = item.key === active;
    const baseCls =
      "group w-full flex items-center gap-3 px-3 py-2 text-[12px] tracking-[0.12em] uppercase transition-colors rounded-xl";
    const stateCls = isActive
      ? "text-white bg-white/10"
      : "text-white/45 hover:text-white hover:bg-white/5";
    const inner = (
      <>
        <Icon className="w-4 h-4" strokeWidth={1.75} />
        <span className="flex-1 text-left font-semibold">{item.label}</span>
        {item.soon && (
          <span className="text-[8px] tracking-[0.2em] uppercase text-white/30 border border-white/10 px-1.5 py-0.5 rounded-full">
            soon
          </span>
        )}
      </>
    );
    if (item.soon || !item.href || item.href === "#") {
      return (
        <button key={item.key} disabled={item.soon} className={`${baseCls} ${stateCls} disabled:cursor-not-allowed`}>
          {inner}
        </button>
      );
    }
    return (
      <Link key={item.key} href={item.href} onClick={() => setOpen(false)} className={`${baseCls} ${stateCls}`}>
        {inner}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:sticky top-0 left-0 z-40 h-screen w-[260px] shrink-0 bg-zinc-950/90 md:bg-black/80 backdrop-blur-md border-r border-white/10 flex flex-col transition-transform`}
      >
        {/* Brand */}
        <Link href="/" className="px-5 h-14 border-b border-white/10 flex items-center gap-2.5">
          <FarenGlyph size={14} className="text-white" />
          <span className="text-sm font-bold tracking-[0.28em] uppercase text-white">IKISS</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4">
          {sections.map((section, i) => (
            <div key={i} className={i > 0 ? "mt-4" : ""}>
              {section.title && (
                <p className="px-5 mb-1 text-[9px] tracking-[0.3em] uppercase text-white/30 font-semibold">
                  {section.title}
                </p>
              )}
              <div className="px-2 flex flex-col">{section.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/10 flex flex-col gap-2">
          <Link
            href="/suporte"
            className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.18em] uppercase text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Central de Ajuda
          </Link>
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.18em] uppercase text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Minha página
            </a>
          )}
          <button
            onClick={copyShareLink}
            className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.18em] uppercase text-black bg-white hover:bg-white/90 rounded-xl transition-colors font-bold"
          >
            <Share2 className="w-3.5 h-3.5" /> Compartilhar perfil
          </button>

          {/* User chip */}
          <div className="mt-2 flex items-center gap-3 px-2 py-2 rounded-2xl bg-white/[0.04]">
            <Avatar className="w-9 h-9 rounded-full">
              {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={username} /> : null}
              <AvatarFallback className="bg-white/10 text-white text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white truncate">
                {username || "user"}
              </p>
              <p className="text-[9px] tracking-[0.2em] uppercase text-white/40 truncate">UID {user?.id ?? "—"}</p>
            </div>
            <button
              onClick={() => { logout(); setLocation("/login"); }}
              title="Sair"
              className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop (mobile) */}
      {open && (
        <button
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* ── Main ───────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 h-14 bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4">
          <span className="text-sm font-bold tracking-[0.28em] uppercase">IKISS</span>
          <button onClick={() => setOpen((s) => !s)} className="p-2 text-white/70 hover:text-white">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <main className="flex-1 px-4 md:px-10 py-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
