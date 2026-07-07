import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";

const apiBase = () => (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export default function Support() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    email: '',
    username: '',
    subject: 'Esqueci minha senha',
    message: '',
    socialNetwork: '',
  });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const subjects = [
    'Esqueci minha senha',
    'Recuperação de conta',
    'Conta bloqueada',
    'Dúvida geral',
    'Reportar problema técnico',
    'Outro',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.subject || !form.message) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/support/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-3 uppercase tracking-tight">Ticket Enviado!</h1>
          <p className="text-white/50 text-sm mb-8">
            Recebemos sua solicitação. Nossa equipe entrará em contato em breve pelo e-mail informado.
          </p>
          <Link href="/">
            <span className="btn-outline-white text-xs">Voltar ao início</span>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5">
        <Link href="/">
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-white hover:opacity-70 transition-opacity">IKISS</span>
        </Link>
        <Link href="/login" className="nav-link">Entrar</Link>
      </nav>

      <div className="pt-28 pb-24 px-6 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/" className="inline-flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-xs mb-8">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>

          <p className="label-caps mb-3">Ajuda & Suporte</p>
          <h1 className="text-4xl font-bold uppercase tracking-tight mb-2">Suporte</h1>
          <p className="text-white/40 text-sm mb-10">
            Esqueceu sua senha? Problemas com sua conta? Preencha o formulário abaixo.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="label-caps">E-mail *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="seu@email.com"
                required
                className="w-full bg-white/[0.04] border border-white/10 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors rounded-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-caps">Nome de usuário (se lembrar)</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder="@usuario"
                className="w-full bg-white/[0.04] border border-white/10 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors rounded-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-caps">Rede social para verificação (opcional)</label>
              <input
                type="text"
                value={form.socialNetwork}
                onChange={e => setForm(p => ({ ...p, socialNetwork: e.target.value }))}
                placeholder="Instagram, Twitter, Discord..."
                className="w-full bg-white/[0.04] border border-white/10 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors rounded-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-caps">Assunto *</label>
              <select
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/10 px-3 py-3 text-sm text-white focus:outline-none focus:border-white/25 transition-colors rounded-sm appearance-none"
              >
                {subjects.map(s => (
                  <option key={s} value={s} className="bg-[#0d0d0d]">{s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="label-caps">Mensagem *</label>
              <textarea
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                placeholder="Descreva o problema com o máximo de detalhes possível..."
                required
                rows={5}
                maxLength={2000}
                className="w-full bg-white/[0.04] border border-white/10 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors rounded-sm resize-none"
              />
              <p className="text-xs text-white/20 text-right">{form.message.length}/2000</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-solid-white w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Enviando...' : 'Enviar ticket'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
