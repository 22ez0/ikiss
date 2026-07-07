import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
}

interface LightningBolt {
  points: { x: number; y: number }[];
  alpha: number;
  width: number;
  color: string;
  born: number;
  lifetime: number;
}

interface ParticleCanvasProps {
  effect: string;
  accentColor?: string;
}

const EFFECTS: Record<string, { colors: string[], count: number }> = {
  snow: { colors: ['#fff', '#ddd', '#eee'], count: 80 },
  stars: { colors: ['#fff', '#ffd700', '#aad4f5'], count: 60 },
  sakura: { colors: ['#ffb7c5', '#ff8fab', '#ffc4d0', '#ffb3c1'], count: 50 },
  fireflies: { colors: ['#aaff80', '#80ff80', '#d4ff80'], count: 40 },
  bubbles: { colors: ['rgba(255,255,255,0.15)', 'rgba(200,200,255,0.2)', 'rgba(255,255,255,0.1)'], count: 35 },
  rain: { colors: ['rgba(210,230,255,0.75)', 'rgba(130,170,255,0.65)', 'rgba(255,255,255,0.55)'], count: 180 },
  raio: { colors: ['#fff', '#a78bfa', '#60a5fa', '#fbbf24', '#e0e0e0'], count: 0 },
};

function generateLightningPoints(startX: number, canvasHeight: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let x = startX;
  let y = 0;
  points.push({ x, y });
  while (y < canvasHeight) {
    const step = 20 + Math.random() * 40;
    y += step;
    x += (Math.random() - 0.5) * 120;
    points.push({ x, y });
    if (Math.random() < 0.3) {
      const branchX = x;
      const branchY = y;
      const branchPoints: { x: number; y: number }[] = [{ x: branchX, y: branchY }];
      let bx = branchX;
      let by = branchY;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
        by += 15 + Math.random() * 25;
        bx += (Math.random() - 0.5) * 80;
        branchPoints.push({ x: bx, y: by });
      }
      points.push(...branchPoints);
    }
  }
  return points;
}

export default function ParticleCanvas({ effect, accentColor }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const boltsRef = useRef<LightningBolt[]>([]);
  const lastBoltRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || effect === 'none' || !EFFECTS[effect]) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cfg = EFFECTS[effect];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (): Particle => {
      const isRain = effect === 'rain';
      const isBubble = effect === 'bubbles';
      const isFirefly = effect === 'fireflies';

      return {
        x: Math.random() * canvas.width,
        y: isRain ? Math.random() * -100 : Math.random() * canvas.height,
        vx: isRain ? -1.5 + Math.random() * 0.8 : isFirefly ? (Math.random() - 0.5) * 0.8 : (Math.random() - 0.5) * 0.4,
        vy: isRain ? 12 + Math.random() * 8 : isBubble ? -(0.3 + Math.random() * 0.5) : 0.5 + Math.random() * 1,
        alpha: 0.7 + Math.random() * 0.3,
        size: isRain ? (12 + Math.random() * 18) : isBubble ? (8 + Math.random() * 20) : isFirefly ? (2 + Math.random() * 3) : (3 + Math.random() * 5),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      };
    };

    if (effect !== 'raio') {
      particlesRef.current = Array.from({ length: cfg.count }, spawn);
    }

    const drawSakura = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      const s = p.size;
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.6, s * 0.4, s * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    const drawBubble = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };

    const drawLightning = (ctx: CanvasRenderingContext2D, bolt: LightningBolt) => {
      if (bolt.points.length < 2) return;
      ctx.save();
      ctx.globalAlpha = bolt.alpha;
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = bolt.width;
      ctx.shadowColor = bolt.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
      for (let i = 1; i < bolt.points.length; i++) {
        ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now();

      if (effect === 'raio') {
        const interval = 800 + Math.random() * 1500;
        if (now - lastBoltRef.current > interval) {
          lastBoltRef.current = now;
          const boltCount = 1 + Math.floor(Math.random() * 2);
          for (let b = 0; b < boltCount; b++) {
            const colors = cfg.colors;
            boltsRef.current.push({
              points: generateLightningPoints(Math.random() * canvas.width, canvas.height),
              alpha: 0.9 + Math.random() * 0.1,
              width: 1 + Math.random() * 2,
              color: colors[Math.floor(Math.random() * colors.length)],
              born: now,
              lifetime: 80 + Math.random() * 120,
            });
          }
        }

        boltsRef.current = boltsRef.current.filter(bolt => {
          const age = now - bolt.born;
          if (age > bolt.lifetime) return false;
          bolt.alpha = (1 - age / bolt.lifetime) * 0.9;
          drawLightning(ctx, bolt);
          return true;
        });

        animRef.current = requestAnimationFrame(animate);
        return;
      }

      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        if (effect === 'fireflies') {
          p.vx += (Math.random() - 0.5) * 0.1;
          p.vy += (Math.random() - 0.5) * 0.1;
          p.vx = Math.max(-1, Math.min(1, p.vx));
          p.vy = Math.max(-1, Math.min(1, p.vy));
          p.alpha = 0.3 + Math.sin(Date.now() * 0.003 + idx) * 0.4;
        }

        if (p.y > canvas.height + 20 || p.x < -20 || p.x > canvas.width + 20) {
          particlesRef.current[idx] = { ...spawn(), y: effect === 'bubbles' ? canvas.height + 20 : -20 };
        }

        if (effect === 'bubbles') {
          drawBubble(ctx, p);
        } else if (effect === 'sakura') {
          drawSakura(ctx, p);
        } else if (effect === 'rain') {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 6, p.y + p.size);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          if (effect === 'fireflies') {
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
          } else if (effect === 'stars') {
            for (let i = 0; i < 5; i++) {
              const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
              const r = i % 2 === 0 ? p.size : p.size * 0.4;
              ctx[i === 0 ? 'moveTo' : 'lineTo'](p.x + r * Math.cos(angle), p.y + r * Math.sin(angle));
            }
            ctx.closePath();
          } else {
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.restore();
        }
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      boltsRef.current = [];
    };
  }, [effect, accentColor]);

  if (effect === 'none' || !EFFECTS[effect]) return null;

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas"
      style={{ opacity: 0.85 }}
    />
  );
}
