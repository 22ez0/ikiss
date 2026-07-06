// Vercel serverless entry point.
// Vercel's @vercel/node runtime compiles this TypeScript file using ncc,
// which bundles all imports (including pnpm workspace packages via symlinks).
import app from '../artifacts/api-server/src/app';

export default app;
