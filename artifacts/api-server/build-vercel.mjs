/**
 * Vercel-specific build: bundles api/index.ts → <root>/api/index.js (CJS)
 *
 * Outputs to the ROOT api/ directory (where package.json has no "type":"module"),
 * so Node.js treats the .js file as CommonJS — which Vercel supports natively.
 *
 * Run from repo root: node artifacts/api-server/build-vercel.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, mkdir } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
// Output goes to <repo-root>/api/ so it sits under the root package.json
// (no "type":"module"), making .js files be treated as CJS by Node / Vercel.
const repoRoot = path.resolve(artifactDir, "../..");
const outDir = path.resolve(repoRoot, "api");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await esbuild({
  entryPoints: [path.resolve(artifactDir, "api/index.ts")],
  platform: "node",
  bundle: true,
  format: "cjs",
  outdir: outDir,
  logLevel: "info",
  external: [
    "*.node",
    "sharp", "better-sqlite3", "sqlite3", "canvas",
    "bcrypt", "argon2", "fsevents", "re2", "farmhash",
    "xxhash-addon", "bufferutil", "utf-8-validate",
    "pg-native", "oracledb", "mongodb-client-encryption",
    "lightningcss", "isolated-vm",
  ],
  plugins: [
    esbuildPluginPino({ transports: ["pino-pretty"] }),
  ],
}).catch((err) => {
  console.error("Vercel build failed:", err);
  process.exit(1);
});

console.log("✅ Vercel handler built → api/index.js (CJS, root level)");
