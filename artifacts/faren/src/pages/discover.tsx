import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetTrendingProfiles } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Heart, X } from "lucide-react";
import { ProfileCardMedia } from "@/components/ProfileCardMedia";

export default function Discover() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: trendingProfiles, isLoading } = useGetTrendingProfiles({ limit: 24 }, { query: { staleTime: 120_000, gcTime: 300_000 } });
  const [, setLocation] = useLocation();

  const filteredProfiles = trendingProfiles?.filter(profile =>
    profile.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (profile.displayName && profile.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5">
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-white hover:opacity-70 transition-opacity">IKISS</span>
        </Link>
        <Link href="/login" className="nav-link">Entrar</Link>
      </nav>

      {/* Hero */}
      <div className="pt-32 pb-16 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="label-caps mb-4">Explorar</p>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
              <div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight uppercase leading-none">
                  Descobrir
                </h1>
                <h1
                  className="text-5xl md:text-7xl font-bold tracking-tight uppercase leading-none"
                  style={{ WebkitTextStroke: '1px rgba(255,255,255,0.25)', color: 'transparent' }}
                >
                  Perfis
                </h1>
              </div>

              {/* Search */}
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar perfis..."
                  className="w-full bg-white/[0.04] border border-white/10 pl-11 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="glow-line" />
          </motion.div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array(12).fill(0).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-sm bg-white/5" />
              ))}
            </div>
          ) : (
            <AnimatePresence>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredProfiles?.map((profile, i) => (
                  <motion.div
                    key={profile.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03, duration: 0.35 }}
                    onClick={() => setLocation(`/${profile.username}`)}
                    className="group aspect-[3/4] relative overflow-hidden rounded-sm cursor-pointer hover-lift"
                  >
                    {/* Background */}
                    <ProfileCardMedia
                      url={profile.backgroundUrl}
                      opacity={profile.backgroundOpacity}
                      fallbackGradient="linear-gradient(135deg, #111 0%, #1a1a2e 100%)"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                    {/* Hover shine */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-white/5 to-transparent" />

                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/20 mb-2 flex-shrink-0">
                        {profile.avatarUrl ? (
                          <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-white/10 flex items-center justify-center text-xs font-bold">
                            {profile.username.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        {profile.discordConnected && profile.discordStatus === 'online' && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-black rounded-full" />
                        )}
                      </div>

                      <p className="text-sm font-bold truncate leading-tight">
                        {profile.displayName || profile.username}
                      </p>
                      <p className="label-caps truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        @{profile.username}
                      </p>

                      <div className="flex items-center gap-3 mt-2 translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          <Users className="w-2.5 h-2.5" />{profile.followersCount}
                        </span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          <Heart className="w-2.5 h-2.5" />{profile.likesCount}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {filteredProfiles?.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-32 text-center"
                >
                  <p className="label-caps mb-4">Sem Resultados</p>
                  <p className="text-2xl font-bold uppercase">"{searchQuery}" Não Encontrado</p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
