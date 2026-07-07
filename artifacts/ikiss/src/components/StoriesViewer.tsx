import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Eye } from "lucide-react";

export interface StoryItem {
  id: number;
  mediaUrl: string;
  mediaType: string;
  caption?: string | null;
  musicSpotifyUrl?: string | null;
  viewsCount?: number;
  expiresAt?: string;
  createdAt?: string;
}

interface StoriesViewerProps {
  open: boolean;
  stories: StoryItem[];
  username: string;
  avatarUrl?: string | null;
  onClose: () => void;
  /** Optional: called when a story is fully viewed (for "seen" tracking, future). */
  onViewed?: (storyId: number) => void;
  /** Optional: only present for owner — lets them delete their own story. */
  onDelete?: (storyId: number) => void;
  /** Optional: called when a story opens (each open = +1 view). */
  onOpen?: (storyId: number) => void;
  /** Show view counter (owner only). */
  showViewsCounter?: boolean;
}

function spotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)spotify\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    // expect [type, id]
    if (parts.length < 2) return null;
    const [type, id] = parts;
    if (!["track", "album", "playlist", "episode"].includes(type)) return null;
    return `https://open.spotify.com/embed/${type}/${id}`;
  } catch {
    return null;
  }
}

const IMAGE_DURATION_MS = 4500;
const PROGRESS_TICK_MS = 50;

function isVideoMedia(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export function StoriesViewer({
  open,
  stories,
  username,
  avatarUrl,
  onClose,
  onViewed,
  onDelete,
  onOpen,
  showViewsCounter,
}: StoriesViewerProps) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 for current story
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tickRef = useRef<number | null>(null);
  const openedRef = useRef<Set<number>>(new Set());

  // reset when opening
  useEffect(() => {
    if (open) {
      setIndex(0);
      setProgress(0);
      setPaused(false);
      openedRef.current = new Set();
    }
  }, [open]);

  const current = stories[index];
  const isVideo = current ? current.mediaType === "video" || isVideoMedia(current.mediaUrl) : false;
  const spotifyUrl = current?.musicSpotifyUrl ? spotifyEmbedUrl(current.musicSpotifyUrl) : null;

  // Fire onOpen each time a story becomes visible (every open = +1 view).
  useEffect(() => {
    if (!open || !current || !onOpen) return;
    if (openedRef.current.has(current.id)) return;
    openedRef.current.add(current.id);
    onOpen(current.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current?.id]);

  // progress ticker for image stories
  useEffect(() => {
    if (!open || !current || isVideo || paused) return;
    const start = performance.now() - progress * IMAGE_DURATION_MS;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / IMAGE_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        onViewed?.(current.id);
        if (index < stories.length - 1) {
          setIndex(index + 1);
          setProgress(0);
        } else {
          onClose();
        }
      }
    };
    tickRef.current = window.setInterval(tick, PROGRESS_TICK_MS);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, isVideo, paused, current?.id, stories.length]);

  // video time-driven progress
  useEffect(() => {
    if (!open || !current || !isVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.duration && v.duration > 0) setProgress(v.currentTime / v.duration);
    };
    const onEnded = () => {
      onViewed?.(current.id);
      if (index < stories.length - 1) {
        setIndex(index + 1);
        setProgress(0);
      } else {
        onClose();
      }
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, isVideo, current?.id, stories.length]);

  // pause/resume video on `paused` toggle
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, index]);

  // keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, stories.length]);

  function goNext() {
    if (index < stories.length - 1) {
      setIndex(index + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }
  function goPrev() {
    if (index > 0) {
      setIndex(index - 1);
      setProgress(0);
    }
  }

  if (!open || !current) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex items-center justify-center"
        onClick={onClose}
      >
        <div
          className="relative w-full h-full max-w-md md:max-w-lg mx-auto flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 px-3 pt-3 flex gap-1 z-10">
            {stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-[width]"
                  style={{
                    width:
                      i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                    transitionDuration: i === index ? `${PROGRESS_TICK_MS}ms` : "0ms",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-0 right-0 px-4 pt-3 flex items-center gap-3 z-10">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/30 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/10 text-white text-xs font-bold">
                  {username.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">@{username}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">
                {timeAgo(current.createdAt)}
              </p>
            </div>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(current.id)}
                className="text-[10px] uppercase tracking-wider text-white/60 hover:text-white border border-white/15 rounded-full px-2.5 py-1"
                title="Apagar story"
              >
                Apagar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Media */}
          <div
            className="flex-1 flex items-center justify-center relative"
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          >
            {isVideo ? (
              <video
                key={current.id}
                ref={videoRef}
                src={current.mediaUrl}
                autoPlay
                playsInline
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <img
                key={current.id}
                src={current.mediaUrl}
                alt=""
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            )}

            {current.caption && (
              <div className={`absolute ${spotifyUrl ? "bottom-32" : "bottom-20"} left-0 right-0 px-6 text-center pointer-events-none`}>
                <p className="inline-block max-w-full px-3 py-1.5 rounded-lg bg-black/55 backdrop-blur text-sm text-white">
                  {current.caption}
                </p>
              </div>
            )}

            {/* Spotify embed (Instagram-style chip at bottom) */}
            {spotifyUrl && (
              <div className="absolute bottom-4 left-3 right-3 z-20 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <div className="rounded-xl overflow-hidden shadow-2xl bg-black/60 backdrop-blur-md border border-white/10">
                  <iframe
                    title="Spotify"
                    src={spotifyUrl}
                    width="100%"
                    height="80"
                    frameBorder={0}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    loading="lazy"
                    style={{ display: "block" }}
                  />
                </div>
              </div>
            )}

            {/* Views counter (owner only) */}
            {showViewsCounter && typeof current.viewsCount === "number" && (
              <div className={`absolute ${spotifyUrl ? "bottom-28" : "bottom-4"} left-1/2 -translate-x-1/2 z-20 pointer-events-none`}>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white text-xs">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="font-medium">{current.viewsCount.toLocaleString("pt-BR")}</span>
                </div>
              </div>
            )}

            {/* Tap zones */}
            <button
              type="button"
              onClick={goPrev}
              className="absolute inset-y-0 left-0 w-1/3 flex items-center justify-start pl-2 text-white/0 hover:text-white/40"
              aria-label="Story anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute inset-y-0 right-0 w-1/3 flex items-center justify-end pr-2 text-white/0 hover:text-white/40"
              aria-label="Próximo story"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
