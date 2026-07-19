import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ALLOWED_HOSTNAME = "image.tmdb.org";
const CACHE_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * GET /image?url=ENCODED_TMDB_URL
 *
 * Server-side image proxy for TMDB posters/backdrops.
 * Fetches images from image.tmdb.org on the server side so client devices
 * behind ISP DNS blocks (Indian ISPs, etc.) can load them via this relay.
 *
 * Only image.tmdb.org URLs are allowed (security allowlist).
 */
router.get("/image", async (req, res) => {
  const rawUrl = typeof req.query.url === "string" ? req.query.url : null;

  if (!rawUrl) {
    res.status(400).json({ error: "url query parameter required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (parsed.hostname !== ALLOWED_HOSTNAME) {
    res.status(403).json({ error: "URL not allowed — only image.tmdb.org is permitted" });
    return;
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: { "User-Agent": "S-Movie-Proxy/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`);
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!upstream.body) {
      res.status(502).end();
      return;
    }

    const reader = (upstream.body as any).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch {
    res.status(502).end();
  }
});

export default router;
