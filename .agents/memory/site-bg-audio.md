---
name: SiteBackground audio remount
description: Bug de áudio ao navegar de volta de rotas de perfil no SiteBackground
---

# SiteBackground Audio Remount Bug

**Rule:** No efeito que pausa/retoma música ao mudar de rota, sempre setar `audio.muted` explicitamente antes de chamar `play()`.

**Why:** O componente SiteBackground retorna `null` em rotas de perfil, desmontando o `<audio>`. Ao remontar, o elemento começa muted=true. Se apenas chamar `play()` sem setar `muted=false`, a música toca silenciada mesmo após o usuário ter desbloqueado o som.

**How to apply:**
```ts
useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;
  if (isProfilePage) {
    audio.pause();
  } else {
    audio.muted = !musicUnlocked || musicMuted; // re-aplica estado
    if (!musicMuted) audio.play().catch(() => {});
  }
}, [isProfilePage, musicUnlocked, musicMuted]);
```
