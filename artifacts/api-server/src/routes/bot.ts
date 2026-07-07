import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

const router = Router();

// ── Config ────────────────────────────────────────────────────────────────────
const BOT_USER = '141';
const BOT_PASS = 'jabuti';
const DISCORD_API = 'https://discord.com/api/v10';
const CDN = 'https://cdn.jsdelivr.net/gh/22ez0/ikiss@main/artifacts/api-server/src/routes/bot-assets';
const FORUM_CHANNEL_ID = '1446925440882315315';
const FORUM_POSTS = ['realword', 'realwordpt'];

// ── Auth sessions ─────────────────────────────────────────────────────────────
const SESSIONS = new Set<string>();

function checkAuth(req: Request, res: Response, next: NextFunction): void {
  const cookies = (req as Request & { cookies?: Record<string,string> }).cookies ?? {};
  if (cookies['botSession'] && SESSIONS.has(cookies['botSession'])) { next(); return; }
  res.status(401).json({ error: 'não autorizado' });
}

// ── Discord state ─────────────────────────────────────────────────────────────
interface Account { token: string; id: string; username: string; discriminator: string; tag: string; }
const accounts = new Map<string, Account>();
let firingActive = false;
const sseClients = new Map<string, Set<Response>>();
const ssePollers = new Map<string, ReturnType<typeof setInterval>>();
const forumSseClients = new Set<Response>();
const forumUsernames: Array<{ username: string; post: string; timestamp: number; messageId: string }> = [];
let forumPoller: ReturnType<typeof setInterval> | null = null;
let forumTokens: string[] = [];

// ── Discord REST helpers ──────────────────────────────────────────────────────
async function discordGet(path: string, token: string): Promise<unknown> {
  const r = await fetch(`${DISCORD_API}${path}`, { headers: { Authorization: token } });
  if (!r.ok) throw new Error(`discord ${r.status}: ${await r.text().catch(() => '')}`);
  return r.json();
}

async function discordPost(path: string, token: string, body: unknown): Promise<unknown> {
  const r = await fetch(`${DISCORD_API}${path}`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`discord ${r.status}: ${await r.text().catch(() => '')}`);
  return r.json();
}

async function validateToken(token: string): Promise<Account> {
  const user = await discordGet('/users/@me', token) as Record<string,string>;
  const disc = user['discriminator'] || '0';
  const tag = disc === '0' ? user['username'] : `${user['username']}#${disc}`;
  return { token, id: user['id'], username: user['username'], discriminator: disc, tag };
}

interface Channel { id: string; name: string; type: 'text' | 'voice'; }
async function fetchGuildChannels(guildId: string, token: string): Promise<Channel[]> {
  const channels = await discordGet(`/guilds/${guildId}/channels`, token) as Array<Record<string,unknown>>;
  const text: Channel[] = [], voice: Channel[] = [];
  for (const ch of channels) {
    if (ch['type'] === 0 || ch['type'] === 5) text.push({ id: ch['id'] as string, name: ch['name'] as string, type: 'text' });
    else if (ch['type'] === 2 || ch['type'] === 13) voice.push({ id: ch['id'] as string, name: ch['name'] as string, type: 'voice' });
  }
  text.sort((a, b) => a.name.localeCompare(b.name));
  voice.sort((a, b) => a.name.localeCompare(b.name));
  return [...text, ...voice];
}

function parseGuildId(input: string): string | null {
  const m = input.match(/discord\.com\/channels\/(\d+)/);
  if (m) return m[1];
  if (/^\d+$/.test(input.trim())) return input.trim();
  return null;
}

function extractUsernames(content: string): string[] {
  const re = /\*\*([^*]+)\*\*/g; const out: string[] = []; let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

function startChannelPoller(guildId: string): void {
  if (ssePollers.has(guildId)) return;
  const t = setInterval(async () => {
    const clients = sseClients.get(guildId);
    if (!clients || clients.size === 0) { clearInterval(t); ssePollers.delete(guildId); return; }
    const acc = [...accounts.values()][0];
    if (!acc) return;
    try {
      const channels = await fetchGuildChannels(guildId, acc.token);
      const data = JSON.stringify({ type: 'update', channels });
      for (const res of clients) { try { res.write(`data: ${data}\n\n`); } catch (_) { /* ignore */ } }
    } catch (_) { /* ignore */ }
  }, 5000);
  ssePollers.set(guildId, t);
}

async function pollForum(): Promise<void> {
  const token = forumTokens[0];
  if (!token) return;
  try {
    const threads = await discordGet(`/channels/${FORUM_CHANNEL_ID}/threads/active`, token)
      .catch(() => ({ threads: [] })) as Record<string, unknown[]>;
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    for (const thread of (threads['threads'] || []) as Array<Record<string,unknown>>) {
      const name = ((thread['name'] as string) || '').toLowerCase();
      if (!FORUM_POSTS.some(p => name.includes(p))) continue;
      const msgs = await discordGet(`/channels/${thread['id']}/messages?limit=50`, token)
        .catch(() => []) as Array<Record<string,unknown>>;
      for (const msg of [...msgs].reverse()) {
        const ts = msg['timestamp'] ? new Date(msg['timestamp'] as string).getTime() : 0;
        if (ts < tenMinAgo) continue;
        if (forumUsernames.find(e => e.messageId === msg['id'])) continue;
        const usernames = extractUsernames((msg['content'] as string) || '');
        for (const u of usernames) {
          const entry = { username: u, post: thread['name'] as string, timestamp: ts, messageId: msg['id'] as string };
          forumUsernames.push(entry);
          const d = JSON.stringify(entry);
          for (const res of forumSseClients) { try { res.write(`data: ${d}\n\n`); } catch (_) { /* ignore */ } }
        }
      }
    }
  } catch (_) { /* ignore */ }
}

// ── HTML ──────────────────────────────────────────────────────────────────────
const LOGIN_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>discord panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:center;background:#000;overflow:hidden}
video{position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:-3}
.blob{position:fixed;border-radius:50%;filter:blur(80px);z-index:-2;pointer-events:none}
.b1{width:500px;height:500px;background:radial-gradient(circle,rgba(88,101,242,.55) 0%,transparent 70%);top:-130px;left:-130px;animation:fA 9s ease-in-out infinite}
.b2{width:420px;height:420px;background:radial-gradient(circle,rgba(235,69,158,.45) 0%,transparent 70%);bottom:-80px;right:-80px;animation:fB 12s ease-in-out infinite}
@keyframes fA{0%,100%{transform:translate(0,0)}50%{transform:translate(60px,50px)}}
@keyframes fB{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,-50px)}}
.ov{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:-1}
.box{background:rgba(255,255,255,.07);backdrop-filter:blur(48px) saturate(200%);-webkit-backdrop-filter:blur(48px) saturate(200%);border:1px solid rgba(255,255,255,.18);border-radius:24px;padding:36px 28px;width:320px;display:flex;flex-direction:column;gap:18px;box-shadow:0 0 0 .5px rgba(255,255,255,.08) inset,0 8px 32px rgba(0,0,0,.4),0 32px 80px rgba(0,0,0,.3);position:relative}
.box::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)}
img{width:56px;height:56px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(255,255,255,.2);margin:0 auto;display:block;box-shadow:0 0 0 4px rgba(255,255,255,.05)}
p{text-align:center;font-size:.8em;color:rgba(255,255,255,.3)}
input{width:100%;padding:11px 13px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.06);backdrop-filter:blur(10px);color:#fff;font-size:.88em;outline:none;transition:all .2s}
input:focus{border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.1)}
input::placeholder{color:rgba(255,255,255,.2)}
button{padding:12px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(255,255,255,.1);backdrop-filter:blur(30px);color:#fff;font-size:.85em;font-weight:600;cursor:pointer;transition:all .18s;box-shadow:0 1px 2px rgba(0,0,0,.3),0 .5px 0 rgba(255,255,255,.1) inset}
button:hover{background:rgba(255,255,255,.17);transform:translateY(-1px)}
.err{color:rgba(255,100,100,.9);font-size:.78em;text-align:center;display:none}
audio{display:none}
</style>
</head>
<body>
<video autoplay muted loop playsinline><source src="${CDN}/bg.mp4" type="video/mp4"></video>
<div class="blob b1"></div><div class="blob b2"></div>
<div class="ov"></div>
<audio id="m" loop><source src="${CDN}/music.mp3" type="audio/mpeg"></audio>
<div class="box">
<img src="${CDN}/avatar.jpg" alt="">
<p>by noah</p>
<input type="text" id="u" placeholder="usuário" autocomplete="off">
<input type="password" id="p" placeholder="senha" autocomplete="off">
<button id="btn">entrar</button>
<div class="err" id="err">credenciais inválidas</div>
</div>
<script>
const m=document.getElementById('m');
function tryPlay(){m.volume=.35;m.play().catch(()=>{});}
document.addEventListener('click',tryPlay,{once:true});
document.addEventListener('keydown',tryPlay,{once:true});
document.getElementById('btn').onclick=async()=>{
const r=await fetch('/api/bot/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:document.getElementById('u').value,pass:document.getElementById('p').value})});
const d=await r.json();if(d.success)location.reload();else document.getElementById('err').style.display='block';};
document.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('btn').click();});
</script>
</body>
</html>`;

const PANEL_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>discord panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:flex-start;padding:30px 16px 60px;position:relative;overflow-x:hidden;background:#000}
video{position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:-3}
.blob{position:fixed;border-radius:50%;filter:blur(80px);z-index:-2;pointer-events:none;opacity:.75}
.b1{width:520px;height:520px;background:radial-gradient(circle,rgba(88,101,242,.55) 0%,transparent 70%);top:-140px;left:-140px;animation:fA 9s ease-in-out infinite}
.b2{width:440px;height:440px;background:radial-gradient(circle,rgba(235,69,158,.45) 0%,transparent 70%);bottom:-100px;right:-80px;animation:fB 12s ease-in-out infinite}
.b3{width:360px;height:360px;background:radial-gradient(circle,rgba(87,242,135,.3) 0%,transparent 70%);top:40%;left:55%;animation:fC 15s ease-in-out infinite}
@keyframes fA{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(60px,40px) scale(1.08)}66%{transform:translate(-30px,80px) scale(.95)}}
@keyframes fB{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-70px,-50px) scale(1.1)}70%{transform:translate(40px,-80px) scale(.92)}}
@keyframes fC{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-60px,50px) scale(1.12)}}
.ov{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:-1}
#muteBtn{position:fixed;bottom:20px;right:20px;z-index:100;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);backdrop-filter:blur(20px);color:rgba(255,255,255,.3);font-size:1em;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center}
#muteBtn:hover{background:rgba(255,255,255,.14);color:rgba(255,255,255,.7)}
#muteBtn.on{color:#34c759;border-color:rgba(52,199,89,.4);background:rgba(52,199,89,.1)}
.c{width:100%;max-width:460px;position:relative;z-index:1}
.panel{background:rgba(255,255,255,.07);backdrop-filter:blur(48px) saturate(200%) brightness(1.1);-webkit-backdrop-filter:blur(48px) saturate(200%) brightness(1.1);border:1px solid rgba(255,255,255,.18);border-radius:28px;padding:28px 22px;color:#fff;display:flex;flex-direction:column;gap:16px;box-shadow:0 0 0 .5px rgba(255,255,255,.08) inset,0 8px 32px rgba(0,0,0,.35),0 32px 80px rgba(0,0,0,.3),0 1px 0 rgba(255,255,255,.12) inset;position:relative}
.panel::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);border-radius:0 0 50% 50%}
.hdr{display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.08)}
.hdr img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(255,255,255,.2);box-shadow:0 0 0 4px rgba(255,255,255,.05),0 4px 20px rgba(0,0,0,.4)}
.hdr p{font-size:.78em;color:rgba(255,255,255,.3)}
.sb{display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px 14px;backdrop-filter:blur(20px)}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot.on{background:#34c759;box-shadow:0 0 0 3px rgba(52,199,89,.2),0 0 12px rgba(52,199,89,.7);animation:p 2s infinite}
.dot.off{background:rgba(255,255,255,.2)}
@keyframes p{0%,100%{box-shadow:0 0 0 3px rgba(52,199,89,.2),0 0 12px rgba(52,199,89,.7)}50%{box-shadow:0 0 0 5px rgba(52,199,89,.08),0 0 6px rgba(52,199,89,.3)}}
#stt{font-size:.82em;font-weight:500;color:rgba(255,255,255,.45)}
.bdg{margin-left:auto;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);font-size:.7em;font-weight:600;padding:3px 9px;border-radius:20px}
.tabs{display:flex;gap:3px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:4px;backdrop-filter:blur(10px)}
.tab{flex:1;padding:7px 4px;border:none;border-radius:11px;background:transparent;color:rgba(255,255,255,.3);font-size:.74em;font-weight:600;cursor:pointer;transition:all .2s}
.tab.on{background:rgba(255,255,255,.14);color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35),0 .5px 0 rgba(255,255,255,.12) inset}
.tab:hover:not(.on){color:rgba(255,255,255,.6)}
.tc{display:none;flex-direction:column;gap:12px}.tc.on{display:flex}
.hint{font-size:.76em;color:rgba(255,255,255,.3);line-height:1.5}
.ig{display:flex;flex-direction:column;gap:6px}
.ig label{font-size:.72em;font-weight:600;color:rgba(255,255,255,.35);letter-spacing:.3px}
.ir{display:flex;gap:8px}
input,textarea{width:100%;padding:11px 13px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.06);backdrop-filter:blur(10px);color:#fff;font-size:.86em;font-family:'SF Mono','Monaco','Courier New',monospace;transition:all .2s;resize:none;outline:none}
input:focus,textarea:focus{border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.1);box-shadow:0 0 0 3px rgba(255,255,255,.05)}
input::placeholder,textarea::placeholder{color:rgba(255,255,255,.2)}
input:disabled{opacity:.35;cursor:not-allowed}
.tc_{font-size:.74em;color:rgba(255,255,255,.25);text-align:right}
.tc_.a{color:rgba(255,255,255,.6)}
.pb{height:2px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.pf{height:100%;background:linear-gradient(90deg,rgba(88,101,242,.8),rgba(235,69,158,.8));border-radius:2px;transition:width .3s}
.btn{padding:11px 18px;border-radius:14px;font-size:.82em;font-weight:600;cursor:pointer;transition:all .18s;backdrop-filter:blur(30px) saturate(200%);border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.1);color:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.3),0 .5px 0 rgba(255,255,255,.1) inset}
.btn:hover:not(:disabled){background:rgba(255,255,255,.17);transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,.25)}
.btn:active:not(:disabled){transform:scale(.97)}
.btn:disabled{opacity:.2;cursor:not-allowed;transform:none!important}
.bg{background:rgba(52,199,89,.12);border-color:rgba(52,199,89,.3);color:#4cd964;flex:1}
.bg:hover:not(:disabled){background:rgba(52,199,89,.2);border-color:rgba(52,199,89,.5);box-shadow:0 6px 24px rgba(52,199,89,.18)}
.br{background:rgba(255,69,58,.1);border-color:rgba(255,69,58,.28);color:#ff6b6b;flex:1}
.br:hover:not(:disabled){background:rgba(255,69,58,.18);border-color:rgba(255,69,58,.45);box-shadow:0 6px 24px rgba(255,69,58,.15)}
.full{width:100%;flex:unset}
.bgrp{display:flex;gap:8px}
.tl{display:flex;flex-direction:column;gap:5px;max-height:240px;overflow-y:auto}
.tl::-webkit-scrollbar{width:3px}.tl::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.ti{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:8px 12px;backdrop-filter:blur(10px)}
.ta{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.07);flex-shrink:0}
.ti-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ti-tag{font-size:.84em;font-weight:600;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ti-id{font-size:.68em;color:rgba(255,255,255,.22);font-family:monospace}
.rm{background:none;border:none;color:rgba(255,255,255,.2);cursor:pointer;font-size:.76em;padding:3px 7px;border-radius:6px;transition:all .15s;flex-shrink:0}
.rm:hover{color:#ff453a;background:rgba(255,69,58,.12)}
.gn{font-size:.8em;font-weight:600;color:rgba(255,255,255,.5);padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:9px;display:none}
.cl{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow-y:auto}
.cl::-webkit-scrollbar{width:3px}.cl::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
.cgl{font-size:.65em;font-weight:700;color:rgba(255,255,255,.22);text-transform:uppercase;letter-spacing:.8px;padding:8px 8px 3px}
.ci{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .15s;border:1px solid transparent}
.ci:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.1)}
.ch{font-size:.82em;color:rgba(255,255,255,.25);font-weight:700;width:14px;flex-shrink:0}
.ci.v .ch{color:rgba(52,199,89,.5)}
.cn{font-size:.83em;color:rgba(255,255,255,.68);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-loading,.cl-empty,.cl-error{font-size:.78em;color:rgba(255,255,255,.25);text-align:center;padding:20px}
.cl-error{color:rgba(255,69,58,.6)}
.sc{display:none;align-items:center;justify-content:space-between;background:rgba(52,199,89,.08);border:1px solid rgba(52,199,89,.22);border-radius:10px;padding:8px 12px;font-size:.8em;color:#4cd964}
.sc button{background:none;border:none;color:rgba(52,199,89,.45);cursor:pointer;font-size:.8em;padding:2px 6px;border-radius:5px;transition:color .15s}
.sc button:hover{color:#34c759}
.cr{display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto}
.cri{display:flex;justify-content:space-between;padding:7px 11px;border-radius:9px;font-size:.78em}
.cri.ok{background:rgba(52,199,89,.07);border:1px solid rgba(52,199,89,.15);color:rgba(255,255,255,.55)}
.cri.ok span:last-child{color:#4cd964;font-weight:600}
.cri.fail{background:rgba(255,69,58,.07);border:1px solid rgba(255,69,58,.15);color:rgba(255,255,255,.35)}
.cri.fail span:last-child{color:rgba(255,69,58,.7)}
.ms{font-size:.76em;color:rgba(52,199,89,.8);text-align:center;padding:6px 10px;background:rgba(52,199,89,.06);border:1px solid rgba(52,199,89,.15);border-radius:9px;display:none}
.ul{display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto}
.ul::-webkit-scrollbar{width:3px}.ul::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
.ui{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:11px;transition:all .3s}
.ui.new{background:rgba(52,199,89,.1);border-color:rgba(52,199,89,.28);animation:fi .4s ease}
@keyframes fi{from{transform:translateY(-5px);opacity:0}to{transform:translateY(0);opacity:1}}
.unh{font-size:.9em;font-weight:700;color:rgba(255,255,255,.88)}
.um{display:flex;align-items:center;gap:8px}
.up{font-size:.68em;font-weight:600;color:rgba(255,255,255,.22);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:2px 7px;border-radius:10px;text-transform:uppercase;letter-spacing:.4px}
.ut{font-size:.72em;color:rgba(255,255,255,.22);font-family:monospace}
.msg{padding:11px 14px;border-radius:12px;font-size:.8em;font-weight:500;text-align:center;display:none;backdrop-filter:blur(20px);animation:fup .2s ease}
.msg.on{display:block}
.msg.s{background:rgba(52,199,89,.1);border:1px solid rgba(52,199,89,.22);color:#4cd964}
.msg.e{background:rgba(255,69,58,.1);border:1px solid rgba(255,69,58,.22);color:#ff6b6b}
.msg.i{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.6)}
@keyframes fup{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:480px){body{padding:16px 12px 40px}.panel{padding:20px 16px}.bgrp{flex-direction:column}.ir{flex-direction:column}.tabs{gap:2px}.tab{font-size:.68em;padding:7px 3px}.b1{width:300px;height:300px}.b2{width:260px;height:260px}.b3{display:none}}
</style>
</head>
<body>
<video autoplay muted loop playsinline><source src="${CDN}/bg.mp4" type="video/mp4"></video>
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<div class="ov"></div>
<audio id="bgMusic" loop><source src="${CDN}/music.mp3" type="audio/mpeg"></audio>
<button id="muteBtn" title="música">♪</button>
<div class="c"><div class="panel">
<div class="hdr"><img src="${CDN}/avatar.jpg" alt=""><p>by noah</p></div>
<div class="sb"><span class="dot off" id="dot"></span><span id="stt">desconectado</span><span class="bdg" id="bdg" style="display:none"></span></div>
<div class="tabs">
<button class="tab on" data-t="tokens">tokens</button>
<button class="tab" data-t="canais">canais</button>
<button class="tab" data-t="mensagem">mensagem</button>
<button class="tab" data-t="call">call</button>
<button class="tab" data-t="monitor">monitor</button>
</div>
<div class="tc on" id="tab-tokens">
<p class="hint">cole até 100 tokens — detecta e separa automaticamente</p>
<textarea id="bulk" placeholder="cole os tokens aqui..." rows="6"></textarea>
<div class="tc_" id="tcount">0 tokens detectados</div>
<button class="btn full" id="addBtn">conectar tokens</button>
<div class="pb" id="pb" style="display:none"><div class="pf" id="pf"></div></div>
<div class="tl" id="tl"></div>
<button class="btn br full" id="discAll" style="display:none">desconectar todas</button>
</div>
<div class="tc" id="tab-canais">
<p class="hint">insira o id ou url do servidor para listar canais em tempo real</p>
<div class="ir"><input type="text" id="gid" placeholder="id ou discord.com/channels/..."><button class="btn" id="loadCh">carregar</button></div>
<div class="gn" id="gname"></div><div class="cl" id="chl"></div>
<div class="sc" id="selch"><span id="selchname"></span><button id="clrch">limpar</button></div>
</div>
<div class="tc" id="tab-mensagem">
<p class="hint">1 conta envia 1 mensagem no canal selecionado</p>
<div class="ig"><label>id do canal</label><input type="text" id="chid" placeholder="ex: 1234567890123456789"></div>
<div class="ig"><label>mensagem</label><input type="text" id="msgt" placeholder="digite a mensagem..."></div>
<div class="bgrp"><button class="btn bg" id="fireBtn">disparar</button><button class="btn br" id="stopBtn" disabled>parar</button></div>
</div>
<div class="tc" id="tab-call">
<p class="hint">todas as contas conectadas entram no canal de voz</p>
<div class="ir"><input type="text" id="vchid" placeholder="id do canal de voz..."><button class="btn" id="joinBtn">entrar</button></div>
<div class="cr" id="callr"></div>
</div>
<div class="tc" id="tab-monitor">
<p class="hint">monitora usernames disponíveis nos posts realword & realwordpt</p>
<div class="ig"><label>token (para leitura)</label><input type="password" id="mtoken" placeholder="cole o token aqui..."></div>
<div class="bgrp"><button class="btn bg" id="startMon">iniciar monitor</button><button class="btn br" id="stopMon" disabled>parar</button></div>
<div class="ms" id="monst"></div><div class="ul" id="ulist"></div>
</div>
<div class="msg" id="msg"></div>
</div></div>
<script>
const P='/api/bot',TR=/[A-Za-z0-9_-]{20,30}\\.[A-Za-z0-9_-]{4,8}\\.[A-Za-z0-9_-]{25,45}/g;
let known=[],gEs=null,fEs=null,playing=false;
const music=document.getElementById('bgMusic'),muteBtn=document.getElementById('muteBtn');
function tryPlay(){music.volume=.35;music.play().then(()=>{playing=true;muteBtn.classList.add('on');}).catch(()=>{});}
muteBtn.onclick=()=>{if(playing){music.pause();playing=false;muteBtn.classList.remove('on');}else tryPlay();};
document.addEventListener('click',()=>{if(!playing)tryPlay();},{once:true});
function det(s){return[...new Set(s.match(TR)||[])]}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
document.querySelectorAll('.tc').forEach(x=>x.classList.remove('on'));
t.classList.add('on');document.getElementById('tab-'+t.dataset.t).classList.add('on');
}));
document.getElementById('bulk').addEventListener('input',()=>{
const d=det(document.getElementById('bulk').value);const al=d.filter(t=>known.includes(t)).length;
const tc=document.getElementById('tcount');
tc.textContent=d.length+' token'+(d.length!==1?'s':'')+' detectado'+(d.length!==1?'s':'')+(al?' ('+al+' já conectado'+(al!==1?'s':'')+')':'');
tc.className='tc_'+(d.length?' a':'');
});
document.getElementById('addBtn').addEventListener('click',addTokens);
document.getElementById('discAll').addEventListener('click',discAll);
document.getElementById('loadCh').addEventListener('click',loadChs);
document.getElementById('clrch').addEventListener('click',()=>{document.getElementById('selch').style.display='none';document.getElementById('chid').value='';});
document.getElementById('fireBtn').addEventListener('click',fire);
document.getElementById('stopBtn').addEventListener('click',stopFire);
document.getElementById('joinBtn').addEventListener('click',joinCall);
document.getElementById('startMon').addEventListener('click',startMon);
document.getElementById('stopMon').addEventListener('click',stopMon);
async function api(path,opts){const r=await fetch(P+path,opts);return r.json();}
async function addTokens(){
const raw=document.getElementById('bulk').value.trim();if(!raw)return msg('cole os tokens primeiro','e');
const det2=det(raw);if(!det2.length)return msg('nenhum token válido encontrado','e');
const toAdd=det2.filter(t=>!known.includes(t));if(!toAdd.length)return msg('todos já conectados','i');
const btn=document.getElementById('addBtn');btn.disabled=true;btn.textContent='conectando...';
const pb=document.getElementById('pb');pb.style.display='block';document.getElementById('pf').style.width='0%';
let done=0,ok=0;
for(let i=0;i<toAdd.length;i+=5){
const batch=toAdd.slice(i,i+5);
try{const d=await api('/add-tokens',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw:batch.join('\\n')})});
if(d.results)d.results.forEach(r=>{if(r.success)ok++;done++;document.getElementById('pf').style.width=Math.round(done/toAdd.length*100)+'%';});}
catch(_){done+=batch.length;document.getElementById('pf').style.width=Math.round(done/toAdd.length*100)+'%';}
await refreshTl();}
document.getElementById('bulk').value='';document.getElementById('tcount').textContent='0 tokens detectados';document.getElementById('tcount').className='tc_';
msg(ok+' de '+toAdd.length+' tokens conectados',ok?'s':'e');
setTimeout(()=>{pb.style.display='none';},800);
btn.disabled=false;btn.textContent='conectar tokens';await refreshTl();}
async function removeToken(token){try{await api('/remove-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});known=known.filter(t=>t!==token);await refreshTl();}catch(_){}}
async function discAll(){const b=document.getElementById('discAll');b.disabled=true;b.textContent='desconectando...';try{await api('/disconnect-all',{method:'POST'});known=[];renderTl([]);updateSb(0);msg('todas desconectadas','s');}catch(e){msg('erro: '+e.message,'e');}finally{b.disabled=false;b.textContent='desconectar todas';}}
async function refreshTl(){try{const d=await api('/tokens');known=d.accounts.map(a=>a.tokenKey);renderTl(d.accounts);updateSb(d.count);}catch(_){}}
function renderTl(accs){
const tl=document.getElementById('tl');tl.innerHTML='';
document.getElementById('discAll').style.display=accs.length?'block':'none';
accs.forEach(acc=>{const disc=parseInt(acc.discriminator||'0')%5;
const el=document.createElement('div');el.className='ti';
el.innerHTML='<img class="ta" src="https://cdn.discordapp.com/embed/avatars/'+disc+'.png" onerror="this.style.display=\\'none\\'"><div class="ti-info"><span class="ti-tag">'+acc.tag+'</span><span class="ti-id">'+acc.id+'</span></div><button class="rm" data-token="'+acc.tokenKey+'">x</button>';
el.querySelector('.rm').addEventListener('click',e=>removeToken(e.target.dataset.token));
tl.appendChild(el);});}
function updateSb(count){const dot=document.getElementById('dot'),stt=document.getElementById('stt'),bdg=document.getElementById('bdg');
if(count>0){dot.className='dot on';stt.textContent='conectado';bdg.textContent=count+' conta'+(count!==1?'s':'');bdg.style.display='inline-block';}
else{dot.className='dot off';stt.textContent='desconectado';bdg.style.display='none';}}
function loadChs(){
const id=document.getElementById('gid').value.trim();if(!id)return msg('insira o id ou url do servidor','e');
if(gEs){gEs.close();gEs=null;}
document.getElementById('chl').innerHTML='<div class="cl-loading">carregando canais...</div>';
document.getElementById('gname').style.display='none';
gEs=new EventSource(P+'/channels/stream/'+encodeURIComponent(id));
gEs.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='error'){document.getElementById('chl').innerHTML='<div class="cl-error">'+d.message+'</div>';return;}
if(d.guildName){const gn=document.getElementById('gname');gn.textContent=d.guildName;gn.style.display='block';}
renderChs(d.channels);};
gEs.onerror=()=>{document.getElementById('chl').innerHTML='<div class="cl-error">erro ao conectar</div>';gEs.close();};}
function renderChs(chs){const cl=document.getElementById('chl');cl.innerHTML='';
if(!chs||!chs.length){cl.innerHTML='<div class="cl-empty">nenhum canal encontrado</div>';return;}
const txt=chs.filter(c=>c.type==='text'),voc=chs.filter(c=>c.type==='voice');
if(txt.length){const l=document.createElement('div');l.className='cgl';l.textContent='texto';cl.appendChild(l);txt.forEach(ch=>{const i=document.createElement('div');i.className='ci text';i.innerHTML='<span class="ch">#</span><span class="cn">'+ch.name+'</span>';i.onclick=()=>selCh(ch);cl.appendChild(i);});}
if(voc.length){const l=document.createElement('div');l.className='cgl';l.textContent='voz';cl.appendChild(l);voc.forEach(ch=>{const i=document.createElement('div');i.className='ci v';i.innerHTML='<span class="ch">v</span><span class="cn">'+ch.name+'</span>';i.onclick=()=>selCh(ch);cl.appendChild(i);});}}
function selCh(ch){
if(ch.type==='text'){document.getElementById('chid').value=ch.id;document.getElementById('selchname').textContent='# '+ch.name;document.getElementById('selch').style.display='flex';switchTab('mensagem');}
else{document.getElementById('vchid').value=ch.id;switchTab('call');msg('canal "'+ch.name+'" selecionado','i');}}
function switchTab(name){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));document.querySelectorAll('.tc').forEach(c=>c.classList.remove('on'));document.querySelector('[data-t="'+name+'"]').classList.add('on');document.getElementById('tab-'+name).classList.add('on');}
async function fire(){
const ch=document.getElementById('chid').value.trim(),m2=document.getElementById('msgt').value.trim();
if(!ch||!m2)return msg('preencha o id do canal e a mensagem','e');
const b=document.getElementById('fireBtn');b.disabled=true;b.textContent='disparando...';
document.getElementById('stopBtn').disabled=false;
try{const d=await api('/start-fire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelId:ch,message:m2})});msg(d.message,d.success?'s':'e');}
catch(e){msg('erro: '+e.message,'e');}
finally{b.disabled=false;b.textContent='disparar';document.getElementById('stopBtn').disabled=true;}}
async function stopFire(){try{await api('/stop-fire',{method:'POST'});}catch(_){}msg('disparo parado','i');document.getElementById('stopBtn').disabled=true;document.getElementById('fireBtn').disabled=false;}
async function joinCall(){const ch=document.getElementById('vchid').value.trim();if(!ch)return msg('insira o id do canal','e');msg('voz requer gateway — não suportado nesta versão','i');}
async function startMon(){
const token=document.getElementById('mtoken').value.trim();if(!token)return msg('insira o token','e');
const b=document.getElementById('startMon');b.disabled=true;b.textContent='iniciando...';
try{const d=await api('/forum/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
if(!d.success){msg(d.message,'e');b.disabled=false;b.textContent='iniciar monitor';return;}
const ms=document.getElementById('monst');ms.textContent='monitorando realword & realwordpt';ms.style.display='block';
b.disabled=true;document.getElementById('stopMon').disabled=false;b.textContent='iniciar monitor';
if(d.history)d.history.forEach(e=>addUname(e,false));
if(fEs)fEs.close();
fEs=new EventSource(P+'/forum/stream');
fEs.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='history'){document.getElementById('ulist').innerHTML='';d.entries.forEach(x=>addUname(x,false));}else if(d.username)addUname(d,true);};}
catch(e){msg('erro: '+e.message,'e');b.disabled=false;b.textContent='iniciar monitor';}}
async function stopMon(){try{await api('/forum/stop',{method:'POST'});}catch(_){}if(fEs){fEs.close();fEs=null;}document.getElementById('monst').style.display='none';document.getElementById('startMon').disabled=false;document.getElementById('stopMon').disabled=true;msg('monitor parado','i');}
function addUname(entry,isNew){const ul=document.getElementById('ulist');const el=document.createElement('div');el.className='ui'+(isNew?' new':'');
const t=new Date(entry.timestamp);const ts=t.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const pl=entry.post?.toLowerCase().includes('pt')?'pt':'en';
el.innerHTML='<span class="unh">@'+entry.username+'</span><div class="um"><span class="up">'+pl+'</span><span class="ut">'+ts+'</span></div>';
if(isNew){ul.prepend(el);setTimeout(()=>el.classList.remove('new'),1000);}else ul.appendChild(el);}
function msg(text,type){const m=document.getElementById('msg');m.textContent=text;m.className='msg on '+type;clearTimeout(m._t);m._t=setTimeout(()=>m.classList.remove('on'),5000);}
refreshTl();setInterval(refreshTl,8000);
</script>
</body>
</html>`;

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/bot', (req: Request, res: Response) => {
  const cookies = (req as Request & { cookies?: Record<string,string> }).cookies ?? {};
  if (cookies['botSession'] && SESSIONS.has(cookies['botSession'])) { res.send(PANEL_HTML); return; }
  res.send(LOGIN_HTML);
});

router.post('/bot/login', (req: Request, res: Response) => {
  const { user, pass } = req.body as { user: string; pass: string };
  if (user === BOT_USER && pass === BOT_PASS) {
    const token = randomUUID();
    SESSIONS.add(token);
    res.cookie('botSession', token, { httpOnly: true, sameSite: 'strict', maxAge: 86_400_000 });
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'credenciais inválidas' });
  }
});

router.post('/bot/logout', (req: Request, res: Response) => {
  const cookies = (req as Request & { cookies?: Record<string,string> }).cookies ?? {};
  const s = cookies['botSession'];
  if (s) SESSIONS.delete(s);
  res.clearCookie('botSession');
  res.json({ success: true });
});

router.post('/bot/add-tokens', checkAuth, async (req: Request, res: Response) => {
  const { raw } = req.body as { raw: string };
  if (!raw) { res.status(400).json({ success: false, message: 'nenhum token fornecido' }); return; }
  const TOKEN_RE = /[A-Za-z0-9_-]{20,30}\.[A-Za-z0-9_-]{4,8}\.[A-Za-z0-9_-]{25,45}/g;
  const parsed = [...new Set(raw.match(TOKEN_RE) ?? [])] as string[];
  if (!parsed.length) { res.status(400).json({ success: false, message: 'nenhum token válido' }); return; }
  const toAdd = parsed.filter(t => !accounts.has(t)).slice(0, 100 - accounts.size);
  const results: Array<{ token: string; success: boolean; tag?: string; message?: string }> = [];
  for (const token of toAdd) {
    try {
      const acc = await validateToken(token);
      accounts.set(token, acc);
      results.push({ token: '...' + token.slice(-8), success: true, tag: acc.tag });
    } catch (e: unknown) {
      results.push({ token: '...' + token.slice(-8), success: false, message: e instanceof Error ? e.message : String(e) });
    }
  }
  const ok = results.filter(r => r.success).length;
  res.json({ success: ok > 0, message: `${ok} de ${toAdd.length} tokens conectados`, results, total: accounts.size });
});

router.post('/bot/remove-token', checkAuth, (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token || !accounts.has(token)) { res.status(400).json({ success: false }); return; }
  accounts.delete(token);
  res.json({ success: true });
});

router.get('/bot/tokens', checkAuth, (_req: Request, res: Response) => {
  const list = [...accounts.entries()].map(([token, acc]) => ({
    tokenKey: token, tag: acc.tag, id: acc.id, username: acc.username, discriminator: acc.discriminator,
  }));
  res.json({ count: accounts.size, max: 100, accounts: list });
});

router.post('/bot/disconnect-all', checkAuth, (_req: Request, res: Response) => {
  firingActive = false; accounts.clear();
  res.json({ success: true });
});

router.get('/bot/channels/stream/:guildInput', checkAuth, async (req: Request, res: Response) => {
  const guildId = parseGuildId(String(req.params['guildInput'] ?? ''));
  if (!guildId) { res.status(400).json({ error: 'id ou url inválido' }); return; }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  if (!sseClients.has(guildId)) sseClients.set(guildId, new Set());
  sseClients.get(guildId)!.add(res);
  const acc = [...accounts.values()][0];
  if (!acc) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'nenhuma conta conectada' })}\n\n`);
  } else {
    try {
      const channels = await fetchGuildChannels(guildId, acc.token);
      const guildInfo = await discordGet(`/guilds/${guildId}`, acc.token).catch(() => ({ name: guildId })) as Record<string,string>;
      res.write(`data: ${JSON.stringify({ type: 'init', channels, guildName: guildInfo['name'] })}\n\n`);
    } catch (e: unknown) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: e instanceof Error ? e.message : String(e) })}\n\n`);
    }
  }
  startChannelPoller(guildId);
  const ka = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) { /* ignore */ } }, 20_000);
  req.on('close', () => { clearInterval(ka); sseClients.get(guildId)?.delete(res); });
});

router.post('/bot/start-fire', checkAuth, async (req: Request, res: Response) => {
  const { channelId, message } = req.body as { channelId: string; message: string };
  if (!channelId || !message) { res.status(400).json({ success: false, message: 'dados incompletos' }); return; }
  if (!accounts.size) { res.status(400).json({ success: false, message: 'nenhuma conta conectada' }); return; }
  if (firingActive) { res.status(400).json({ success: false, message: 'disparo em andamento' }); return; }
  firingActive = true;
  const acc = [...accounts.values()][0]!;
  try {
    await discordPost(`/channels/${channelId}/messages`, acc.token, { content: message });
    firingActive = false;
    res.json({ success: true, message: `mensagem enviada por ${acc.tag}` });
  } catch (e: unknown) {
    firingActive = false;
    res.status(500).json({ success: false, message: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/bot/stop-fire', checkAuth, (_req: Request, res: Response) => {
  firingActive = false; res.json({ success: true });
});

router.post('/bot/forum/start', checkAuth, async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token) { res.status(400).json({ success: false, message: 'token obrigatório' }); return; }
  try { await validateToken(token); } catch (e: unknown) {
    res.status(400).json({ success: false, message: 'token inválido: ' + (e instanceof Error ? e.message : String(e)) }); return;
  }
  forumTokens = [token];
  if (!forumPoller) { forumPoller = setInterval(pollForum, 30_000); await pollForum(); }
  res.json({ success: true, message: 'monitor iniciado', history: forumUsernames });
});

router.post('/bot/forum/stop', checkAuth, (_req: Request, res: Response) => {
  if (forumPoller) { clearInterval(forumPoller); forumPoller = null; }
  forumTokens = [];
  res.json({ success: true });
});

router.get('/bot/forum/history', checkAuth, (_req: Request, res: Response) => {
  res.json({ entries: forumUsernames, active: !!forumPoller });
});

router.get('/bot/forum/stream', checkAuth, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  forumSseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'history', entries: forumUsernames })}\n\n`);
  const ka = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) { /* ignore */ } }, 20_000);
  req.on('close', () => { clearInterval(ka); forumSseClients.delete(res); });
});

export default router;

