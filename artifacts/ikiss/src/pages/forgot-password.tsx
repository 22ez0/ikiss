import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

const API_BASE = `${(import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/+$/, "")}/api`;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || data.success) {
        setStatus("sent");
      } else {
        setErrorMsg(data.error || "Ocorreu um erro. Tente novamente.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5">
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-white hover:opacity-70 transition-opacity">IKISS</span>
        </Link>
        <Link href="/login" className="nav-link">Entrar</Link>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {status === "sent" ? (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold tracking-tight uppercase mb-3">Email Enviado</h1>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Se esse email estiver cadastrado, você vai receber um link para redefinir sua senha. Verifique também a caixa de spam.
            </p>
            <div className="glow-line mb-6" />
            <Link href="/login">
              <button className="btn-outline-white w-full">
                <ArrowLeft className="w-4 h-4 mr-2 inline" /> Voltar ao Login
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="label-caps mb-4">Recuperar acesso</p>
              <h1 className="text-4xl font-bold tracking-tight uppercase">Esqueceu<br />a Senha?</h1>
            </div>

            <div className="glow-line mb-8" />

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label-caps block mb-2">Seu e-mail cadastrado</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    required
                    className="w-full bg-white/[0.04] border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
                  />
                </div>
              </div>

              {status === "error" && (
                <p className="text-red-400 text-xs">{errorMsg}</p>
              )}

              <motion.button
                type="submit"
                disabled={status === "loading"}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="btn-solid-white w-full disabled:opacity-50"
              >
                {status === "loading" ? "Enviando…" : "Enviar link de recuperação"}
              </motion.button>
            </form>

            <div className="glow-line mt-8 mb-5" />
            <p className="label-caps text-center">
              Lembrou?{" "}
              <Link href="/login" className="text-white/60 hover:text-white transition-colors">
                Entrar →
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
