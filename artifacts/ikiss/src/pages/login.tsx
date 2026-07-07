import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

const loginSchema = z.object({
  identifier: z.string().min(3, "Informe e-mail ou @usuario"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    if (document.querySelector('script[data-turnstile]')) {
      tryRender();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-turnstile", "1");
    window.onTurnstileLoad = tryRender;
    document.head.appendChild(s);
  }, []);

  function tryRender() {
    if (!turnstileRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: (t) => setTurnstileToken(t),
      "error-callback": () => setTurnstileToken(null),
    });
  }

  const onSubmit = async (data: LoginFormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: data.identifier,
          email: data.identifier,
          password: data.password,
          turnstileToken,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Credenciais inválidas");
      login(body.token);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Falha no login", description: err.message || "Credenciais inválidas", variant: "destructive" });
      if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current);
      setTurnstileToken(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5">
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-white hover:opacity-70 transition-opacity">IKISS</span>
        </Link>
        <Link href="/register" className="nav-link">Criar conta</Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-10">
            <p className="label-caps mb-4">Entrar</p>
            <h1 className="text-4xl font-bold tracking-tight uppercase">Bem-vindo<br />de Volta</h1>
          </div>

          <div className="glow-line mb-10" />

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label-caps block mb-2">E-mail ou @usuário</label>
              <input
                {...form.register("identifier")}
                type="text"
                autoComplete="username"
                placeholder="voce@exemplo.com  ou  @seuuser"
                className="w-full bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
              />
              {form.formState.errors.identifier && (
                <p className="text-red-400 text-xs mt-1">{form.formState.errors.identifier.message}</p>
              )}
            </div>

            <div>
              <label className="label-caps block mb-2">Senha</label>
              <input
                {...form.register("password")}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
              />
              {form.formState.errors.password && (
                <p className="text-red-400 text-xs mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div ref={turnstileRef} className="flex justify-center pt-1" />

            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="btn-solid-white w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Entrando..." : (
                <>Entrar <ArrowRight className="ml-2 w-4 h-4 inline" /></>
              )}
            </motion.button>

            <p className="text-[10px] text-white/30 text-center">
              Sessão fica ativa por 90 dias neste dispositivo.
            </p>
          </form>

          <div className="glow-line mt-10 mb-6" />

          <p className="label-caps text-center mb-4">
            Sem conta?{" "}
            <Link href="/register" className="text-white/60 hover:text-white transition-colors">
              Criar uma →
            </Link>
          </p>
          <p className="label-caps text-center">
            Esqueceu a senha?{" "}
            <Link href="/forgot-password" className="text-white/60 hover:text-white transition-colors">
              Recuperar acesso →
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
