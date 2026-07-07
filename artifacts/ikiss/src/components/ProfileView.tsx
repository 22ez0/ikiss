import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicProfile } from "@workspace/api-client-react";
import {
  SiDiscord, SiSpotify, SiLastdotfm, SiGithub, SiX, SiYoutube, SiTwitch,
  SiInstagram, SiTiktok, SiSteam, SiKick, SiPatreon, SiSnapchat, SiReddit,
  SiPinterest, SiThreads, SiBluesky, SiSoundcloud, SiBandcamp,
  SiTelegram, SiPaypal, SiGitlab, SiFacebook, SiLinktree,
  SiLetterboxd, SiVk, SiKofi, SiBitcoin, SiEthereum, SiSolana, SiRoblox,
  SiVenmo, SiCashapp,
} from "react-icons/si";
import { FaPlaystation, FaLinkedin } from "react-icons/fa";
import {
  Link as LinkIcon, Music, BadgeCheck, Code, Gamepad2,
  Mic, Palette, Headphones, Star, Zap, Crown, Globe, Heart, Eye,
  Users, Mail, Gem, Play, Pause, SkipBack, SkipForward,
} from "lucide-react";
import ParticleCanvas from "./ParticleCanvas";
import ClickEffect from "./ClickEffect";
import TypewriterText from "./TypewriterText";
import { StoriesViewer, type StoryItem } from "./StoriesViewer";
import { PublicationCarousel, type PublicationItem } from "./PublicationCarousel";

interface GalleryItemPublic {
  id: number;
  mediaUrl: string;
  mediaType: string;
  caption?: string | null;
}

interface ProfileViewProps {
  profile: Partial<PublicProfile>;
  isOwner?: boolean;
  onFollow?: () => void;
  onLike?: () => void;
  isFollowing?: boolean;
  hasLiked?: boolean;
  username?: string;
}

const apiBase = () => (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

function renderBio(bio: string, accent: string) {
  const parts = bio.split(/(@[a-z0-9_]{1,15})/gi);
  return parts.map((part, i) => {
    if (/^@[a-z0-9_]{1,15}$/i.test(part)) {
      return (
        <a
          key={i}
          href={`/${part.slice(1).toLowerCase()}`}
          className="font-semibold hover:underline transition-colors"
          style={{ color: accent }}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function VerifiedBadge({ type }: { type: 'blue' | 'gold' | 'white' }) {
  const color = type === 'gold' ? '#FFD700' : type === 'white' ? '#FFFFFF' : '#3B82F6';
  const shadow = type === 'gold' ? '0 0 8px #FFD70080' : type === 'white' ? '0 0 8px #FFFFFF60' : '0 0 8px #3B82F680';
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className="flex-shrink-0 inline-block"
      style={{ filter: `drop-shadow(${shadow})` }}
      title={type === 'gold' ? 'Verificado Dourado' : type === 'white' ? 'Verificado' : 'Verificado'}
    >
      <path
        d="M12 1L14.5 4.5L19 3.5L18.5 8L22 10L19.5 13L21 17.5L16.5 17L14 21L12 18.5L10 21L7.5 17L3 17.5L4.5 13L2 10L5.5 8L5 3.5L9.5 4.5Z"
        fill={color}
      />
      <path
        d="M8.5 12L11 14.5L15.5 9.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const BADGE_MAP: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  verified:       { icon: BadgeCheck, label: "Verificado",          color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  verified_gold:  { icon: BadgeCheck, label: "Verificado Dourado",  color: "#FFD700", bg: "rgba(255,215,0,0.12)" },
  verified_white: { icon: BadgeCheck, label: "Verificado",          color: "#FFFFFF", bg: "rgba(255,255,255,0.12)" },
  creator:     { icon: Palette,    label: "Criador",             color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "music-head":{ icon: Headphones, label: "Amante de Música",    color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  gamer:       { icon: Gamepad2,   label: "Gamer",               color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  developer:   { icon: Code,       label: "Desenvolvedor",        color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  streamer:    { icon: Mic,        label: "Streamer",             color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  artist:      { icon: Palette,    label: "Artista",              color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  star:        { icon: Star,       label: "Estrela em Ascensão",  color: "#fde68a", bg: "rgba(253,230,138,0.12)" },
  og:          { icon: Crown,      label: "Membro OG",            color: "#c4b5fd", bg: "rgba(196,181,253,0.12)" },
  vip:         { icon: Zap,        label: "VIP",                  color: "#f9a8d4", bg: "rgba(249,168,212,0.12)" },
};

function isVideoMedia(url?: string | null) {
  if (!url) return false;
  return url.startsWith("data:video/") || /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url);
}

function isGifMedia(url?: string | null) {
  if (!url) return false;
  return url.startsWith("data:image/gif") || /\.gif(\?|#|$)/i.test(url);
}

function MediaFill({ src, alt, className = "" }: { src: string; alt?: string; className?: string }) {
  if (isVideoMedia(src)) {
    return (
      <video
        key={src}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }
  return <img key={src} src={src} alt={alt || ""} className={`w-full h-full object-cover ${className}`} />;
}

function parseCustomBadge(badgeId: string) {
  if (!badgeId.startsWith("custom|")) return null;
  const [, rawEmoji = "✨", color = "#ffffff", rawLabel = "Personalizado"] = badgeId.split("|");
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  return { emoji: decode(rawEmoji), color, label: decode(rawLabel) };
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  github: SiGithub, twitter: SiX, x: SiX, youtube: SiYoutube,
  twitch: SiTwitch, instagram: SiInstagram, discord: SiDiscord,
  spotify: SiSpotify, tiktok: SiTiktok, linkedin: FaLinkedin,
  steam: SiSteam, kick: SiKick, patreon: SiPatreon,
  snapchat: SiSnapchat, reddit: SiReddit, pinterest: SiPinterest,
  threads: SiThreads, bluesky: SiBluesky,
  soundcloud: SiSoundcloud, bandcamp: SiBandcamp,
  telegram: SiTelegram, paypal: SiPaypal, gitlab: SiGitlab,
  facebook: SiFacebook, linktree: SiLinktree, letterboxd: SiLetterboxd,
  vk: SiVk, kofi: SiKofi, bitcoin: SiBitcoin, ethereum: SiEthereum,
  solana: SiSolana, roblox: SiRoblox, venmo: SiVenmo, cashapp: SiCashapp,
  playstation: FaPlaystation, lastfm: SiLastdotfm,
  email: Mail, website: Globe,
};

const FONT_CLASSES: Record<string, string> = {
  default: "font-profile-default",
  mono: "font-profile-mono",
  cursive: "font-profile-cursive",
  serif: "font-profile-serif",
  pixel: "font-profile-pixel",
};

const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  idle: "#eab308",
  dnd: "#ef4444",
  offline: "#6b7280",
};

function DiscordStatus({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const label = status === 'dnd' ? 'Não Perturbe' : status === 'online' ? 'Online' : status === 'idle' ? 'Ausente' : 'Offline';
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-xs opacity-60">{label}</span>
    </div>
  );
}

function MusicPlayer({ musicUrl, musicTitle, musicIconUrl }: { musicUrl: string; musicTitle?: string | null; musicIconUrl?: string | null }) {
  const isSpotify = musicUrl.includes('spotify.com') || musicUrl.startsWith('spotify:');
  const isSoundCloud = musicUrl.includes('soundcloud.com');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (isSpotify || isSoundCloud) return;
    const audio = audioRef.current;
    if (!audio) return;
    const handleCanPlay = () => {
      audio.muted = false;
      audio.play().catch(() => {});
    };
    audio.addEventListener('canplay', handleCanPlay);
    return () => audio.removeEventListener('canplay', handleCanPlay);
  }, [isSpotify, isSoundCloud]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }
    audio.pause();
  };

  const seekBy = (amount: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + amount));
  };

  const seekTo = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setProgress(value);
  };

  if (isSpotify) {
    const trackMatch = musicUrl.match(/track\/([a-zA-Z0-9]+)/);
    const playlistMatch = musicUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    const albumMatch = musicUrl.match(/album\/([a-zA-Z0-9]+)/);
    let embedSrc = '';
    if (trackMatch?.[1]) {
      embedSrc = `https://open.spotify.com/embed/track/${trackMatch[1]}?utm_source=generator&theme=0&autoplay=1`;
    } else if (playlistMatch?.[1]) {
      embedSrc = `https://open.spotify.com/embed/playlist/${playlistMatch[1]}?utm_source=generator&theme=0&autoplay=1`;
    } else if (albumMatch?.[1]) {
      embedSrc = `https://open.spotify.com/embed/album/${albumMatch[1]}?utm_source=generator&theme=0&autoplay=1`;
    } else {
      return null;
    }
    return (
      <div className="w-full glass-card rounded-lg overflow-hidden mx-auto" style={{ maxWidth: 360 }}>
        <iframe
          src={embedSrc}
          width="100%"
          height="80"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="block"
        />
      </div>
    );
  }

  if (isSoundCloud) {
    return (
      <div className="w-full glass-card rounded-lg overflow-hidden mx-auto" style={{ maxWidth: 360 }}>
        <iframe
          width="100%"
          height="56"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(musicUrl)}&color=%23ff5500&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`}
          className="block"
        />
      </div>
    );
  }

  return (
    <div className="w-full glass-card rounded-2xl px-3 py-2.5">
      <div className="flex items-center gap-3">
        {musicIconUrl ? (
          <img src={musicIconUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-white/10 flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 bg-white/[0.03]">
            <Music className="w-6 h-6 text-white/45" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white font-semibold truncate mb-1">{musicTitle || "Áudio"}</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/65 tabular-nums w-8">{formatTime(progress)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={Math.min(progress, duration || progress)}
              onChange={(event) => seekTo(Number(event.target.value))}
              className="profile-audio-range flex-1"
              aria-label="Progresso da música"
            />
            <span className="text-[11px] text-white/65 tabular-nums w-8 text-right">{formatTime(duration)}</span>
            <button type="button" onClick={() => seekBy(-10)} className="text-white/55 hover:text-white transition-colors" aria-label="Voltar">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={togglePlay} className="text-white hover:text-white/80 transition-colors" aria-label={isPlaying ? "Pausar" : "Tocar"}>
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>
            <button type="button" onClick={() => seekBy(10)} className="text-white/55 hover:text-white transition-colors" aria-label="Avançar">
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        controlsList="nodownload noplaybackrate"
        disableRemotePlayback
        autoPlay
        loop
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onContextMenu={(event) => event.preventDefault()}
        className="hidden"
      >
        <source src={musicUrl} />
      </audio>
    </div>
  );
}

export default function ProfileView({ profile, isOwner, onFollow, onLike, isFollowing, hasLiked, username }: ProfileViewProps) {
  const [likePulse, setLikePulse] = useState(false);
  const [lanyardData, setLanyardData] = useState<any>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [entered, setEntered] = useState(!!isOwner);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [galleryItems, setGalleryItems] = useState<GalleryItemPublic[]>([]);
  const [galleryLightbox, setGalleryLightbox] = useState<GalleryItemPublic | null>(null);
  const [publications, setPublications] = useState<PublicationItem[]>([]);
  const [publicationOpen, setPublicationOpen] = useState<PublicationItem | null>(null);

  // Fetch active stories for this profile
  useEffect(() => {
    const target = (username || profile.username || "").toLowerCase();
    if (!target) return;
    let cancelled = false;
    fetch(`${apiBase()}/api/users/${encodeURIComponent(target)}/stories`)
      .then(r => r.ok ? r.json() : { stories: [] })
      .then(data => { if (!cancelled) setStories(Array.isArray(data?.stories) ? data.stories : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [username, profile.username]);

  // Fetch gallery for this profile (only used in wide layout, but cheap to fetch)
  useEffect(() => {
    const target = (username || profile.username || "").toLowerCase();
    if (!target) return;
    let cancelled = false;
    fetch(`${apiBase()}/api/users/${encodeURIComponent(target)}/gallery`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => { if (!cancelled) setGalleryItems(Array.isArray(data?.items) ? data.items : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [username, profile.username]);

  // Fetch publications for this profile
  useEffect(() => {
    const target = (username || profile.username || "").toLowerCase();
    if (!target) return;
    let cancelled = false;
    fetch(`${apiBase()}/api/users/${encodeURIComponent(target)}/publications`)
      .then(r => r.ok ? r.json() : { publications: [] })
      .then(data => { if (!cancelled) setPublications(Array.isArray(data?.publications) ? data.publications : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [username, profile.username]);

  const hasActiveStories = stories.length > 0;

  // Fire-and-forget view counter ping when a story is opened.
  const onStoryOpened = (storyId: number) => {
    fetch(`${apiBase()}/api/stories/${storyId}/view`, { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.viewsCount === "number") {
          setStories(prev => prev.map(s => s.id === storyId ? { ...s, viewsCount: data.viewsCount } : s));
        }
      })
      .catch(() => {});
  };

  const handleReport = async () => {
    if (!reportReason || reportLoading) return;
    setReportLoading(true);
    try {
      const target = username || profile.username;
      const res = await fetch(`${apiBase()}/api/users/${target}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      if (res.ok) { setReportSent(true); setTimeout(() => { setReportOpen(false); setReportSent(false); setReportReason(''); setReportDetails(''); }, 2500); }
    } catch { } finally { setReportLoading(false); }
  };

  const discordUserId = (profile as any).discordUserId as string | undefined;

  useEffect(() => {
    if (!discordUserId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${discordUserId}`);
        if (!res.ok || cancelled) return;
        const body = await res.json() as any;
        if (body.success && !cancelled) setLanyardData(body.data);
      } catch { }
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [discordUserId]);

  const liveDiscordStatus: string = lanyardData?.discord_status || (profile as any).discordStatus || "offline";
  const liveDiscordActivity: string | null = lanyardData?.activities?.[0]?.name || (profile as any).discordActivity || null;
  const liveDiscordUsername: string | null = lanyardData?.discord_user?.global_name || lanyardData?.discord_user?.username || (profile as any).discordUsername || null;
  const liveAvatarHash = lanyardData?.discord_user?.avatar;
  const liveDiscordAvatarUrl: string | null = liveAvatarHash && discordUserId
    ? `https://cdn.discordapp.com/avatars/${discordUserId}/${liveAvatarHash}.${liveAvatarHash.startsWith("a_") ? "gif" : "png"}?size=128`
    : (profile as any).discordAvatarUrl || null;

  useEffect(() => {
    if (isOwner) setEntered(true);
  }, [isOwner]);

  const accent = profile.accentColor || "#ffffff";
  const glow = profile.glowColor || accent;
  const fontClass = FONT_CLASSES[profile.fontFamily || "default"] || FONT_CLASSES.default;
  const layout = profile.layoutStyle || "centered";
  const particleEffect = profile.particleEffect || "none";
  const clickEffect = profile.clickEffect || "none";
  const showViews = profile.showViews !== false;
  const bgBlur = profile.backgroundBlur || 0;
  const rawBgOpacity = profile.backgroundOpacity ?? 60;
  const bgOpacity = rawBgOpacity <= 1 ? rawBgOpacity : rawBgOpacity / 100;
  const typewriterTexts = profile.typewriterTexts || [];
  const musicUrl = profile.musicUrl || '';
  const musicTitle = (profile as any).musicTitle || null;
  const musicIconUrl = (profile as any).musicIconUrl || null;
  const musicPrivate = (profile as any).musicPrivate === true;
  const showDiscordAvatar = (profile as any).showDiscordAvatar !== false;
  const showDiscordPresence = (profile as any).showDiscordPresence !== false;
  const backgroundType = (profile as any).backgroundType || 'image';
  const rawNameBorder = (profile as any).nameBorderOpacity;
  const nameBorderOpacity =
    rawNameBorder == null || Number.isNaN(Number(rawNameBorder))
      ? 0.07
      : Number(rawNameBorder) > 1
        ? Number(rawNameBorder) / 100
        : Number(rawNameBorder);
  const nameBorderColor = nameBorderOpacity <= 0
    ? 'transparent'
    : `rgba(255,255,255,${Math.min(1, nameBorderOpacity)})`;

  const cursorStyle = profile.cursorStyle || 'auto';
  const isCustomCursor = cursorStyle?.startsWith('url:');
  const cursorDataUrl = isCustomCursor ? cursorStyle.replace('url:', '') : null;

  const cursorClass =
    isCustomCursor ? '' :
    cursorStyle === "crosshair" ? "cursor-crosshair" :
    cursorStyle === "none" ? "cursor-none" :
    cursorStyle === "pointer" ? "cursor-pointer" :
    cursorStyle === "cell" ? "cursor-cell" :
    cursorStyle === "grab" ? "cursor-grab" :
    cursorStyle === "zoom-in" ? "cursor-zoom-in" :
    cursorStyle === "text" ? "cursor-text" :
    "cursor-auto";

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.id = 'custom-cursor-style';
    if (isCustomCursor && cursorDataUrl) {
      styleEl.textContent = `* { cursor: url("${cursorDataUrl}") 16 16, auto !important; }`;
    } else if (cursorStyle && cursorStyle !== 'auto') {
      styleEl.textContent = `* { cursor: ${cursorStyle} !important; }`;
    }
    if (styleEl.textContent) {
      document.head.appendChild(styleEl);
    }
    return () => { document.getElementById('custom-cursor-style')?.remove(); };
  }, [isCustomCursor, cursorDataUrl, cursorStyle]);

  const isLeft = layout === "left";
  const isFloating = layout === "floating";
  const isWide = layout === "wide";
  const alignClass = (isLeft || isWide) ? "items-start text-left" : "items-center text-center";

  const handleLike = () => {
    setLikePulse(true);
    setTimeout(() => setLikePulse(false), 500);
    onLike?.();
  };

  return (
    <>
      {/* Click-to-enter splash — keeps page silent and blurred until user interacts.
         Required so browsers allow audio/video autoplay with sound after the click. */}
      <AnimatePresence>
        {!isOwner && !entered && (
          <motion.button
            type="button"
            onClick={() => setEntered(true)}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[9998] w-full h-full flex items-center justify-center cursor-pointer"
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
            aria-label="Entrar no perfil"
          >
            {profile.backgroundUrl && backgroundType !== 'color' && !isVideoMedia(profile.backgroundUrl) && (
              <img
                src={profile.backgroundUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover -z-10"
                style={{ filter: 'blur(24px) brightness(0.4)', transform: 'scale(1.1)' }}
              />
            )}
            <motion.span
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className={`text-white text-base md:text-lg font-medium tracking-wide ${fontClass}`}
            >
              click to enter...
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

    <div className={`min-h-screen relative overflow-x-hidden ${isFloating ? 'flex flex-col justify-center' : ''} ${fontClass} ${cursorClass}`}>
      {/* Particle Effects */}
      <ParticleCanvas effect={particleEffect} accentColor={accent} />

      {/* Click Effects */}
      {clickEffect !== 'none' && <ClickEffect effect={clickEffect} />}

      {/* Background */}
      {profile.backgroundUrl && backgroundType === 'color' ? (
        <div
          className="fixed inset-0 z-0"
          style={{ backgroundColor: profile.backgroundUrl, opacity: bgOpacity }}
        />
      ) : profile.backgroundUrl && backgroundType === 'video' && !isGifMedia(profile.backgroundUrl) ? (
        <video
          key={profile.backgroundUrl}
          autoPlay muted loop playsInline
          className="fixed inset-0 w-full h-full object-cover z-0"
          style={{ opacity: bgOpacity, filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none' }}
        >
          <source src={profile.backgroundUrl} />
        </video>
      ) : profile.backgroundUrl ? (
        <div
          key={`bg-${backgroundType}-${profile.backgroundUrl.slice(0, 120)}`}
          className="fixed inset-0 z-0 overflow-hidden"
          style={{
            opacity: bgOpacity,
            filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none',
          }}
        >
          <MediaFill src={profile.backgroundUrl} alt="" />
        </div>
      ) : null}

      {/* Overlay — softer for cleaner look */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.78) 100%)` }}
      />

      {/* Content */}
      <div
        className={`relative z-10 ${isWide ? 'max-w-3xl' : isFloating ? 'max-w-sm' : 'max-w-md'} mx-auto px-5 ${isFloating ? 'py-8' : 'py-14 md:py-20'} flex flex-col ${alignClass} gap-0`}
        style={isFloating && nameBorderOpacity > 0 ? {
          background: 'rgba(20,20,22,0.45)',
          border: `1px solid ${nameBorderColor}`,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: `0 12px 40px rgba(0,0,0,0.45), 0 0 24px ${glow}10`,
          borderRadius: '24px',
          marginTop: '2rem',
          marginBottom: '2rem',
        } : undefined}
      >

        {/* Banner */}
        {profile.bannerUrl && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full h-40 md:h-52 mb-12 rounded-xl overflow-hidden relative"
            style={{ border: `1px solid ${accent}22` }}
          >
            <MediaFill src={profile.bannerUrl} alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </motion.div>
        )}

        {/* Avatar + Name — compact glass pill (minimalist, image-1 style) */}
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className={`flex ${isLeft ? '' : 'self-center'} items-center gap-3 mb-5 px-3.5 py-2.5 rounded-2xl`}
          style={
            isFloating
              ? { background: 'transparent', border: '1px solid transparent' }
              : {
                  background: nameBorderOpacity <= 0 ? 'transparent' : 'rgba(20,20,22,0.45)',
                  border: `1px solid ${nameBorderColor}`,
                  backdropFilter: nameBorderOpacity <= 0 ? 'none' : 'blur(14px)',
                  WebkitBackdropFilter: nameBorderOpacity <= 0 ? 'none' : 'blur(14px)',
                  boxShadow: nameBorderOpacity <= 0
                    ? 'none'
                    : `0 6px 30px rgba(0,0,0,0.35), 0 0 18px ${glow}12`,
                }
          }
        >
          <div className="relative flex-shrink-0">
            {/* Instagram Notes style status bubble */}
            {(() => {
              const statusText = (profile as any).statusText as string | null | undefined;
              const statusEmoji = (profile as any).statusEmoji as string | null | undefined;
              const statusColor = ((profile as any).statusColor as string | null | undefined) || accent;
              const statusExpiresAt = (profile as any).statusExpiresAt as string | null | undefined;
              if (!statusText) return null;
              if (statusExpiresAt) {
                const exp = new Date(statusExpiresAt).getTime();
                if (!Number.isNaN(exp) && exp <= Date.now()) return null;
              }
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 220, damping: 18 }}
                  className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 pointer-events-none whitespace-nowrap"
                  title={statusText}
                >
                  <div
                    className="relative px-2.5 py-1 rounded-full text-[11px] font-medium leading-none flex items-center gap-1 max-w-[180px]"
                    style={{
                      background: 'rgba(20,20,22,0.92)',
                      color: 'rgba(255,255,255,0.92)',
                      border: `1px solid ${statusColor}55`,
                      boxShadow: `0 4px 16px rgba(0,0,0,0.45), 0 0 10px ${statusColor}33`,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    {statusEmoji && <span className="emoji text-sm leading-none">{statusEmoji}</span>}
                    <span className="truncate">{statusText}</span>
                    {/* Note tail (two dots) */}
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-2 w-1.5 h-1.5 rounded-full"
                      style={{ background: 'rgba(20,20,22,0.92)', border: `1px solid ${statusColor}55` }}
                    />
                    <span
                      className="absolute -bottom-2.5 left-1/2 translate-x-0.5 w-1 h-1 rounded-full"
                      style={{ background: 'rgba(20,20,22,0.92)', border: `1px solid ${statusColor}55` }}
                    />
                  </div>
                </motion.div>
              );
            })()}

            {/* Edge-style blue/gray gradient ring when there are active stories.
               Acts as a button that opens the Stories viewer. */}
            <button
              type="button"
              onClick={() => { if (hasActiveStories) setStoriesOpen(true); }}
              disabled={!hasActiveStories}
              aria-label={hasActiveStories ? "Ver stories" : "Avatar"}
              className={`block rounded-full ${hasActiveStories ? 'cursor-pointer hover:opacity-90 transition-opacity' : 'cursor-default'}`}
              style={{
                padding: hasActiveStories ? 2 : 0,
                background: hasActiveStories
                  ? 'linear-gradient(135deg, #0078D4 0%, #50E6FF 45%, #8E9BAA 100%)'
                  : 'transparent',
                boxShadow: hasActiveStories
                  ? '0 0 14px rgba(80,230,255,0.55), 0 0 26px rgba(0,120,212,0.35)'
                  : 'none',
              }}
            >
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden relative"
                style={{
                  border: hasActiveStories
                    ? `2px solid #000`
                    : `1px solid ${accent}33`,
                }}
              >
                {profile.avatarUrl ? (
                  <MediaFill src={profile.avatarUrl} alt={profile.username} />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-base font-bold"
                    style={{ backgroundColor: `${accent}20`, color: accent }}
                  >
                    {profile.username?.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </button>

            {profile.discordConnected && showDiscordPresence && (
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black"
                style={{
                  backgroundColor: STATUS_COLORS[liveDiscordStatus] || STATUS_COLORS.offline,
                  boxShadow: `0 0 6px ${STATUS_COLORS[liveDiscordStatus] || STATUS_COLORS.offline}`,
                }}
              />
            )}
          </div>

          <div className="flex flex-col min-w-0 leading-none">
            <h1 className="text-sm md:text-base font-semibold tracking-tight flex items-center gap-1.5">
              <span className="truncate">{profile.displayName || profile.username}</span>
              {profile.badges?.includes('verified_gold') && <VerifiedBadge type="gold" />}
              {profile.badges?.includes('verified_white') && <VerifiedBadge type="white" />}
              {profile.badges?.includes('verified') && !profile.badges?.includes('verified_gold') && !profile.badges?.includes('verified_white') && <VerifiedBadge type="blue" />}
            </h1>
            <p className="text-[11px] mt-1 opacity-50" style={{ color: accent }}>
              @{profile.username}
            </p>
          </div>
        </motion.div>

        {/* Bio + badges + stats + actions */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className={`flex flex-col ${alignClass} mb-6`}
        >

          {typewriterTexts.length > 0 && (
            <p className="text-sm opacity-60 mb-3">
              <TypewriterText texts={typewriterTexts} speed={70} />
            </p>
          )}

          {profile.bio && (
            <p className={`${isWide ? 'max-w-2xl' : 'max-w-sm'} text-sm leading-relaxed opacity-70 mb-4 whitespace-pre-wrap break-words`}>
              {renderBio(profile.bio, accent)}
            </p>
          )}

          {/* Badges (exclude verified types — shown inline next to name) */}
          {profile.badges && profile.badges.filter(b => b !== 'verified' && b !== 'verified_gold' && b !== 'verified_white').length > 0 && (
            <div className={`flex flex-wrap gap-2 mb-5 ${isLeft ? '' : 'justify-center'}`}>
              {profile.badges.filter(b => b !== 'verified' && b !== 'verified_gold' && b !== 'verified_white').slice(0, 6).map((badgeId) => {
                const customBadge = parseCustomBadge(badgeId);
                if (customBadge) {
                  return (
                    <motion.div
                      key={badgeId}
                      whileHover={{ scale: 1.05 }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide"
                      style={{
                        backgroundColor: `${customBadge.color}14`,
                        color: customBadge.color,
                        border: `1px solid ${customBadge.color}30`,
                      }}
                      title={customBadge.label}
                    >
                      <span className="emoji text-base leading-none">{customBadge.emoji}</span>
                      <span>{customBadge.label}</span>
                    </motion.div>
                  );
                }
                const badge = BADGE_MAP[badgeId];
                if (!badge) return null;
                const Icon = badge.icon;
                return (
                  <motion.div
                    key={badgeId}
                    whileHover={{ scale: 1.05 }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide"
                    style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.color}25` }}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    {badge.label}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Stats */}
          <div className={`flex items-center gap-6 mb-5 ${isLeft ? '' : 'justify-center'}`}>
            <div className="flex flex-col items-center">
              <span className="text-base font-semibold tabular-nums">{(profile.followersCount || 0).toLocaleString()}</span>
              <span className="text-[9px] tracking-[0.18em] uppercase opacity-40 mt-0.5">Seguidores</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-base font-semibold tabular-nums">{(profile.likesCount || 0).toLocaleString()}</span>
              <span className="text-[9px] tracking-[0.18em] uppercase opacity-40 mt-0.5">Curtidas</span>
            </div>
            {showViews && (
              <>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-base font-semibold tabular-nums">{(profile.viewsCount || 0).toLocaleString()}</span>
                  <span className="text-[9px] tracking-[0.18em] uppercase opacity-40 mt-0.5">Visitas</span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          {!isOwner && onFollow && onLike && (
            <div className="flex gap-2 mb-6">
              <motion.button
                onClick={onFollow}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-1.5 text-[11px] font-medium tracking-[0.15em] uppercase rounded-full transition-all duration-200"
                style={{
                  border: `1px solid ${isFollowing ? accent + '50' : 'rgba(255,255,255,0.15)'}`,
                  color: isFollowing ? accent : 'rgba(255,255,255,0.85)',
                  background: 'transparent',
                }}
              >
                {isFollowing ? 'Seguindo' : 'Seguir'}
              </motion.button>

              <motion.button
                onClick={handleLike}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
                className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-200 ${likePulse ? 'scale-125' : ''}`}
                style={{
                  borderColor: hasLiked ? `${accent}60` : 'rgba(255,255,255,0.15)',
                  background: hasLiked ? `${accent}14` : 'transparent',
                }}
              >
                <Heart
                  className="w-3.5 h-3.5 transition-all"
                  style={{ color: hasLiked ? accent : 'rgba(255,255,255,0.5)', fill: hasLiked ? accent : 'none' }}
                />
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Widgets */}
        <div className="w-full flex flex-col gap-3 mb-3">

          {/* Discord — minimalist text-only style (image-2 inspired) */}
          {profile.discordConnected && liveDiscordUsername && showDiscordPresence && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`flex flex-col ${isLeft ? 'items-start' : 'items-center mx-auto'} gap-1`}
            >
              <div className="flex items-center gap-1.5 leading-none">
                {showDiscordAvatar && liveDiscordAvatarUrl ? (
                  <img
                    src={liveDiscordAvatarUrl}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover opacity-80"
                  />
                ) : (
                  <SiDiscord className="w-3.5 h-3.5 text-white/55" />
                )}
                <span className="font-semibold text-[13px] text-white/90">{liveDiscordUsername}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{
                    backgroundColor: STATUS_COLORS[liveDiscordStatus] || STATUS_COLORS.offline,
                    boxShadow: `0 0 6px ${STATUS_COLORS[liveDiscordStatus] || STATUS_COLORS.offline}`,
                  }}
                />
                {(profile as any).discordNitro && <Gem className="w-3 h-3 text-pink-400/80" />}
                {(profile as any).discordBoost && <Crown className="w-3 h-3 text-fuchsia-400/80" />}
              </div>
              <p className="text-[11px] italic text-white/45 leading-none">
                {liveDiscordActivity
                  ? liveDiscordActivity
                  : liveDiscordStatus === 'online' ? 'online now'
                  : liveDiscordStatus === 'idle' ? 'last seen recently'
                  : liveDiscordStatus === 'dnd' ? 'do not disturb'
                  : 'last seen unknown'}
              </p>
            </motion.div>
          )}

          {/* Now Playing */}
          {!musicPrivate && profile.nowPlaying?.isPlaying && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-lg p-4 flex items-center gap-3 relative overflow-hidden"
            >
              {profile.nowPlaying.albumArt && (
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: `url(${profile.nowPlaying.albumArt})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(20px)',
                  }}
                />
              )}
              <div className="relative z-10 flex-shrink-0">
                {profile.nowPlaying.albumArt && (
                  <div className="relative">
                    <img src={profile.nowPlaying.albumArt} alt="" className="w-12 h-12 rounded object-cover" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black flex items-center justify-center border border-white/10">
                      {profile.musicService === 'spotify' ? (
                        <SiSpotify className="w-3 h-3 text-[#1DB954]" />
                      ) : (
                        <SiLastdotfm className="w-3 h-3 text-[#D51007]" />
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative z-10 flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4].map(i => (
                      <span key={i} className="music-bar" style={{ color: '#1DB954', animationDelay: `${(i-1)*0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Tocando Agora</span>
                </div>
                <p className="font-bold text-sm truncate">{profile.nowPlaying.title}</p>
                <p className="text-xs opacity-50 truncate">{profile.nowPlaying.artist}</p>
                {profile.nowPlaying.progress != null && profile.nowPlaying.duration != null && (
                  <div className="mt-2 h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-green-400/80 rounded-full"
                      style={{ width: `${(profile.nowPlaying.progress / profile.nowPlaying.duration) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Music Player (for musicUrl) — only mounts after the user clicks "enter"
             so browsers allow autoplay with sound */}
          {musicUrl && !profile.nowPlaying?.isPlaying && entered && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <MusicPlayer musicUrl={musicUrl} musicTitle={musicTitle} musicIconUrl={musicIconUrl} />
            </motion.div>
          )}
        </div>

        {/* Links */}
        {profile.links && profile.links.length > 0 && (
          <div className={`w-full flex flex-wrap gap-3 mt-1 ${isLeft ? '' : 'justify-center'}`}>
            {[...profile.links].sort((a, b) => a.sortOrder - b.sortOrder).map((link, i) => {
              const Icon = PLATFORM_ICONS[link.platform.toLowerCase()] || LinkIcon;
              return (
                <motion.a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  whileHover={{ y: -2, scale: 1.1 }}
                  className="group w-9 h-9 flex items-center justify-center rounded-full relative overflow-hidden transition-all duration-300"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                  aria-label={link.label || link.platform}
                  title={link.label || link.platform}
                >
                  {link.iconUrl ? (
                    <img src={link.iconUrl} alt="" className="w-6 h-6 object-contain" />
                  ) : (
                    <Icon className="w-[18px] h-[18px]" />
                  )}
                </motion.a>
              );
            })}
          </div>
        )}

        {/* Publications (Instagram-style square grid, max 3) */}
        {publications.length > 0 && (
          <div className="w-full mt-8">
            <p className="label-caps mb-3 opacity-50 text-center md:text-left">Publicações</p>
            <div className={`grid grid-cols-3 gap-1 md:gap-1.5 ${publications.length < 3 ? 'max-w-md mx-auto md:mx-0' : ''}`}>
              {publications.map((pub, i) => {
                const cover = pub.media[0];
                if (!cover) return null;
                const coverIsVideo = cover.mediaType === 'video' || isVideoMedia(cover.mediaUrl);
                return (
                  <motion.button
                    key={pub.id}
                    type="button"
                    onClick={() => setPublicationOpen(pub)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * 0.04 }}
                    className="relative aspect-square overflow-hidden bg-white/5 group"
                    aria-label={pub.caption || `Publicação ${i + 1}`}
                  >
                    {coverIsVideo ? (
                      <video
                        src={cover.mediaUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MediaFill src={cover.mediaUrl} alt={pub.caption || ''} className="transition-transform duration-300 group-hover:scale-105" />
                    )}
                    {/* Carousel indicator if multiple medias */}
                    {pub.media.length > 1 && (
                      <div className="absolute top-1.5 right-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white font-medium">
                        {pub.media.length}
                      </div>
                    )}
                    {coverIsVideo && (
                      <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 p-1">
                        <Play className="w-3 h-3 text-white fill-white" />
                      </div>
                    )}
                    {pub.musicSpotifyUrl && (
                      <div className="absolute bottom-1.5 left-1.5 rounded-full bg-[#1DB954] p-1" title="Com música">
                        <Music className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Gallery (wide layout only — Instagram-style 3-col grid) */}
        {isWide && galleryItems.length > 0 && (
          <div className="w-full mt-10">
            <div className="grid grid-cols-3 gap-1 md:gap-1.5">
              {galleryItems.map((item, i) => (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => setGalleryLightbox(item)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.02 }}
                  className="relative aspect-square overflow-hidden bg-white/5 group"
                  aria-label={item.caption || `Item ${i + 1}`}
                >
                  <MediaFill src={item.mediaUrl} alt={item.caption || ''} className="transition-transform duration-300 group-hover:scale-105" />
                  {(item.mediaType === 'video' || isVideoMedia(item.mediaUrl)) && (
                    <div className="absolute top-1.5 right-1.5 rounded-full bg-black/55 p-1">
                      <Play className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Gallery lightbox */}
        {galleryLightbox && (
          <div
            className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setGalleryLightbox(null)}
          >
            <button
              type="button"
              onClick={() => setGalleryLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label="Fechar"
            >
              ×
            </button>
            <div className="max-w-3xl max-h-[85vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {(galleryLightbox.mediaType === 'video' || isVideoMedia(galleryLightbox.mediaUrl)) ? (
                <video src={galleryLightbox.mediaUrl} controls autoPlay className="max-h-[85vh] max-w-full object-contain" />
              ) : (
                <img src={galleryLightbox.mediaUrl} alt={galleryLightbox.caption || ''} className="max-h-[85vh] max-w-full object-contain" />
              )}
            </div>
            {galleryLightbox.caption && (
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-md px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm">
                {galleryLightbox.caption}
              </p>
            )}
          </div>
        )}

        {/* Stories Viewer */}
        <StoriesViewer
          open={storiesOpen}
          stories={stories}
          username={username || profile.username || ''}
          avatarUrl={profile.avatarUrl}
          onClose={() => setStoriesOpen(false)}
          onOpen={onStoryOpened}
          showViewsCounter={!!isOwner}
          onDelete={isOwner ? async (id) => {
            const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
            try {
              await fetch(`${apiBase()}/api/stories/${id}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              });
              const remaining = stories.filter(s => s.id !== id);
              setStories(remaining);
              if (remaining.length === 0) setStoriesOpen(false);
            } catch {}
          } : undefined}
        />

        {/* Publication carousel */}
        <PublicationCarousel
          open={!!publicationOpen}
          publication={publicationOpen}
          username={username || profile.username || ''}
          avatarUrl={profile.avatarUrl}
          onClose={() => setPublicationOpen(null)}
        />

        {/* Footer */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <a
            href="https://ikiss.me"
            target="_blank"
            rel="noopener noreferrer"
            className="label-caps hover:text-white/70 transition-colors"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            Faça o seu também
          </a>
          {!isOwner && (
            <button
              onClick={() => setReportOpen(true)}
              className="text-xs hover:text-red-400 transition-colors"
              style={{ color: 'rgba(255,255,255,0.18)' }}
            >
              Denunciar perfil
            </button>
          )}
        </div>

        {/* Report Modal */}
        {reportOpen && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setReportOpen(false); }}
          >
            <div className="w-full max-w-sm rounded-xl p-5" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}>
              {reportSent ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="text-3xl">✅</span>
                  <p className="font-semibold text-white">Denúncia enviada!</p>
                  <p className="text-sm text-white/50">Nossa equipe irá analisar em breve.</p>
                </div>
              ) : (
                <>
                  <h2 className="font-bold text-white text-lg mb-1">Denunciar perfil</h2>
                  <p className="text-xs text-white/40 mb-4">@{username || profile.username}</p>
                  <div className="flex flex-col gap-2 mb-4">
                    {['Spam', 'Conteúdo inapropriado', 'Assédio ou ameaças', 'Informações falsas', 'Outro'].map(r => (
                      <button
                        key={r}
                        onClick={() => setReportReason(r)}
                        className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                        style={{
                          background: reportReason === r ? `${accent}22` : 'rgba(255,255,255,0.05)',
                          color: reportReason === r ? accent : 'rgba(255,255,255,0.7)',
                          border: `1px solid ${reportReason === r ? accent + '50' : 'transparent'}`,
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Detalhes adicionais (opcional)"
                    value={reportDetails}
                    onChange={e => setReportDetails(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full text-sm rounded-lg px-3 py-2 mb-4 resize-none outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReportOpen(false)}
                      className="flex-1 py-2 rounded-lg text-sm text-white/50 hover:text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReport}
                      disabled={!reportReason || reportLoading}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
                      style={{ background: '#ef4444', color: 'white' }}
                    >
                      {reportLoading ? '...' : 'Enviar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
