import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const VIDEO_SRC = "/pinterest_1117033513847707049.mp4";
const MUSIC_SRC = "/no-one-noticed.mp3";

const PROFILE_ROUTE_RE = /^\/(?!(login|register|dashboard|discover|devkeefnow|keefaren|suporte|emailsnoah|verify-email|forgot-password|reset-password|$)[\/?#]?)/;

export function SiteBackground() {
  const [location] = useLocation();
  const isProfilePage = PROFILE_ROUTE_RE.test(location);

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showB, setShowB] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [musicUnlocked, setMusicUnlocked] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const unlockedRef = useRef(false);

  // Seamless loop: two stacked videos cross-fade near the end
  useEffect(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    const FADE = 0.45;
    let active: "A" | "B" = "A";
    let rafId = 0;

    const startBoth = () => {
      try { a.currentTime = 0; a.play().catch(() => {}); } catch {}
      try { b.currentTime = 0; b.pause(); } catch {}
      setVideoReady(true);
    };

    const tick = () => {
      const cur = active === "A" ? a : b;
      const other = active === "A" ? b : a;
      if (cur.duration && cur.currentTime >= cur.duration - FADE && other.paused) {
        other.currentTime = 0;
        other.play().catch(() => {});
      }
      if (cur.duration && cur.currentTime >= cur.duration - 0.05) {
        active = active === "A" ? "B" : "A";
        setShowB(active === "B");
        cur.pause();
        cur.currentTime = 0;
      }
      rafId = requestAnimationFrame(tick);
    };

    if (a.readyState >= 1) startBoth();
    else a.addEventListener("loadedmetadata", startBoth, { once: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      a.removeEventListener("loadedmetadata", startBoth);
    };
  }, []);

  // Start audio muted immediately (browsers allow muted autoplay)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    audio.volume = 0.35;
    audio.play().catch(() => {});
  }, []);

  // Unlock music (unmute) on first user gesture anywhere on the page
  useEffect(() => {
    if (unlockedRef.current) return;

    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      setMusicUnlocked(true);
      const audio = audioRef.current;
      if (audio) {
        audio.muted = false;
        audio.volume = 0.35;
        audio.play().catch(() => {});
      }
    };

    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Pause music on profile pages (they have their own music), resume on other pages
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isProfilePage) {
      audio.pause();
    } else if (!musicMuted) {
      audio.play().catch(() => {});
    }
  }, [isProfilePage, musicMuted]);

  const toggleMusicMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!musicUnlocked) {
      // First click: unlock AND unmute
      unlockedRef.current = true;
      setMusicUnlocked(true);
      if (audio) {
        audio.muted = false;
        audio.volume = 0.35;
        audio.play().catch(() => {});
      }
      return;
    }
    if (musicMuted) {
      setMusicMuted(false);
      if (audio) { audio.muted = false; audio.play().catch(() => {}); }
    } else {
      setMusicMuted(true);
      if (audio) audio.pause();
    }
  };

  if (isProfilePage) return null;

  return (
    <>
      {/* Fullscreen video background — black until video is ready to prevent white flash */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-black">
        <video
          ref={videoARef}
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[450ms]"
          style={{ opacity: videoReady ? (showB ? 0 : 1) : 0 }}
        />
        <video
          ref={videoBRef}
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[450ms]"
          style={{ opacity: videoReady ? (showB ? 1 : 0) : 0 }}
        />
        {/* Dark overlay so content stays readable */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Background music (hidden audio) */}
      <audio
        ref={audioRef}
        src={MUSIC_SRC}
        loop
        muted
        preload="auto"
      />

      {/* Music control button */}
      <button
        onClick={toggleMusicMute}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/25 backdrop-blur-sm text-white/70 hover:text-white text-[11px] tracking-[0.15em] uppercase px-3 py-2 rounded-full transition-all duration-200"
        title={musicMuted ? "Ativar música" : "Silenciar música"}
      >
        {!musicUnlocked ? (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-white/60 animate-pulse" />
            Ativar som
          </>
        ) : musicMuted ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            Mudo
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            Música
          </>
        )}
      </button>
    </>
  );
}
