// Vercel serverless entry point.
// Imports the Express app (no app.listen here) and re-exports it as the
// default handler — Vercel's Node.js runtime wraps it automatically.
import app from '../src/app';

export default app;
