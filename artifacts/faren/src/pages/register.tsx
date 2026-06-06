import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, RotateCw } from "lucide-react";

const RESERVED = new Set(['keefaren','admin','administrator','api','dashboard','login','register','profile','settings','support','root','ikiss','keef','null','comunidade','community','explore','feed']);

const registerSchema = z.object({
  email: z.string().email("E-mail inválido"),
  username: z.string()
    .min(3, "Mínimo 3 caracteres")
    .max(15, "Máximo 15 caracteres")
    .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _")
    .refine(v => !v.startsWith('_') && !v.endsWith('_'), "Não pode começar ou terminar com _")
    .refine(v => !/__/.test(v), "Não pode ter __ consecutivos")
    .refine(v => !RESERVED.has(v), "Este nome de usuário não está disponível"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  displayName: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || "1x00000000000000000000AA";
const API_BASE = `${(import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/+$/, "")}/api`;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "error-callback"?: () => void; theme?: "dark" | "light" | "auto" }) => string;
      reset: (id?: string) => void;
      remove?: (id: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetState, setWidgetState] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", username: "", password: "", displayName: "" },
    mode: "onChange",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get('username');
    if (u) {
      const clean = u.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15);
      if (clean) form.setValue('username', clean, { shouldValidate: true });
    }
  }, [form]);

  // Inject the Turnstile script exactly once. We do NOT use the ?onload= param
  // because that callback closes over a stale render function across mounts.
  useEffect(() => {
    if (document.querySelector('script[data-turnstile]')) return;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-turnstile", "1");
    document.head.appendChild(s);
  }, []);

  // Render (and re-render) the widget whenever we enter step 2 or the user
  // clicks "tentar de novo". Polls for window.turnstile so a slow CF script
  // load can never leave us stuck.
  useEffect(() => {
    if (step !== 2) {
      setTurnstileToken(null);
      if (widgetIdRef.current && window.turnstile?.remove) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
      }
      widgetIdRef.current = null;
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30; // 15s @ 500ms
    setWidgetState("loading");
    setTurnstileToken(null);
    if (turnstileRef.current) turnstileRef.current.innerHTML = "";
    widgetIdRef.current = null;

    const tick = () => {
      if (cancelled) return;
      if (widgetIdRef.current) return;
      const host = turnstileRef.current;
      if (window.turnstile && host) {
        try {
          widgetIdRef.current = window.turnstile.render(host, {
            sitekey: TURNSTILE_SITE_KEY,
            theme: "dark",
            callback: (t) => { setTurnstileToken(t); setWidgetState("ready"); },
            "error-callback": () => { setTurnstileToken(null); setWidgetState("error"); },
          });
          setWidgetState("ready");
          return;
        } catch {
          /* fall through to retry */
        }
      }
      if (++attempts >= maxAttempts) {
        setWidgetState("error");
        return;
      }
      setTimeout(tick, 500);
    };
    tick();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
      }
      widgetIdRef.current = null;
    };
  }, [step, reloadKey]);

  const reloadWidget = useCallback(() => setReloadKey(k => k + 1), []);

  const nextStep = async () => {
    const valid = await form.trigger(["email", "password"] as const);
    if (valid) setStep(2);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    if (widgetState === "loading" && !turnstileToken) {
      toast({
        title: "Aguarde um instante",
        description: "A verificação ainda está carregando. Tente novamente em alguns segundos.",
        variant: "destructive",
      });
      return;
    }
    if (widgetState === "ready" && !turnstileToken) {
      toast({
        title: "Confirme a verificação",
        description: "Conclua o desafio de segurança antes de criar a conta.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          email: data.email.trim().toLowerCase(),
          username: data.username.trim().toLowerCase(),
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 && /verifica/i.test(body.error || "")) {
          throw new Error("Não conseguimos validar a verificação anti-bot. Atualize a página e tente novamente.");
        }
        throw new Error(body.error || "Ocorreu um erro");
      }
      login(body.token);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Falha no cadastro", description: err.message || "Ocorreu um erro", variant: "destructive" });
      if (window.turnstile && widgetIdRef.current) {
        try { window.turnstile.reset(widgetIdRef.current); } catch { /* noop */ }
      }
      setTurnstileToken(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5">
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-white hover:opacity-70 transition-opacity">IKISS</span>
        </Link>
        <Link href="/login" className="nav-link">Entrar</Link>
      </nav>

      <div
        className="fixed inset-0 bg-cover bg-center opacity-[0.06]"
        style={{ backgroundImage: "url(https://images.unsplash.com/photo-1614729939124-032d1e6c9945?w=1920&q=80)" }}
      />
      <div className="fixed inset-0 bg-gradient-to-br from-black via-black to-black/90" />

      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <p className="label-caps mb-4">Criar Conta — Etapa {step} de 2</p>
            <h1 className="text-4xl font-bold tracking-tight uppercase">
              {step === 1 ? "Quem\nÉ Você?" : "Crie Seu\nLink"}
            </h1>
            <div className="flex gap-2 mt-5">
              <div className="h-px flex-1 transition-colors duration-300" style={{ backgroundColor: 'rgba(255,255,255,0.6)' }} />
              <div className="h-px flex-1 transition-colors duration-300" style={{ backgroundColor: step >= 2 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>

          <div className="glow-line mb-8" />

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div>
                    <label className="label-caps block mb-2">E-mail</label>
                    <input
                      {...form.register("email")}
                      type="email"
                      placeholder="voce@exemplo.com"
                      className="w-full bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
                    />
                    {form.formState.errors.email && (<p className="text-red-400 text-xs mt-1">{form.formState.errors.email.message}</p>)}
                  </div>
                  <div>
                    <label className="label-caps block mb-2">Senha</label>
                    <input
                      {...form.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
                    />
                    {form.formState.errors.password && (<p className="text-red-400 text-xs mt-1">{form.formState.errors.password.message}</p>)}
                  </div>
                  <motion.button
                    type="button"
                    onClick={nextStep}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="btn-solid-white w-full mt-4"
                  >
                    Continuar <ArrowRight className="ml-2 w-4 h-4 inline" />
                  </motion.button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div>
                    <label className="label-caps block mb-2">Nome de usuário</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 border border-r-0 border-white/10 bg-white/5 text-xs text-white/40 tracking-wider rounded-l-sm">
                        ikiss.me/
                      </span>
                      <input
                        {...form.register("username")}
                        placeholder="usuario"
                        className="flex-1 bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-r-sm"
                        onChange={(e) => form.setValue("username", e.target.value.toLowerCase())}
                      />
                    </div>
                    {form.formState.errors.username && (<p className="text-red-400 text-xs mt-1">{form.formState.errors.username.message}</p>)}
                  </div>
                  <div>
                    <label className="label-caps block mb-2">Nome de exibição (opcional)</label>
                    <input
                      {...form.register("displayName")}
                      placeholder="Como as pessoas te veem"
                      className="w-full bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
                    />
                  </div>

                  <div className="pt-1">
                    <div ref={turnstileRef} className="flex justify-center min-h-[70px] items-center" />
                    {widgetState === "loading" && (
                      <p className="text-xs text-white/40 text-center mt-1">Carregando verificação anti-bot…</p>
                    )}
                    {widgetState === "error" && (
                      <div className="flex flex-col items-center gap-2 mt-1">
                        <p className="text-xs text-red-400/80 text-center">
                          A verificação não carregou. Verifique sua conexão ou desative bloqueadores e tente de novo.
                        </p>
                        <button
                          type="button"
                          onClick={reloadWidget}
                          className="text-xs text-white/70 hover:text-white inline-flex items-center gap-1 underline-offset-4 hover:underline"
                        >
                          <RotateCw className="w-3 h-3" /> Tentar de novo
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setStep(1)} className="btn-outline-white flex-1">
                      <ArrowLeft className="mr-1 w-3 h-3 inline" /> Voltar
                    </button>
                    <motion.button
                      type="submit"
                      disabled={submitting}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="btn-solid-white flex-[2] disabled:opacity-50"
                    >
                      {submitting ? "Criando..." : "Criar Perfil"}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="glow-line mt-8 mb-5" />
          <p className="label-caps text-center">
            Já tem conta?{" "}
            <Link href="/login" className="text-white/60 hover:text-white transition-colors">
              Entrar →
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
