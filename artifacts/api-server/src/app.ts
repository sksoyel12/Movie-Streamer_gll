import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalLimiter } from "./middleware/rateLimit";

// ─── Allowed origins (CORS whitelist) ────────────────────────────────────────
// Native mobile apps send no Origin header — they are allowed through.
// Browser-based requests must come from an authorised domain.

const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);

const ALLOWED_ORIGIN_RE = [
  /^https?:\/\/localhost(:\d+)?$/,                   // local dev
  /^https?:\/\/.*\.replit\.dev(:\d+)?$/,             // Replit preview
  /^https?:\/\/.*\.replit\.app(:\d+)?$/,             // Replit deployments
  /^https?:\/\/.*\.pike\.replit\.dev(:\d+)?$/,       // Replit preview (pike tier)
  /^https?:\/\/.*\.spock\.replit\.dev(:\d+)?$/,      // Replit preview (spock tier)
  ...EXTRA_ORIGINS.map((o) => new RegExp(`^${o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)),
];

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Native app — no Origin header
  return ALLOWED_ORIGIN_RE.some((re) => re.test(origin));
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (originAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, "CORS: blocked origin");
      callback(new Error("CORS: origin not allowed"));
    }
  },
  methods:          ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders:   [
    "Content-Type",
    "Authorization",
    "X-S-Movie-Client",   // anti-bot app identity header
    "X-S-Movie-Device",   // device fingerprint header
    "X-S-Movie-Ts",       // request timestamp (anti-replay)
    "X-S-Movie-Sig",      // HMAC request signature
    "X-Request-ID",
  ],
  exposedHeaders:   ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  credentials:      true,
  maxAge:           600,  // preflight cache: 10 min
};

// ─── App setup ────────────────────────────────────────────────────────────────

const app: Express = express();

// Trust the Replit reverse proxy so req.ip reflects the real client IP
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id:     req.id,
          method: req.method,
          url:    req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// CORS — must come before routes
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // Handle pre-flight (Express 5 requires RegExp or named wildcard)

// ─── Security response headers ────────────────────────────────────────────────
// Applied to every response — stops MIME sniffing, clickjacking, info leakage.
app.use((_req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME-type sniffing (stops content-type confusion attacks)
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Block this API from being embedded in an iframe
  res.setHeader("X-Frame-Options", "DENY");
  // Tell crawlers/bots not to index any API responses
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  // Don't leak referrer info to scrapers
  res.setHeader("Referrer-Policy", "no-referrer");
  // Minimal content security policy for an API (no browser content expected)
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  // Remove the default Express "powered by" header (info leakage)
  res.removeHeader("X-Powered-By");
  // Prevent DNS prefetching that could expose API structure
  res.setHeader("X-DNS-Prefetch-Control", "off");
  next();
});

// Body parsing
app.use(express.json({ limit: "100kb" }));   // cap body size — prevent large-payload DoS
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// General rate limiting (applied to all routes; stream routes have a tighter limiter)
app.use(generalLimiter);

// Routes
app.use("/api", router);

// ─── CORS error handler ───────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message.startsWith("CORS:")) {
    res.status(403).json({ error: err.message, code: "CORS_BLOCKED" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
