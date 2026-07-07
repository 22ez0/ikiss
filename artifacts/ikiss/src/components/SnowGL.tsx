import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/* ─── Canvas 2D atmospheric fallback ─────────────────────────────────── */
function runCanvas2D(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  let W = canvas.width, H = canvas.height;

  const COUNT = 400;
  const flakes = Array.from({ length: COUNT }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.3, vy: Math.random() * 0.7 + 0.2,
    r: Math.random() * 2.5 + 0.5,
    op: Math.random() * 0.55 + 0.12,
    ph: Math.random() * Math.PI * 2,
  }));

  const mouse = { x: -9999, y: -9999 };
  const bursts: { x: number; y: number; t: number }[] = [];

  function onMove(e: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) { mouse.x = e.touches[0].clientX - rect.left; mouse.y = e.touches[0].clientY - rect.top; }
    else { mouse.x = (e as MouseEvent).clientX - rect.left; mouse.y = (e as MouseEvent).clientY - rect.top; }
  }
  function onClick(e: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const t = "changedTouches" in e ? (e as TouchEvent).changedTouches[0] : e as MouseEvent;
    bursts.push({ x: t.clientX - rect.left, y: t.clientY - rect.top, t: 0 });
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("click", onClick);
  window.addEventListener("touchend", onClick, { passive: true });

  const MR = Math.min(W, H) * 0.11;
  let tid = 0, time = 0;

  function drawMountainLayer(pts: [number, number][], color: string) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (const [x, y] of pts) ctx.lineTo(x * W, y * H);
    ctx.lineTo(W, H); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }

  function tick() {
    tid = requestAnimationFrame(tick);
    time += 0.016;
    ctx.clearRect(0, 0, W, H);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#050a14");
    skyGrad.addColorStop(1, "#0d1827");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    bursts.forEach(b => b.t += 0.016);
    for (let i = bursts.length - 1; i >= 0; i--) if (bursts[i].t > 0.8) bursts.splice(i, 1);

    drawMountainLayer([[0,0.72],[0.12,0.45],[0.22,0.62],[0.35,0.30],[0.48,0.58],[0.6,0.26],[0.72,0.5],[0.86,0.35],[1,0.58]], "rgba(18,22,36,0.95)");
    drawMountainLayer([[0,0.78],[0.09,0.56],[0.2,0.68],[0.33,0.42],[0.46,0.64],[0.59,0.38],[0.71,0.55],[0.83,0.44],[0.95,0.62],[1,0.72]], "rgba(26,32,50,0.82)");
    drawMountainLayer([[0,0.84],[0.11,0.68],[0.26,0.76],[0.41,0.63],[0.56,0.75],[0.7,0.64],[0.85,0.73],[1,0.77]], "rgba(36,42,62,0.65)");
    drawMountainLayer([[0,0.88],[0.15,0.79],[0.3,0.83],[0.5,0.76],[0.7,0.82],[0.88,0.78],[1,0.83]], "rgba(48,54,76,0.42)");

    const groundGrad = ctx.createLinearGradient(0, H * 0.85, 0, H);
    groundGrad.addColorStop(0, "rgba(200,220,255,0.14)");
    groundGrad.addColorStop(1, "rgba(180,210,255,0.03)");
    ctx.fillStyle = groundGrad; ctx.fillRect(0, H * 0.85, W, H * 0.15);

    for (const f of flakes) {
      f.x += f.vx + Math.sin(time * 0.45 + f.ph) * 0.18; f.y += f.vy;
      if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
      if (f.x < -6) f.x = W + 6; if (f.x > W + 6) f.x = -6;

      const dx = f.x - mouse.x, dy = f.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < MR && d > 0.5) { const p = (MR - d) / MR; f.x += dx / d * p * 3.5; f.y += dy / d * p * 3.5; }
      for (const b of bursts) {
        const bx = f.x - b.x, by = f.y - b.y, bd = Math.hypot(bx, by), BR = W * 0.18;
        if (bd < BR && bd > 0.5) { const p = (BR - bd) / BR * Math.max(0, 1 - b.t / 0.8); f.x += bx / bd * p * 20; f.y += by / bd * p * 20; }
      }
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2.5);
      glow.addColorStop(0, `rgba(220,235,255,${f.op})`);
      glow.addColorStop(1, "rgba(180,210,255,0)");
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = glow; ctx.fill();
    }
  }
  tick();

  function resize() {
    W = canvas.parentElement?.clientWidth ?? window.innerWidth;
    H = canvas.parentElement?.clientHeight ?? window.innerHeight;
    canvas.width = W; canvas.height = H;
  }
  window.addEventListener("resize", resize);

  return () => {
    cancelAnimationFrame(tid);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("click", onClick);
    window.removeEventListener("touchend", onClick);
    window.removeEventListener("resize", resize);
  };
}

/* ─── Procedural mountains ────────────────────────────────────────────── */
function buildProceduralMountains(scene: THREE.Scene) {
  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x0e1520, roughness: 0.95, metalness: 0.0 });
  const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xd0e4ff, roughness: 0.6, metalness: 0.05 });

  const mountains = [
    { x: 0,   z: -14, h: 20, w: 10 },
    { x: -13, z: -10, h: 15, w:  7 },
    { x: 13,  z: -10, h: 14, w:  7 },
    { x: -22, z: -6,  h: 11, w:  5.5 },
    { x: 22,  z: -6,  h: 10, w:  5 },
    { x: -7,  z: -8,  h: 12, w:  5.5 },
    { x: 7,   z: -8,  h: 12, w:  5.5 },
    { x: -30, z: -4,  h:  8, w:  4 },
    { x: 30,  z: -4,  h:  8, w:  4 },
  ];

  for (const m of mountains) {
    const body = new THREE.Mesh(new THREE.ConeGeometry(m.w, m.h, 7, 1), mountainMat);
    body.position.set(m.x, m.h / 2 - 3, m.z);
    body.rotation.y = Math.random() * Math.PI;
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(m.w * 0.38, m.h * 0.38, 7, 1), snowCapMat);
    cap.position.set(m.x, m.h - 3 - m.h * 0.06, m.z);
    cap.rotation.y = body.rotation.y;
    scene.add(cap);
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 50),
    new THREE.MeshStandardMaterial({ color: 0xb8d0f0, roughness: 0.8, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -3;
  ground.receiveShadow = true;
  scene.add(ground);
}

/* ─── WebGL scene ─────────────────────────────────────────────────────── */
function runWebGL(mount: HTMLDivElement, onFail: () => void, onReady: () => void) {
  let W = mount.clientWidth, H = mount.clientHeight;
  const isMobile = W < 768;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: false,
      powerPreference: isMobile ? "low-power" : "high-performance",
    });
  } catch { onFail(); return () => {}; }

  const ctx = renderer.getContext();
  if (!ctx) { renderer.dispose(); onFail(); return () => {}; }

  renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(W, H);
  renderer.setClearColor(0x050a14, 1);
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080d1a, 0.022);
  scene.background = new THREE.Color(0x050a14);

  const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 500);
  camera.position.set(0, 3, 18);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x8bb4d8, 0.6));
  const moon = new THREE.DirectionalLight(0xaac8f0, 1.5);
  moon.position.set(-8, 14, 6);
  if (!isMobile) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 0.5;
    moon.shadow.camera.far = 80;
    moon.shadow.camera.left = -25;
    moon.shadow.camera.right = 25;
    moon.shadow.camera.top = 25;
    moon.shadow.camera.bottom = -25;
  }
  scene.add(moon);
  const rim = new THREE.DirectionalLight(0x334488, 0.5);
  rim.position.set(10, 5, -8);
  scene.add(rim);
  const fill = new THREE.PointLight(0x4466cc, 0.8, 60);
  fill.position.set(0, 8, 10);
  scene.add(fill);

  const proceduralGroup = new THREE.Group();
  scene.add(proceduralGroup);
  buildProceduralMountains(proceduralGroup as unknown as THREE.Scene);

  // Signal ready after first render with procedural mountains
  let readyCalled = false;

  const loader = new GLTFLoader();
  const modelGroup = new THREE.Group();

  function setupModel(gltf: { scene: THREE.Group }) {
    try {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      if (size.length() === 0) return;

      const center = box.getCenter(new THREE.Vector3());
      const camFovRad = (camera.fov * Math.PI) / 180;
      const visibleWidth = 2 * Math.tan(camFovRad / 2) * camera.position.z * camera.aspect;
      const scale = (visibleWidth * 1.35) / Math.max(size.x, 0.01);

      model.scale.setScalar(scale);
      model.position.x = -center.x * scale;
      model.position.y = -center.y * scale - size.y * scale * 0.08;
      model.position.z = -center.z * scale;

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).castShadow = !isMobile;
          (child as THREE.Mesh).receiveShadow = !isMobile;
        }
      });

      modelGroup.add(model);
      scene.add(modelGroup);
      proceduralGroup.visible = false;
    } catch { /* keep procedural */ }
  }

  const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  loader.load(`${BASE}/snow-bg.glb`, setupModel, undefined,
    () => loader.load(`${BASE}/snow-bg2.glb`, setupModel, undefined, () => { /* keep procedural */ })
  );

  /* Snow particles */
  const PCOUNT = isMobile ? 1500 : 4000;
  const pPos = new Float32Array(PCOUNT * 3);
  const pOpa = new Float32Array(PCOUNT);
  const pSiz = new Float32Array(PCOUNT);
  const pVel = new Float32Array(PCOUNT * 2);
  const pPha = new Float32Array(PCOUNT);

  for (let i = 0; i < PCOUNT; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 36;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 12 + 2;
    pVel[i * 2] = (Math.random() - 0.5) * 0.004;
    pVel[i * 2 + 1] = -(Math.random() * 0.018 + 0.005);
    pSiz[i] = Math.random() * 7 + 2;
    pOpa[i] = Math.random() * 0.55 + 0.15;
    pPha[i] = Math.random() * Math.PI * 2;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSiz, 1));
  pGeo.setAttribute("aOpacity", new THREE.BufferAttribute(pOpa, 1));

  const pMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying float vOpa;
      void main() {
        vOpa = aOpacity;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (180.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vOpa;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = smoothstep(1.0, 0.1, d) * vOpa;
        gl_FragColor = vec4(0.88, 0.94, 1.0, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  const camTarget = { x: 0, y: 3 };
  const camCurrent = { x: 0, y: 3 };
  const bursts: { x: number; y: number; t: number }[] = [];

  function onMove(e: MouseEvent | TouchEvent) {
    let cx: number, cy: number;
    if ("touches" in e) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    else { cx = (e as MouseEvent).clientX; cy = (e as MouseEvent).clientY; }
    const rect = mount.getBoundingClientRect();
    const nx = ((cx - rect.left) / rect.width) * 2 - 1;
    const ny = -((cy - rect.top) / rect.height) * 2 + 1;
    camTarget.x = nx * 2.0;
    camTarget.y = 3 + ny * 0.9;
  }
  function onClick(e: MouseEvent | TouchEvent) {
    let cx: number, cy: number;
    if ("changedTouches" in e) { cx = (e as TouchEvent).changedTouches[0].clientX; cy = (e as TouchEvent).changedTouches[0].clientY; }
    else { cx = (e as MouseEvent).clientX; cy = (e as MouseEvent).clientY; }
    const rect = mount.getBoundingClientRect();
    bursts.push({ x: ((cx - rect.left) / rect.width - 0.5) * 36, y: -((cy - rect.top) / rect.height - 0.5) * 22, t: 0 });
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("click", onClick);
  window.addEventListener("touchend", onClick, { passive: true });

  let animId: number, tt = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    tt += 0.016;

    camCurrent.x += (camTarget.x - camCurrent.x) * 0.04;
    camCurrent.y += (camTarget.y - camCurrent.y) * 0.04;
    camera.position.x = camCurrent.x;
    camera.position.y = camCurrent.y;
    camera.lookAt(camCurrent.x * 0.15, 0, 0);

    for (const b of bursts) b.t += 0.016;
    for (let i = bursts.length - 1; i >= 0; i--) if (bursts[i].t > 1.0) bursts.splice(i, 1);

    for (let i = 0; i < PCOUNT; i++) {
      pPos[i * 3] += pVel[i * 2] + Math.sin(tt * 0.3 + pPha[i]) * 0.004;
      pPos[i * 3 + 1] += pVel[i * 2 + 1];
      if (pPos[i * 3 + 1] < -11.5) { pPos[i * 3 + 1] = 11.5; pPos[i * 3] = (Math.random() - 0.5) * 36; }
      if (Math.abs(pPos[i * 3]) > 18.5) pPos[i * 3] *= -1;

      for (const b of bursts) {
        const dx = pPos[i * 3] - b.x, dy = pPos[i * 3 + 1] - b.y;
        const d = Math.hypot(dx, dy), BR = 6.0;
        if (d < BR && d > 0.01) {
          const p = (BR - d) / BR * Math.max(0, 1 - b.t / 0.6);
          pPos[i * 3] += dx / d * p * 0.6; pPos[i * 3 + 1] += dy / d * p * 0.6;
        }
      }
    }
    pGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);

    // Signal ready after first rendered frame
    if (!readyCalled) { readyCalled = true; onReady(); }
  }
  animate();

  const onResize = () => {
    W = mount.clientWidth; H = mount.clientHeight;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("click", onClick);
    window.removeEventListener("touchend", onClick);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
    if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
  };
}

/* ─── React component ─────────────────────────────────────────────────── */
export default function SnowGL() {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cleanup: (() => void) | undefined;

    function startFallback() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.style.display = "block";
      canvas.width = mount!.clientWidth;
      canvas.height = mount!.clientHeight;
      cleanup = runCanvas2D(canvas);
      // Show fallback after first frame
      requestAnimationFrame(() => setVisible(true));
    }

    try {
      const test = document.createElement("canvas");
      const gl = test.getContext("webgl") || test.getContext("experimental-webgl");
      if (!gl) { startFallback(); return; }
      cleanup = runWebGL(mount, startFallback, () => setVisible(true));
    } catch { startFallback(); }

    return () => cleanup?.();
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0"
      style={{
        zIndex: 1,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.8s ease-in",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "none" }} />
    </div>
  );
}
