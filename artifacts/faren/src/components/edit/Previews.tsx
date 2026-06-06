import { ReactNode, useMemo } from "react";
import { motion } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────────
 * Faren preview library — every "choice" in the dashboard renders one of
 * these. The point: a user sees the EFFECT before clicking, instead of
 * picking blind. This is how Faren stops looking like guns.lol.
 * ─────────────────────────────────────────────────────────────────────── */

/* ── helpers ─────────────────────────────────────────────────────────── */

function PreviewFrame({
  children,
  bg,
  className = "",
}: {
  children?: ReactNode;
  bg?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{
        background:
          bg ??
          "radial-gradient(circle at 50% 60%, #1a1a1f 0%, #08080a 70%)",
      }}
    >
      {children}
    </div>
  );
}

function rng(seed: number) {
  // tiny deterministic PRNG so previews are stable between renders
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/* ──────────────────────────────────────────────────────────────────────
 * PARTICLE PREVIEWS
 * Each one renders a tiny CSS-animated scene that hints at the real effect.
 * Keep them GPU-cheap — they show up in a 2-column grid.
 * ──────────────────────────────────────────────────────────────────── */

export function ParticlePreview({ kind }: { kind: string }) {
  const r = useMemo(() => rng(kind.charCodeAt(0) * 17 + 41), [kind]);
  const items = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ x: r() * 100, d: r() * 4 + 3, delay: r() * 4, key: i })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind],
  );

  if (kind === "none") {
    return (
      <PreviewFrame>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/25 font-semibold">
            sem efeito
          </span>
        </div>
      </PreviewFrame>
    );
  }

  // Render strategy varies per kind
  if (kind === "snow" || kind === "rain" || kind === "sakura") {
    const glyph = kind === "snow" ? "❄" : kind === "rain" ? "│" : "✿";
    const color =
      kind === "snow" ? "#fff" : kind === "rain" ? "#9ec5ff" : "#ff9bd1";
    const speed = kind === "rain" ? 1.2 : kind === "snow" ? 5 : 4;
    return (
      <PreviewFrame>
        {items.map((it) => (
          <motion.span
            key={it.key}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: ["-10%", "110%"], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: speed + it.d * 0.3,
              delay: it.delay,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute text-[10px] select-none"
            style={{ left: `${it.x}%`, color, textShadow: `0 0 4px ${color}` }}
          >
            {glyph}
          </motion.span>
        ))}
      </PreviewFrame>
    );
  }

  if (kind === "stars" || kind === "fireflies") {
    const color = kind === "stars" ? "#fff" : "#ffd17a";
    const glyph = kind === "stars" ? "✦" : "•";
    return (
      <PreviewFrame>
        {items.map((it) => (
          <motion.span
            key={it.key}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 0.4, 1, 0],
              scale: [0.6, 1, 0.8, 1, 0.6],
              x: [0, (r() - 0.5) * 30, 0],
              y: [0, (r() - 0.5) * 30, 0],
            }}
            transition={{
              duration: 3 + it.d * 0.4,
              delay: it.delay,
              repeat: Infinity,
            }}
            className="absolute text-[12px] select-none"
            style={{
              left: `${it.x}%`,
              top: `${(it.key * 7) % 90}%`,
              color,
              textShadow: `0 0 8px ${color}`,
            }}
          >
            {glyph}
          </motion.span>
        ))}
      </PreviewFrame>
    );
  }

  if (kind === "bubbles") {
    return (
      <PreviewFrame bg="radial-gradient(circle at 50% 100%, #0a2538 0%, #04070d 70%)">
        {items.map((it) => (
          <motion.span
            key={it.key}
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: ["110%", "-20%"], opacity: [0, 1, 0] }}
            transition={{
              duration: 4 + it.d * 0.4,
              delay: it.delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
            className="absolute rounded-full border border-cyan-200/60"
            style={{
              left: `${it.x}%`,
              width: 6 + it.d,
              height: 6 + it.d,
              background:
                "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), rgba(120,200,255,0.0) 70%)",
            }}
          />
        ))}
      </PreviewFrame>
    );
  }

  if (kind === "raio") {
    return (
      <PreviewFrame bg="linear-gradient(180deg, #0b0c20 0%, #04050d 100%)">
        {[0, 0.6, 1.2].map((delay, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0, 1, 0] }}
            transition={{ duration: 0.7, delay, repeat: Infinity, repeatDelay: 1.4 }}
            className="absolute text-3xl"
            style={{
              left: `${20 + i * 25}%`,
              top: "10%",
              color: "#a3d8ff",
              textShadow: "0 0 18px #6fb6ff",
            }}
          >
            ⚡
          </motion.span>
        ))}
        <motion.div
          animate={{ opacity: [0, 0.25, 0, 0.15, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 1.4 }}
          className="absolute inset-0 bg-cyan-200"
        />
      </PreviewFrame>
    );
  }

  return <PreviewFrame />;
}

/* ──────────────────────────────────────────────────────────────────────
 * CLICK EFFECT PREVIEWS
 * A simulated cursor "clicks" inside the card on a loop, spawning the FX.
 * ──────────────────────────────────────────────────────────────────── */

export function ClickPreview({ kind }: { kind: string }) {
  if (kind === "none") {
    return (
      <PreviewFrame>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/25 font-semibold">
            sem efeito
          </span>
        </div>
      </PreviewFrame>
    );
  }
  const glyph =
    kind === "hearts" ? "❤" : kind === "stars" ? "★" : kind === "sparkles" ? "✦" : "✺";
  const color =
    kind === "hearts" ? "#ff5e85" : kind === "stars" ? "#ffd24a" : kind === "sparkles" ? "#fff" : "#ff7a3d";

  return (
    <PreviewFrame>
      {/* simulated cursor that "clicks" at the center */}
      <motion.div
        animate={{
          left: ["30%", "70%", "50%", "30%"],
          top: ["35%", "55%", "45%", "35%"],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-3 h-3 -ml-1.5 -mt-1.5 pointer-events-none"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3 fill-white drop-shadow">
          <path d="M2 1 L13 7 L8 8 L11 14 L9 15 L6 9 L2 12 Z" />
        </svg>
      </motion.div>
      {/* spawning glyphs at each "click" */}
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.4, 1.4, 1.6],
            y: [0, -28],
          }}
          transition={{
            duration: 1.1,
            delay: i,
            repeat: Infinity,
            repeatDelay: 3,
          }}
          className="absolute text-base select-none"
          style={{
            left: `${[30, 70, 50, 30][i]}%`,
            top: `${[35, 55, 45, 35][i]}%`,
            color,
            textShadow: `0 0 10px ${color}`,
          }}
        >
          {glyph}
        </motion.span>
      ))}
    </PreviewFrame>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * CURSOR PREVIEWS — show the real OS cursor inside the card on hover.
 * ──────────────────────────────────────────────────────────────────── */

export function CursorPreview({
  kind,
  customUrl,
}: {
  kind: string;
  customUrl?: string;
}) {
  const cursorValue = kind?.startsWith("url:")
    ? `url("${kind.slice(4)}") 0 0, auto`
    : kind === "none"
      ? "none"
      : kind || "auto";

  return (
    <PreviewFrame>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ cursor: cursorValue }}
      >
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold">
            passe o mouse
          </div>
          {customUrl && (
            <img
              src={customUrl}
              alt=""
              className="mt-3 mx-auto w-8 h-8 object-contain rounded border border-white/15"
            />
          )}
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * BACKGROUND TYPE PREVIEWS — image/gif/video vs solid color.
 * ──────────────────────────────────────────────────────────────────── */

export function BackgroundTypePreview({ kind }: { kind: "image" | "color" }) {
  if (kind === "color") {
    return (
      <PreviewFrame bg="linear-gradient(135deg, #1a1a22 0%, #0a0a10 100%)">
        <div className="absolute inset-0 grid grid-cols-3">
          {["#0b0b0f", "#1f1f28", "#3a3a4a"].map((c) => (
            <div key={c} style={{ background: c }} />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-3 text-center text-[10px] uppercase tracking-[0.25em] text-white/55 font-semibold">
          uma cor sólida
        </div>
      </PreviewFrame>
    );
  }
  // image/video
  return (
    <PreviewFrame>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,140,255,0.4),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(255,140,200,0.3),transparent_60%)]" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 gap-px opacity-40">
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} className="bg-white/[0.04]" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-3 text-center text-[10px] uppercase tracking-[0.25em] text-white/70 font-semibold">
        imagem / gif / vídeo
      </div>
    </PreviewFrame>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * COLOR SWATCH PREVIEW — for accent / glow color cards.
 * ──────────────────────────────────────────────────────────────────── */

export function ColorPreview({
  color,
  glow = false,
}: {
  color: string;
  glow?: boolean;
}) {
  return (
    <PreviewFrame bg="#070709">
      {glow && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${color}55 0%, transparent 60%)`,
          }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-16 h-16 rounded-full border-2"
          style={{
            background: color,
            borderColor: "rgba(255,255,255,0.15)",
            boxShadow: glow ? `0 0 30px ${color}` : `0 0 0 rgba(0,0,0,0)`,
          }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-3 text-center text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold font-mono">
        {color}
      </div>
    </PreviewFrame>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * FONT PREVIEW
 * ──────────────────────────────────────────────────────────────────── */

const FONT_CLASS: Record<string, string> = {
  default: "font-sans",
  mono: "font-mono",
  cursive: "italic",
  serif: "font-serif",
  pixel: "font-mono tracking-[0.2em]",
};

export function FontPreview({
  kind,
  sample = "Ikiss",
}: {
  kind: string;
  sample?: string;
}) {
  return (
    <PreviewFrame>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white">
        <p className={`text-2xl ${FONT_CLASS[kind] || ""}`}>{sample}</p>
        <p className={`text-[11px] text-white/40 ${FONT_CLASS[kind] || ""}`}>
          abc · ABC · 0123
        </p>
      </div>
    </PreviewFrame>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * BADGE PREVIEW — renders the actual emblem chip the visitor will see.
 * ──────────────────────────────────────────────────────────────────── */

export function BadgePreview({
  emoji,
  label,
  color,
}: {
  emoji: string;
  label: string;
  color?: string;
}) {
  const c = color || "#ffffff";
  return (
    <PreviewFrame>
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <div
          className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border"
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            backgroundColor: "rgba(255,255,255,0.035)",
          }}
        >
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm leading-none shrink-0"
            style={{
              backgroundColor: `${c}1f`,
              color: c,
              border: `1px solid ${c}33`,
            }}
          >
            {emoji}
          </span>
          <span className="uppercase tracking-[0.14em] text-[10px] font-bold text-white/85 truncate">
            {label}
          </span>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * SOCIAL PLATFORM PREVIEW — used on the Links tab.
 * ──────────────────────────────────────────────────────────────────── */

export function SocialPlatformPreview({
  Icon,
  color,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}) {
  return (
    <PreviewFrame>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color}38 0%, transparent 65%)`,
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: `${color}26`,
            border: `1px solid ${color}55`,
            boxShadow: `0 0 20px ${color}44`,
          }}
        >
          <Icon className={"w-6 h-6"} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </PreviewFrame>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * TOGGLE PREVIEW — used for boolean settings (e.g. "Show view counter").
 * ──────────────────────────────────────────────────────────────────── */

export function TogglePreview({
  on,
  iconOn,
  iconOff,
}: {
  on: boolean;
  iconOn?: ReactNode;
  iconOff?: ReactNode;
}) {
  return (
    <PreviewFrame>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          layout
          className="flex items-center gap-3 px-5 py-3 rounded-full border bg-black/40"
          style={{
            borderColor: on ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)",
            boxShadow: on ? "0 0 24px rgba(255,255,255,0.2)" : "none",
          }}
        >
          <div
            className="w-12 h-6 rounded-full p-0.5 transition-colors"
            style={{ background: on ? "#fff" : "rgba(255,255,255,0.12)" }}
          >
            <motion.div
              layout
              className="w-5 h-5 rounded-full"
              style={{
                background: on ? "#000" : "rgba(255,255,255,0.6)",
                marginLeft: on ? 24 : 0,
              }}
              transition={{ type: "spring", stiffness: 700, damping: 30 }}
            />
          </div>
          <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white">
            {on ? "Visível" : "Oculto"}
          </span>
        </motion.div>
      </div>
      <div className="absolute inset-x-0 bottom-3 text-center text-white/40 text-base">
        {on ? iconOn : iconOff}
      </div>
    </PreviewFrame>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * CONNECTION CARD PREVIEW — used for Discord / Last.fm / Spotify.
 * Shows the connection chip as it'll appear on the public profile.
 * ──────────────────────────────────────────────────────────────────── */

export function ConnectionPreview({
  Icon,
  color,
  title,
  subtitle,
  connected,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  subtitle: string;
  connected: boolean;
}) {
  return (
    <PreviewFrame>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${color}28 0%, transparent 65%)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div
          className="w-full flex items-center gap-3 p-3 rounded-2xl border bg-black/40 backdrop-blur"
          style={{
            borderColor: connected ? `${color}80` : "rgba(255,255,255,0.1)",
            boxShadow: connected ? `0 0 24px ${color}33` : "none",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${color}22`, color }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white truncate">
              {title}
            </p>
            <p className="text-[10px] text-white/40 truncate">{subtitle}</p>
          </div>
          {connected ? (
            <span
              className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full"
              style={{ color, background: `${color}26`, border: `1px solid ${color}55` }}
            >
              Online
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full text-white/40 border border-white/15">
              Off
            </span>
          )}
        </div>
      </div>
    </PreviewFrame>
  );
}
