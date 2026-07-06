/**
 * Vercel-specific build: bundles api/index.ts → api/vercel-dist/handler.cjs
 * Uses outdir (not outfile) because esbuild-plugin-pino emits multiple files.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(artifactDir, "api/vercel-dist");

await rm(outDir, { recursive: true, force: true });

await esbuild({
  entryPoints: [path.resolve(artifactDir, "api/index.ts")],
  platform: "node",
  bundle: true,
  format: "cjs",
  outdir: outDir,
  outExtension: { ".js": ".cjs" },
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

console.log("✅ Vercel handler built → api/vercel-dist/index.cjs");
