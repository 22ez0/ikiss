import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, Eye, EyeOff } from "lucide-react";

const API_BASE = `${(import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/+$/, "")}/api`;

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setErrorMsg("Senha deve ter pelo menos 6 caracteres."); return; }
    if (password !== confirm) { setErrorMsg("As senhas não coincidem."); return; }
    if (!token) { setErrorMsg("Token inválido. Use o link recebido por email."); return; }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || data.success) {
        setStatus("done");
      } else {
        setErrorMsg(data.error || "Link inválido ou expirado. Solicite um novo.");
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
        {status === "done" ? (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold tracking-tight uppercase mb-3">Senha Redefinida!</h1>
            <p className="text-white/60 text-sm mb-6">Sua nova senha foi salva. Faça login para continuar.</p>
            <div className="glow-line mb-6" />
            <Link href="/login">
              <motion.button whileHover={{ scale: 1.02 }} className="btn-solid-white w-full">
                Ir para o Login
              </motion.button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="label-caps mb-4">Nova senha</p>
              <h1 className="text-4xl font-bold tracking-tight uppercase">Redefinir<br />Senha</h1>
            </div>

            <div className="glow-line mb-8" />

            {!token ? (
              <div className="text-center">
                <p className="text-red-400 text-sm mb-6">Link inválido. Use o link recebido por email.</p>
                <Link href="/forgot-password">
                  <button className="btn-outline-white w-full">Solicitar novo link</button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label-caps block mb-2">Nova senha</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="w-full bg-white/[0.04] border border-white/10 px-4 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label-caps block mb-2">Confirmar senha</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    className="w-full bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors rounded-sm"
                  />
                </div>

                {(status === "error" || errorMsg) && (
                  <p className="text-red-400 text-xs">{errorMsg}</p>
                )}

                <motion.button
                  type="submit"
                  disabled={status === "loading"}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="btn-solid-white w-full disabled:opacity-50"
                >
                  {status === "loading" ? "Salvando…" : "Salvar nova senha"}
                </motion.button>
              </form>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
