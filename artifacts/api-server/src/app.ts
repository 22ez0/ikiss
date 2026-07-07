import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import ogRouter from "./routes/og";
import { logger } from "./lib/logger";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || "https://ikiss.me,https://www.ikiss.me")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
);
const socialBots = /(facebookexternalhit|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|pinterestbot|applebot|googlebot|bingbot|duckduckbot|ia_archiver|embedly|quora|outbrain|showyoubot|snippetexpandbot|vkshare|w3c_validator|line-poker|viber)/i;
const blockedUserAgents = /(scrapy|curl|wget|python-requests|httpclient|headless|phantom|selenium|playwright|puppeteer)/i;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: express.Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0] || req.socket.remoteAddress || "unknown").trim();
}

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const max = Number(process.env.RATE_LIMIT_MAX || (isProduction ? 240 : 2_000));
  const key = `${getClientIp(req)}:${req.path.startsWith("/api/auth") ? "auth" : "api"}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
    return;
  }
  next();
}

function botBlock(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isProduction || process.env.ENABLE_BOT_BLOCKING === "false") {
    next();
    return;
  }
  const userAgent = req.get("user-agent") || "";
  if (socialBots.test(userAgent)) {
    next();
    return;
  }
  if (blockedUserAgents.test(userAgent)) {
    res.status(403).json({ error: "Acesso bloqueado." });
    return;
  }
  next();
}

app.set("trust proxy", 1);

// pino-http ESM interop: cast necessário com moduleResolution:bundler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((pinoHttp as any)({
  logger,
  serializers: {
    req(req: { id: unknown; method: string; url?: string }) {
      return {
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      };
    },
    res(res: { statusCode: number }) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
}));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!isProduction || !origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(botBlock);
app.use(rateLimit);
app.use(cookieParser());
app.use(express.json({ limit: "75mb" }));
app.use(express.urlencoded({ extended: true, limit: "75mb" }));

app.use("/api", router);
app.use("/", ogRouter);

const frontendDist = path.resolve(process.cwd(), "artifacts/faren/dist/public");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: "1h", etag: true }));
  app.get("*", (_req, res, next) => {
    const indexPath = path.join(frontendDist, "index.html");
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
  logger.info({ frontendDist }, "Serving frontend static files");
}

export default app;
