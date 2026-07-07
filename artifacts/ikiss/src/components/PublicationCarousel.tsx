import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface PublicationMediaItem {
  id: number;
  mediaUrl: string;
  mediaType: string;
  sortOrder: number;
}

export interface PublicationItem {
  id: number;
  caption?: string | null;
  musicSpotifyUrl?: string | null;
  createdAt?: string;
  media: PublicationMediaItem[];
}

interface PublicationCarouselProps {
  open: boolean;
  publication: PublicationItem | null;
  username: string;
  avatarUrl?: string | null;
  onClose: () => void;
}

function spotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)spotify\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [type, id] = parts;
    if (!["track", "album", "playlist", "episode"].includes(type)) return null;
    return `https://open.spotify.com/embed/${type}/${id}`;
  } catch {
    return null;
  }
}

function isVideoMedia(url: string, type?: string): boolean {
  if (type === "video") return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export function PublicationCarousel({
  open,
  publication,
  username,
  avatarUrl,
  onClose,
}: PublicationCarouselProps) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, publication?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, (publication?.media.length ?? 1) - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, publication?.media.length, onClose]);

  if (!open || !publication) return null;

  const current = publication.media[index];
  const total = publication.media.length;
  const spotifyUrl = publication.musicSpotifyUrl ? spotifyEmbedUrl(publication.musicSpotifyUrl) : null;
  const isVideo = current ? isVideoMedia(current.mediaUrl, current.mediaType) : false;

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
          {/* dot indicators */}
          {total > 1 && (
            <div className="absolute top-3 left-0 right-0 px-3 flex gap-1 justify-center z-10">
              {publication.media.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Header */}
          <div className="absolute top-7 left-0 right-0 px-4 pt-3 flex items-center gap-3 z-10">
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
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Publicação</p>
            </div>
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
          <div className="flex-1 flex items-center justify-center relative">
            {current && (
              isVideo ? (
                <video
                  key={current.id}
                  ref={videoRef}
                  src={current.mediaUrl}
                  controls
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
              )
            )}

            {publication.caption && (
              <div className={`absolute ${spotifyUrl ? "bottom-32" : "bottom-6"} left-0 right-0 px-6 text-center pointer-events-none`}>
                <p className="inline-block max-w-full px-3 py-1.5 rounded-lg bg-black/55 backdrop-blur text-sm text-white">
                  {publication.caption}
                </p>
              </div>
            )}

            {spotifyUrl && (
              <div className="absolute bottom-4 left-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
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

            {/* Nav arrows */}
            {total > 1 && index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur flex items-center justify-center text-white"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {total > 1 && index < total - 1 && (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur flex items-center justify-center text-white"
                aria-label="Próximo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
