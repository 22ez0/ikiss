import { useEffect, useCallback, useRef } from "react";

const EFFECTS: Record<string, string[]> = {
  hearts: ['❤️', '🧡', '💜', '💙', '💗', '💖'],
  stars: ['⭐', '✨', '💫', '🌟', '⚡'],
  sparkles: ['✦', '✧', '✶', '✷', '✸', '✹'],
  explosions: ['💥', '🔥', '⚡', '💢', '🌪️'],
};

interface ClickEffectProps {
  effect: string;
}

export default function ClickEffect({ effect }: ClickEffectProps) {
  const chars = EFFECTS[effect];
  const lastTouchRef = useRef(0);

  const spawnParticles = useCallback((x: number, y: number) => {
    if (!chars) return;

    const count = effect === 'explosions' ? 5 : 4 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const dist = 40 + Math.random() * 60;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 50;
      const duration = 500 + Math.random() * 400;

      const particle = document.createElement('div');
      particle.className = 'click-particle';
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.textContent = chars[Math.floor(Math.random() * chars.length)];

      if (effect === 'sparkles') {
        particle.style.color = `hsl(${Math.random() * 60 + 200}, 80%, 75%)`;
        particle.style.fontSize = '18px';
      }

      document.body.appendChild(particle);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          particle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          particle.style.opacity = '0';
          particle.style.transitionDuration = `${duration}ms`;
        });
      });

      setTimeout(() => particle.remove(), duration + 100);
    }
  }, [chars, effect]);

  const handleClick = useCallback((e: MouseEvent) => {
    if (Date.now() - lastTouchRef.current < 450) return;
    spawnParticles(e.clientX, e.clientY);
  }, [spawnParticles]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    lastTouchRef.current = Date.now();
    spawnParticles(touch.clientX, touch.clientY);
  }, [spawnParticles]);

  useEffect(() => {
    if (!chars) return;
    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [chars, handleClick, handleTouchStart]);

  return null;
}
