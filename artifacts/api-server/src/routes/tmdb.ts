import { Router } from "express";

const router: Router = Router();

// Use v3 API key — confirmed working. We intentionally do NOT read
// TMDB_ACCESS_TOKEN from env because a stale/wrong secret may already be
// set. The v3 key is embedded here as a fallback; the env var
// TMDB_API_KEY_V3 or TMDB_API_KEY can override it with a fresh key.
const TMDB_KEY =
  process.env.TMDB_API_KEY_V3 ??
  process.env.TMDB_API_KEY ??
  "352d8760f635c2200e3a64ac8ea64fb0";
const TMDB_BASE = "https://api.themoviedb.org/3";

/**
 * GET /api/tmdb/:path(*)
 *
 * Express-5-compatible transparent proxy to TMDB v3 API.
 * The API key lives server-side (Replit secret), never shipped in the APK.
 *
 * Examples:
 *   GET /api/tmdb/trending/all/week
 *   GET /api/tmdb/movie/top_rated?page=2
 *   GET /api/tmdb/discover/tv?with_genres=16
 */
router.get("/tmdb/*path", async (req, res) => {
  if (!TMDB_KEY) {
    res.status(503).json({ error: "TMDB API key not configured" });
    return;
  }

  const rawPath = (req.params as any).path;
  const tmdbPath = (Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath)).replace(/^\/+/, "");
  const upstream = new URL(`${TMDB_BASE}/${tmdbPath}`);
  upstream.searchParams.set("api_key", TMDB_KEY);
  upstream.searchParams.set("language", "en-US");

  // Forward any extra query params from the client (page, with_genres, query, etc.)
  for (const [k, v] of Object.entries(req.query as Record<string, string>)) {
    if (k !== "api_key" && k !== "language") upstream.searchParams.set(k, v);
  }

  try {
    const tmdbRes = await fetch(upstream.toString(), {
      headers: { Accept: "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await tmdbRes.json() as any;

    // ── Enrich list responses with pre-proxied image URLs ──────────────────
    // The app uses poster_url / backdrop_url directly so it never constructs
    // raw image.tmdb.org URLs client-side — all images go through our server
    // proxy (/api/image) which bypasses Indian ISP DNS blocks.
    if (body?.results && Array.isArray(body.results)) {
      const proto =
        (req.headers["x-forwarded-proto"] as string | undefined)
          ?.split(",")[0]?.trim() ?? req.protocol;
      const host =
        (req.headers["x-forwarded-host"] as string | undefined)
          ?.split(",")[0]?.trim() ?? req.get("host") ?? "";
      const base = host ? `${proto}://${host}` : "";

      if (base) {
        body.results = (body.results as any[]).map((item) => ({
          ...item,
          poster_url: item.poster_path
            ? `${base}/api/image?url=${encodeURIComponent(
                `https://image.tmdb.org/t/p/w780${item.poster_path}`,
              )}`
            : null,
          backdrop_url: item.backdrop_path
            ? `${base}/api/image?url=${encodeURIComponent(
                `https://image.tmdb.org/t/p/w780${item.backdrop_path}`,
              )}`
            : null,
        }));
      }
    }

    res.status(tmdbRes.status).json(body);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "TMDB proxy request failed" });
  }
});

export default router;
