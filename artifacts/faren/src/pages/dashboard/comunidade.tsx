import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Heart, MessageCircle, Send, X, Trash2, Flag,
  Image as ImageIcon, BadgeCheck, RefreshCw,
  Settings, LogOut, ExternalLink, Video, Smile
} from "lucide-react";
import { useGetMyProfile } from "@workspace/api-client-react";

const apiBase = () => (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

interface Post {
  id: number;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  userId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  badges: string[];
  hasLiked: boolean;
}

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  badges: string[];
}

function AvatarCircle({ url, name, size = 36, ring = false }: { url?: string | null; name?: string | null; size?: number; ring?: boolean }) {
  const initials = (name || '?').charAt(0).toUpperCase();
  return (
    <div className={`flex-shrink-0 rounded-full ${ring ? 'p-[2px] bg-gradient-to-br from-pink-500 via-red-400 to-yellow-400' : ''}`} style={{ width: size + (ring ? 4 : 0), height: size + (ring ? 4 : 0) }}>
      {url ? (
        <img src={url} alt={name || ''} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div className="rounded-full bg-white/10 flex items-center justify-center w-full h-full text-xs font-bold text-white/50">
          {initials}
        </div>
      )}
    </div>
  );
}

function BadgeRow({ badges }: { badges: string[] }) {
  if (!badges?.length) return null;
  const icons: Record<string, JSX.Element> = {
    verified: <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />,
    verified_gold: <BadgeCheck className="w-3.5 h-3.5 text-yellow-400" />,
    verified_white: <BadgeCheck className="w-3.5 h-3.5 text-white" />,
  };
  return (
    <span className="flex items-center gap-0.5">
      {badges.filter(b => icons[b]).map(b => <span key={b}>{icons[b]}</span>)}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function CommentSection({ postId, onClose, onCountChange }: {
  postId: number;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${apiBase()}/api/posts/${postId}/comments`)
      .then(r => r.json())
      .then(data => { setComments(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [postId]);

  const sendComment = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${apiBase()}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ content: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = [data, ...comments];
      setComments(updated);
      onCountChange?.(updated.length);
      setText('');
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="border-t border-white/8 pt-3 mt-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Comentários</p>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>

        {isAuthenticated && (
          <div className="flex gap-2 mb-4">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
              placeholder="Adicionar comentário..."
              className="flex-1 bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 rounded-sm"
              maxLength={500}
            />
            <button
              onClick={sendComment}
              disabled={!text.trim() || sending}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all rounded-sm"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-white/20 text-center py-3">Carregando...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-white/20 text-center py-3">Nenhum comentário. Seja o primeiro!</p>
        ) : (
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2">
                <Link href={`/${c.username}`}>
                  <AvatarCircle url={c.avatarUrl} name={c.displayName || c.username} size={24} />
                </Link>
                <div className="flex-1 min-w-0 bg-white/[0.03] rounded-sm px-2.5 py-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Link href={`/${c.username}`}>
                      <span className="text-[11px] font-semibold text-white hover:underline">{c.displayName || c.username}</span>
                    </Link>
                    <BadgeRow badges={c.badges} />
                    <span className="text-[9px] text-white/20 ml-auto">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-xs text-white/70 break-words">{c.content}</p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PostCard({
  post,
  onDelete,
  currentUserId,
}: {
  post: Post;
  onDelete: (id: number) => void;
  currentUserId?: number;
}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState(post.hasLiked);
  const [likes, setLikes] = useState(post.likesCount);
  const [commentCount, setCommentCount] = useState(post.commentsCount);
  const [showComments, setShowComments] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const isOwner = currentUserId === post.userId;

  const handleLike = async () => {
    if (!isAuthenticated || likeLoading) return;
    setLikeLoading(true);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    try {
      const res = await fetch(`${apiBase()}/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: authHeader(),
      });
      const data = await res.json();
      if (res.ok) {
        setLiked(data.liked);
        setLikes(prev => data.liked ? prev + 1 : Math.max(0, prev - 1));
      }
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Apagar esta publicação?')) return;
    const res = await fetch(`${apiBase()}/api/posts/${post.id}`, { method: 'DELETE', headers: authHeader() });
    if (res.ok) onDelete(post.id);
  };

  const handleReport = async () => {
    if (!reportReason) return;
    await fetch(`${apiBase()}/api/posts/${post.id}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reportReason }),
    });
    setReportSent(true);
    toast({ title: 'Denúncia enviada', description: 'Obrigado pelo feedback.' });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.025] border border-white/8 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <Link href={`/${post.username}`} className="flex items-center gap-2.5">
          <AvatarCircle url={post.avatarUrl} name={post.displayName || post.username} size={36} ring />
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-white leading-none">{post.displayName || post.username}</span>
              <BadgeRow badges={post.badges} />
            </div>
            <span className="text-[10px] text-white/30">@{post.username} · {timeAgo(post.createdAt)}</span>
          </div>
        </Link>
        <div className="flex items-center gap-0.5">
          {!isOwner && (
            <button onClick={() => setReportOpen(r => !r)} className="p-2 text-white/20 hover:text-orange-400 transition-colors">
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
          {isOwner && (
            <button onClick={handleDelete} className="p-2 text-white/20 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Media — full width VSCO-style */}
      {post.mediaUrl && (
        <div className="w-full bg-black/30" style={{ maxHeight: '70vw' }}>
          {post.mediaType === 'video' ? (
            <video
              src={post.mediaUrl}
              controls
              playsInline
              className="w-full object-contain"
              style={{ maxHeight: '70vw' }}
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt=""
              className="w-full object-cover"
              style={{ maxHeight: '70vw' }}
            />
          )}
        </div>
      )}

      {/* Caption */}
      {post.content && (
        <p className="px-4 pt-3 text-sm text-white/80 leading-relaxed break-words whitespace-pre-wrap">
          {post.content}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-3">
        <button
          onClick={handleLike}
          disabled={!isAuthenticated || likeLoading}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-all ${
            liked ? 'text-red-400' : 'text-white/40 hover:text-red-400'
          } disabled:opacity-40`}
        >
          <motion.span animate={likeAnim ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }}>
            <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
          </motion.span>
          <span className="text-xs font-semibold">{likes}</span>
        </button>
        <button
          onClick={() => setShowComments(s => !s)}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-all ${
            showComments ? 'text-white/80' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-xs font-semibold">{commentCount}</span>
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <div className="px-4 pb-4">
            <CommentSection
              postId={post.id}
              onClose={() => setShowComments(false)}
              onCountChange={n => setCommentCount(n)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Report panel */}
      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/8"
          >
            <div className="px-4 py-3">
              {reportSent ? (
                <p className="text-xs text-green-400">Denúncia enviada!</p>
              ) : (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">Motivo da denúncia</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {['Spam', 'Inapropriado', 'Assédio', 'Ódio', 'Outro'].map(r => (
                      <button
                        key={r}
                        onClick={() => setReportReason(r)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          reportReason === r
                            ? 'border-orange-400/60 bg-orange-400/10 text-orange-300'
                            : 'border-white/10 text-white/30 hover:border-white/25'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleReport}
                      disabled={!reportReason}
                      className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs rounded-sm disabled:opacity-30 transition-all"
                    >
                      Denunciar
                    </button>
                    <button onClick={() => setReportOpen(false)} className="px-3 py-1.5 text-white/30 hover:text-white text-xs transition-colors">
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* Quick-emoji bar for the composer */
const QUICK_EMOJIS = ['❤️', '🔥', '✨', '💜', '😊', '🎉', '👀', '😭', '💅', '🫶'];

export default function Comunidade() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated } });

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [newPost, setNewPost] = useState('');
  const [newMedia, setNewMedia] = useState('');
  const [newMediaType, setNewMediaType] = useState('');
  const [posting, setPosting] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Live polling — checks for posts newer than the top post */
  const [newPostsAvailable, setNewPostsAvailable] = useState(0);
  const topPostIdRef = useRef<number | null>(null);

  const profileUsername = (profile as any)?.username || user?.username || '';
  const currentUserId = (profile as any)?.userId;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
  }, [authLoading, isAuthenticated]);

  const fetchPosts = useCallback(async (reset = false) => {
    const start = reset ? 0 : offset;
    if (!reset && loadingMore) return;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const res = await fetch(`${apiBase()}/api/posts?limit=20&offset=${start}`, {
        headers: isAuthenticated ? authHeader() : {},
      });
      const data: Post[] = await res.json();
      if (reset) {
        setPosts(data);
        setOffset(20);
        topPostIdRef.current = data[0]?.id ?? null;
      } else {
        setPosts(prev => [...prev, ...data]);
        setOffset(start + 20);
      }
      setHasMore(data.length === 20);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isAuthenticated, offset, loadingMore]);

  useEffect(() => {
    if (isAuthenticated) fetchPosts(true);
  }, [isAuthenticated]);

  /* Poll every 8 seconds for new posts */
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase()}/api/posts?limit=5&offset=0`, {
          headers: authHeader(),
        });
        const data: Post[] = await res.json();
        const latestId = data[0]?.id;
        if (latestId && topPostIdRef.current && latestId > topPostIdRef.current) {
          const count = data.filter(p => p.id > (topPostIdRef.current ?? 0)).length;
          setNewPostsAvailable(count);
        }
      } catch { /* ignore */ }
    }, 8000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const loadNewPosts = async () => {
    setNewPostsAvailable(0);
    await fetchPosts(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setNewMedia(reader.result as string);
      setNewMediaType(file.type.startsWith('video') ? 'video' : 'image');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePost = async () => {
    if ((!newPost.trim() && !newMedia) || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`${apiBase()}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          content: newPost.trim() || null,
          mediaUrl: newMedia || null,
          mediaType: newMediaType || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPosts(prev => [data, ...prev]);
      topPostIdRef.current = data.id;
      setNewPost('');
      setNewMedia('');
      setNewMediaType('');
      setShowEmojiBar(false);
      toast({ title: 'Publicado!', duration: 2000 });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = (id: number) => setPosts(prev => prev.filter(p => p.id !== id));

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) { setNewPost(p => p + emoji); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = newPost.slice(0, start) + emoji + newPost.slice(end);
    setNewPost(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
    });
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-white hover:opacity-70 transition-opacity">IKISS</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-end">
          <Link href="/dashboard" className="nav-link hidden sm:inline">Dashboard</Link>
          <Link href="/dashboard/comunidade" className="nav-link text-white text-xs sm:text-sm">Comunidade</Link>
          <Link href={profileUsername ? `/${profileUsername}` : '/dashboard'} className="nav-link flex items-center gap-1 hidden sm:flex">
            <ExternalLink className="w-3 h-3" /> Perfil
          </Link>
          <Link href="/dashboard/edit" className="nav-link flex items-center gap-1">
            <Settings className="w-3 h-3" /><span className="hidden sm:inline">Editar</span>
          </Link>
          <button onClick={() => logout()} className="nav-link flex items-center gap-1 text-red-400/60 hover:text-red-400">
            <LogOut className="w-3 h-3" /><span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </nav>

      {/* "New posts" live banner */}
      <AnimatePresence>
        {newPostsAvailable > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-40"
          >
            <button
              onClick={loadNewPosts}
              className="flex items-center gap-2 bg-white text-black text-xs font-bold px-4 py-2 rounded-full shadow-xl hover:bg-white/90 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {newPostsAvailable} {newPostsAvailable === 1 ? 'nova publicação' : 'novas publicações'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-20 pb-24 px-4 max-w-xl mx-auto">
        {/* Composer */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-5"
          >
            <div className="flex gap-3">
              <Link href={profileUsername ? `/${profileUsername}` : '#'}>
                <AvatarCircle url={(profile as any)?.avatarUrl} name={(profile as any)?.displayName || user?.username} size={40} ring />
              </Link>
              <div className="flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  placeholder="Compartilhe algo com a comunidade..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none resize-none leading-relaxed"
                  rows={3}
                  maxLength={2000}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePost();
                  }}
                />

                {/* Media preview — VSCO style */}
                <AnimatePresence>
                  {newMedia && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative mt-2 rounded-lg overflow-hidden bg-black/40"
                      style={{ maxHeight: 280 }}
                    >
                      {newMediaType === 'video' ? (
                        <video src={newMedia} controls playsInline className="w-full object-contain" style={{ maxHeight: 280 }} />
                      ) : (
                        <img src={newMedia} alt="" className="w-full object-cover" style={{ maxHeight: 280 }} />
                      )}
                      <button
                        onClick={() => { setNewMedia(''); setNewMediaType(''); }}
                        className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5 hover:bg-black/90 transition-colors"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Emoji quick-bar */}
                <AnimatePresence>
                  {showEmojiBar && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex gap-1.5 flex-wrap mt-2 mb-1"
                    >
                      {QUICK_EMOJIS.map(e => (
                        <button
                          key={e}
                          onClick={() => insertEmoji(e)}
                          className="text-lg leading-none hover:scale-125 transition-transform"
                          style={{ fontFamily: "'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif" }}
                        >
                          {e}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-0.5">
                    <input ref={fileInputRef} type="file" accept="image/*,video/*,image/gif" onChange={handleFileChange} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-white/30 hover:text-white/70 transition-colors rounded-lg"
                      title="Foto / Vídeo / GIF"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowEmojiBar(s => !s)}
                      className={`p-2 transition-colors rounded-lg ${showEmojiBar ? 'text-yellow-400' : 'text-white/30 hover:text-white/70'}`}
                      title="Emojis"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/20">{newPost.length}/2000</span>
                    <button
                      onClick={handlePost}
                      disabled={(!newPost.trim() && !newMedia) || posting}
                      className="px-4 py-1.5 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 disabled:opacity-30 transition-all rounded-lg"
                    >
                      {posting ? '...' : 'Publicar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/[0.025] border border-white/8 rounded-xl p-4 animate-pulse">
                <div className="flex gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-white/5 rounded w-28" />
                    <div className="h-2.5 bg-white/5 rounded w-16" />
                  </div>
                </div>
                <div className="h-32 bg-white/5 rounded-lg mb-3" />
                <div className="h-2.5 bg-white/5 rounded w-full mb-1.5" />
                <div className="h-2.5 bg-white/5 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24 border border-white/5 rounded-xl">
            <p className="text-3xl mb-3" style={{ fontFamily: "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif" }}>🌟</p>
            <p className="text-white/30 text-sm">Nenhuma publicação ainda.</p>
            <p className="text-white/15 text-xs mt-1">Seja o primeiro a compartilhar!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <PostCard key={post.id} post={post} onDelete={handleDelete} currentUserId={currentUserId} />
            ))}
            {hasMore && (
              <button
                onClick={() => fetchPosts(false)}
                disabled={loadingMore}
                className="w-full py-3 text-xs text-white/30 hover:text-white/60 transition-colors border border-white/5 hover:border-white/15 rounded-xl"
              >
                {loadingMore ? 'Carregando...' : 'Ver mais'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
