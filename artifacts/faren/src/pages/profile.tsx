import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetUserByUsername, getGetUserByUsernameQueryKey, useRecordProfileView } from "@workspace/api-client-react";
import ProfileView from "@/components/ProfileView";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

const apiBase = () => (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const recordView = useRecordProfileView();
  const { isAuthenticated } = useAuth();

  const [isFollowing, setIsFollowing] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  const { data: profile, isLoading, error, refetch } = useGetUserByUsername(username || "", {
    query: {
      queryKey: getGetUserByUsernameQueryKey(username || ""),
      enabled: !!username,
      retry: (failureCount: number, err: unknown) => {
        // Don't retry rename signals — handle them in the effect below.
        if ((err as any)?.data?.error === "username_renamed") return false;
        return failureCount < 1;
      },
      // Show cached profile instantly, refetch in background
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnMount: "always",
    }
  });

  // If the backend reports the username was renamed, follow the redirect.
  useEffect(() => {
    const e = error as any;
    if (!e || e?.data?.error !== "username_renamed") return;
    const target = e?.data?.redirectTo;
    if (typeof target === "string" && target && target !== username) {
      setLocation(`/${target}`, { replace: true });
    }
  }, [error, username, setLocation]);

  useEffect(() => {
    if (!username) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const scr = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    const ua = navigator.userAgent;
    const langs = navigator.languages?.join(',') || navigator.language;
    const cores = (navigator as any).hardwareConcurrency || 0;
    const mem = (navigator as any).deviceMemory || 0;
    const fingerprint = `${ua}|${scr}|${tz}|${langs}|${cores}|${mem}`;
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    recordView.mutate({
      data: {
        username,
        device: `${isMobile ? 'mobile' : 'desktop'}::${fingerprint}`,
        country: tz,
      }
    });
  }, [username]);

  useEffect(() => {
    if (profile) {
      setIsFollowing(!!(profile as any).isFollowing);
      setHasLiked(!!(profile as any).hasLiked);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const displayName = (profile as any).displayName || profile.username || username;
    const bio = (profile as any).bio || `Veja o perfil de @${profile.username} na Ikiss`;
    const avatarUrl = (profile as any).avatarUrl || "";
    const backgroundUrl = (profile as any).backgroundUrl || "";
    const ogImage = (backgroundUrl && !backgroundUrl.startsWith("data:")) ? backgroundUrl
      : (avatarUrl && !avatarUrl.startsWith("data:")) ? avatarUrl
      : "https://ikiss.me/og-image.png";
    const profileUrl = `https://ikiss.me/${profile.username}`;

    document.title = `${displayName} (@${profile.username}) — Ikiss`;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      (el as any)[attr] = value;
    };

    setMeta('meta[property="og:title"]', "content", `${displayName} (@${profile.username}) — Ikiss`);
    setMeta('meta[property="og:description"]', "content", bio.slice(0, 200));
    setMeta('meta[property="og:image"]', "content", ogImage);
    setMeta('meta[property="og:url"]', "content", profileUrl);
    setMeta('meta[property="og:type"]', "content", "profile");
    setMeta('meta[name="twitter:title"]', "content", `${displayName} (@${profile.username}) — Ikiss`);
    setMeta('meta[name="twitter:description"]', "content", bio.slice(0, 200));
    setMeta('meta[name="twitter:image"]', "content", ogImage);
    setMeta('meta[name="description"]', "content", bio.slice(0, 200));

    return () => {
      document.title = "Ikiss — Seu perfil, do seu jeito";
    };
  }, [profile, username]);

  const handleFollow = async () => {
    if (!isAuthenticated || followLoading || !username) return;
    setFollowLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`${apiBase()}/api/users/${username}/follow`, {
        method,
        headers: authHeader(),
      });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        refetch();
      }
    } catch { } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated || likeLoading || !username) return;
    setLikeLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/users/${username}/like`, {
        method: "POST",
        headers: authHeader(),
      });
      if (res.ok) {
        setHasLiked(true);
        refetch();
      }
    } catch { } finally {
      setLikeLoading(false);
    }
  };

  const [loadingSlow, setLoadingSlow] = useState(false);
  useEffect(() => {
    if (!isLoading) { setLoadingSlow(false); return; }
    const t = setTimeout(() => setLoadingSlow(true), 4000);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="w-32 h-32 rounded-full" />
          <Skeleton className="w-48 h-8" />
          <Skeleton className="w-32 h-4" />
          {loadingSlow && (
            <p className="text-white/30 text-xs mt-2 animate-pulse">Acordando o servidor...</p>
          )}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-4xl font-bold mb-4">Perfil não encontrado</h1>
        <p className="text-white/50 mb-8">O usuário @{username} não existe ou foi removido.</p>
        <button
          onClick={() => setLocation("/")}
          className="px-6 py-3 bg-white text-black rounded font-medium hover:bg-white/90 transition-colors"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <ProfileView
      profile={profile}
      isOwner={false}
      onFollow={handleFollow}
      onLike={handleLike}
      isFollowing={isFollowing}
      hasLiked={hasLiked}
      username={username}
    />
  );
}
