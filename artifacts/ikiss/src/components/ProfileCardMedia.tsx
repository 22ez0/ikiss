interface ProfileCardMediaProps {
  url?: string | null;
  opacity?: number | null;
  fallbackGradient?: string;
  className?: string;
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i;

function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith("data:video/")) return true;
  return VIDEO_EXTENSIONS.test(url);
}

export function ProfileCardMedia({
  url,
  opacity,
  fallbackGradient = "linear-gradient(135deg, #1a1a2e, #16213e)",
  className = "",
}: ProfileCardMediaProps) {
  const computedOpacity = url ? (opacity ?? 60) / 100 : 1;

  if (url && isVideoUrl(url)) {
    return (
      <video
        src={url}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${className}`}
        style={{ opacity: computedOpacity }}
      />
    );
  }

  return (
    <div
      className={`absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 ${className}`}
      style={{
        backgroundImage: url ? `url(${url})` : fallbackGradient,
        opacity: computedOpacity,
      }}
    />
  );
}
