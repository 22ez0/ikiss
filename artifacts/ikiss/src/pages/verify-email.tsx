import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const API_BASE = `${(import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/+$/, "")}/api`;

export default function VerifyEmail() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Link inválido ou incompleto.");
      return;
    }

    fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStatus("success");
          setMessage("Email verificado com sucesso! Você já pode usar todos os recursos da Ikiss.");
        } else {
          setStatus("error");
          setMessage(data.error || "Link inválido ou expirado. Solicite um novo no dashboard.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Erro ao verificar o email. Tente novamente.");
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm text-center"
      >
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-white hover:opacity-70 transition-opacity block mb-12">
            IKISS
          </span>
        </Link>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-white/60 animate-spin" />
            <p className="text-white/60 text-sm">Verificando seu email…</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <h1 className="text-2xl font-bold tracking-tight uppercase text-white">Email Verificado!</h1>
            <p className="text-white/60 text-sm leading-relaxed">{message}</p>
            <div className="glow-line my-4 w-full" />
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-solid-white w-full"
              >
                Ir para o Dashboard
              </motion.button>
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-red-400" />
            <h1 className="text-2xl font-bold tracking-tight uppercase text-white">Link Inválido</h1>
            <p className="text-white/60 text-sm leading-relaxed">{message}</p>
            <div className="glow-line my-4 w-full" />
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-solid-white w-full"
              >
                Ir para o Login
              </motion.button>
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
