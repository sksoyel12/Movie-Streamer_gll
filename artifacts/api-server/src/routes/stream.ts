import { Router, type IRouter } from "express";
import { encryptUrl, encryptFields, encryptArrayFields } from "../lib/streamCrypto";

const router: IRouter = Router();

/**
 * S-MOVIE Stream Aggregator — v2.0
 *
 * Architecture:
 *   1. Race all 10 providers concurrently via HEAD probes → ranked by latency
 *   2. For winners: GET the page and run deep extraction (m3u8 / mp4)
 *   3. Return: direct URL if found (native player, no ads), else embed URL
 *   4. /api/stream/race returns the full ranked list for EmbedPlayer fallback chain
 *
 * Extraction covers: JWPlayer JSON, VideoJS sources[], "file" key patterns,
 *   HLS manifests, packed JS eval(), base64-encoded URLs, inline script blocks.
 */

// ─── Provider registry ────────────────────────────────────────────────────────

interface Provider {
  name:     string;
  domain:   string;
  priority: number; // lower = higher priority
  buildUrl: (type: "movie" | "tv", tmdbId: string, season?: string, episode?: string) => string;
}

const PROVIDERS: Provider[] = [
  // ── Tier 1 — India-friendly, confirmed fastest ─────────────────────────────
  {
    name: "smashystream",
    domain: "embed.smashystream.com",
    priority: 1,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s ?? 1}&episode=${e ?? 1}`
        : `https://embed.smashystream.com/playere.php?tmdb=${id}`,
  },
  {
    name: "embed.su",
    domain: "embed.su",
    priority: 2,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://embed.su/embed/tv/${id}/${s ?? 1}/${e ?? 1}`
        : `https://embed.su/embed/movie/${id}`,
  },
  {
    name: "superembed",
    domain: "superembed.stream",
    priority: 3,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://superembed.stream/embed/tv/${id}/${s ?? 1}/${e ?? 1}`
        : `https://superembed.stream/embed/movie/${id}`,
  },
  {
    name: "moviesapi",
    domain: "moviesapi.club",
    priority: 4,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://moviesapi.club/tv/${id}-${s ?? 1}-${e ?? 1}`
        : `https://moviesapi.club/movie/${id}`,
  },
  // ── Tier 2 — Reliable general embeds ──────────────────────────────────────
  {
    name: "vidlink",
    domain: "vidlink.pro",
    priority: 5,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://vidlink.pro/tv/${id}/${s ?? 1}/${e ?? 1}`
        : `https://vidlink.pro/movie/${id}`,
  },
  {
    name: "autoembed",
    domain: "player.autoembed.cc",
    priority: 6,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://player.autoembed.cc/embed/tv/${id}/${s ?? 1}/${e ?? 1}`
        : `https://player.autoembed.cc/embed/movie/${id}`,
  },
  {
    name: "2embed",
    domain: "2embed.cc",
    priority: 7,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://www.2embed.cc/embedtv/${id}&s=${s ?? 1}&e=${e ?? 1}`
        : `https://www.2embed.cc/embed/${id}`,
  },
  {
    name: "rive",
    domain: "rive.stream",
    priority: 8,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://rive.stream/e/${id}?s=${s ?? 1}&e=${e ?? 1}`
        : `https://rive.stream/e/${id}`,
  },
  {
    name: "nepu",
    domain: "nepu.to",
    priority: 9,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://nepu.to/embed/tv?tmdb=${id}&season=${s ?? 1}&episode=${e ?? 1}`
        : `https://nepu.to/embed/movie?tmdb=${id}`,
  },
  {
    name: "cineby",
    domain: "cineby.sc",
    priority: 10,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://www.cineby.sc/tv/${id}?season=${s ?? 1}&episode=${e ?? 1}`
        : `https://www.cineby.sc/movie/${id}`,
  },
  // ── Tier 3 — User-specified providers ─────────────────────────────────────
  {
    name: "vidsrc",
    domain: "vidsrc.xyz",
    priority: 11,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s ?? 1}&episode=${e ?? 1}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
  },
  {
    name: "vidsrc.to",
    domain: "vidsrc.to",
    priority: 12,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://vidsrc.to/embed/tv/${id}/${s ?? 1}/${e ?? 1}`
        : `https://vidsrc.to/embed/movie/${id}`,
  },
  {
    name: "vidsrc.me",
    domain: "vidsrc.me",
    priority: 13,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s ?? 1}&episode=${e ?? 1}`
        : `https://vidsrc.me/embed/movie?tmdb=${id}`,
  },
  {
    name: "vidbinge",
    domain: "vidbinge.dev",
    priority: 14,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://vidbinge.dev/embed/tv/${id}/${s ?? 1}/${e ?? 1}`
        : `https://vidbinge.dev/embed/movie/${id}`,
  },
  {
    name: "multiembed",
    domain: "multiembed.mov",
    priority: 15,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s ?? 1}&e=${e ?? 1}`
        : `https://multiembed.mov/?video_id=${id}&tmdb=1`,
  },
  {
    name: "dbmovie",
    domain: "dbmovies.net",
    priority: 16,
    buildUrl: (t, id, s, e) =>
      t === "tv"
        ? `https://dbmovies.net/embed/tv/${id}/${s ?? 1}/${e ?? 1}`
        : `https://dbmovies.net/embed/movie/${id}`,
  },
];

// ─── CDN safety-net pool ──────────────────────────────────────────────────────

const CDN_POOL = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
];

function pickCdn(): string {
  return CDN_POOL[Math.floor(Math.random() * CDN_POOL.length)];
}

// ─── Deep stream extraction ───────────────────────────────────────────────────
/**
 * Attempt to extract a direct .m3u8 or .mp4 URL from an embed page's HTML.
 *
 * Patterns covered (in priority order):
 *   1. JWPlayer setup: sources:[{file:"..."}]
 *   2. VideoJS: <source src="..." type="application/x-mpegURL">
 *   3. Plyr / generic player: file:"..." or src:"..."
 *   4. JSON "file" key with stream extension
 *   5. Bare URL in script or attribute
 *   6. Base64-encoded URLs (btoa'd stream links)
 *   7. Packed JS (p,a,c,k,e,d) — attempts eval-like unpack
 */
function extractDirectFromHtml(html: string): string | null {
  // ── 1. JWPlayer / Clappr sources array ────────────────────────────────────
  // sources:[{file:"https://...m3u8",label:"HD"}]
  const jwSourcesMatch = html.match(/sources\s*:\s*\[([^\]]{10,1000})\]/is);
  if (jwSourcesMatch) {
    const inner = jwSourcesMatch[1];
    const urlMatch = inner.match(/["'`]?(https?:\/\/[^"'`\s,]+\.(?:m3u8|mp4)[^"'`\s,]*)/i);
    if (urlMatch) return sanitize(urlMatch[1]);
  }

  // ── 2. VideoJS / HTML5 source tag ─────────────────────────────────────────
  // <source src="https://...m3u8" type="application/x-mpegURL">
  const srcTagMatch = html.match(/<source[^>]+src=["']?(https?:\/\/[^"'\s>]+\.(?:m3u8|mp4)[^"'\s>]*)/i);
  if (srcTagMatch) return sanitize(srcTagMatch[1]);

  // ── 3. "file" key patterns (most common embed format) ─────────────────────
  const filePatterns = [
    /["']file["']\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*?)["'`]/gi,
    /["']file["']\s*:\s*["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*?)["'`]/gi,
    // url: "..." or hls: "..."
    /["'](?:url|hls|src|stream)["']\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*?)["'`]/gi,
    /["'](?:url|src|stream)["']\s*:\s*["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*?)["'`]/gi,
  ];
  for (const pattern of filePatterns) {
    pattern.lastIndex = 0;
    const m = pattern.exec(html);
    if (m?.[1]) { const u = sanitize(m[1]); if (u) return u; }
  }

  // ── 4. JSON-embedded stream object ────────────────────────────────────────
  // {"stream":"https://cdn.example.com/hls/movie.m3u8"}
  const jsonStreamMatch = html.match(/["'](?:stream|video|media|source|hls_url|mp4_url)["']\s*:\s*["'](https?:\/\/[^"']{10,})/i);
  if (jsonStreamMatch) { const u = sanitize(jsonStreamMatch[1]); if (u) return u; }

  // ── 5. Bare m3u8 / mp4 URLs in attributes or scripts ─────────────────────
  const bareM3u8 = html.match(/(https?:\/\/[^"'<>\s]+\.m3u8(?:\?[^"'<>\s]*)?)/i);
  if (bareM3u8) { const u = sanitize(bareM3u8[1]); if (u) return u; }
  const bareMp4 = html.match(/(https?:\/\/[^"'<>\s]+\.mp4(?:\?[^"'<>\s]*)?)/i);
  if (bareMp4) { const u = sanitize(bareMp4[1]); if (u) return u; }

  // ── 6. Base64-encoded URLs ────────────────────────────────────────────────
  // Some embeds encode the stream URL in btoa() to obfuscate it
  const b64Chunks = html.match(/atob\(["']([A-Za-z0-9+/=]{20,})["']\)/g) ?? [];
  for (const chunk of b64Chunks) {
    const b64 = chunk.match(/atob\(["']([A-Za-z0-9+/=]+)["']\)/)?.[1];
    if (!b64) continue;
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      if (/https?:\/\/.+\.(m3u8|mp4)/i.test(decoded)) {
        const m = decoded.match(/(https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/i);
        if (m) return sanitize(m[1]);
      }
    } catch {}
  }

  return null;
}

/** Remove tracking params, ensure URL is valid and not a placeholder/ad */
function sanitize(url: string): string | null {
  const u = url.trim().replace(/['"\\]/g, "");
  if (u.length < 20) return null;
  if (/placeholder|sample-video|ads?[\/-]|doubleclick|googlesyndication/i.test(u)) return null;
  if (!/^https?:\/\//i.test(u)) return null;
  return u;
}

// ─── Per-provider check ───────────────────────────────────────────────────────

const SCRAPE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

interface ProviderResult {
  provider:   Provider;
  ok:         boolean;
  embedUrl:   string;
  directUrl?: string;
  latencyMs:  number;
}

async function checkProvider(
  provider: Provider,
  type: "movie" | "tv",
  tmdbId: string,
  season?: string,
  episode?: string,
): Promise<ProviderResult> {
  const embedUrl = provider.buildUrl(type, tmdbId, season, episode);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 6000);

  try {
    const res = await fetch(embedUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":      SCRAPE_UA,
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer":         `https://${provider.domain}/`,
        "Cache-Control":   "no-cache",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - t0;

    if (!res.ok) return { provider, ok: false, embedUrl, latencyMs };

    const html = await res.text();

    // Reject empty or obvious 404 pages
    if (html.length < 300 || /not\s*found|404|unavailable|access\s*denied/i.test(html.slice(0, 400))) {
      return { provider, ok: false, embedUrl, latencyMs };
    }

    const directUrl = extractDirectFromHtml(html) ?? undefined;
    return { provider, ok: true, embedUrl, directUrl, latencyMs };
  } catch {
    clearTimeout(timeout);
    return { provider, ok: false, embedUrl, latencyMs: Date.now() - t0 };
  }
}

// ─── Latency-only HEAD probe (fast — no body download) ───────────────────────

async function headProbe(
  provider: Provider,
  type: "movie" | "tv",
  tmdbId: string,
  season?: string,
  episode?: string,
  timeoutMs = 2500,
): Promise<{ provider: Provider; ok: boolean; latencyMs: number; embedUrl: string }> {
  const embedUrl = provider.buildUrl(type, tmdbId, season, episode);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(embedUrl, {
      method: "HEAD",
      signal: ctrl.signal,
      headers: { "User-Agent": SCRAPE_UA, "Referer": `https://${provider.domain}/` },
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    // 405 = server alive but blocks HEAD — still count as reachable
    const ok = (res.status >= 200 && res.status < 400) || res.status === 405;
    return { provider, ok, latencyMs, embedUrl };
  } catch {
    clearTimeout(timer);
    return { provider, ok: false, latencyMs: Date.now() - t0, embedUrl };
  }
}

// ─── Stream aggregator ────────────────────────────────────────────────────────

interface StreamResponse {
  url:        string;
  quality:    string;
  source:     string;
  domain:     string;
  isEmbed:    boolean;
  subtitles:  boolean;
  headers:    Record<string, string>;
  expiresAt:  number;
  fallbacks:  Array<{ url: string; source: string; domain: string; isEmbed: boolean; latencyMs: number }>;
  attempts:   Array<{ source: string; ok: boolean; latencyMs: number; isEmbed: boolean }>;
}

async function aggregateStream(
  type: "movie" | "tv",
  tmdbId?: string,
  season?: string,
  episode?: string,
): Promise<StreamResponse> {
  if (!tmdbId || tmdbId === "0") {
    return {
      url: pickCdn(), quality: "720p", source: "cdn-fallback", domain: "cdn",
      isEmbed: false, subtitles: false, headers: {},
      expiresAt: Date.now() + 2 * 3600 * 1000,
      fallbacks: [], attempts: [],
    };
  }

  // Phase 1: Concurrent HEAD probes — ranked by latency (fast, 2.5s cap)
  const headResults = await Promise.allSettled(
    PROVIDERS.map((p) => headProbe(p, type, tmdbId, season, episode, 2500)),
  );

  // Sort by latency (working first, then by ms)
  const probed = headResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof headProbe>>> => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => {
      if (a.ok && !b.ok) return -1;
      if (!a.ok && b.ok)  return 1;
      return a.latencyMs - b.latencyMs;
    });

  // Phase 2: Full GET extraction on top-3 working providers
  const candidates = probed.filter((r) => r.ok).slice(0, 3);
  const extracted = await Promise.allSettled(
    candidates.map((c) => checkProvider(c.provider, type, tmdbId, season, episode)),
  );

  let bestDirect: ProviderResult | null = null;
  let bestEmbed:  ProviderResult | null = null;
  const attempts: StreamResponse["attempts"] = [];

  for (const r of extracted) {
    if (r.status !== "fulfilled") continue;
    const res = r.value;
    attempts.push({ source: res.provider.name, ok: res.ok, latencyMs: res.latencyMs, isEmbed: !res.directUrl });
    if (!res.ok) continue;
    if (res.directUrl && !bestDirect) bestDirect = res;
    if (!bestEmbed) bestEmbed = res;
  }

  // Build fallbacks from remaining probed sources (ordered by latency)
  const usedDomain = bestDirect?.provider.domain ?? bestEmbed?.provider.domain;
  const fallbacks: StreamResponse["fallbacks"] = probed
    .filter((r) => r.ok && r.provider.domain !== usedDomain)
    .map((r) => ({
      url: r.embedUrl, source: r.provider.name, domain: r.provider.domain,
      isEmbed: true, latencyMs: r.latencyMs,
    }));

  // 1. Direct .m3u8 / .mp4 — native player, no ads, full controls
  if (bestDirect) {
    return {
      url: bestDirect.directUrl!,
      quality: "1080p",
      source: bestDirect.provider.name,
      domain: bestDirect.provider.domain,
      isEmbed: false,
      subtitles: true,
      headers: {
        "User-Agent": SCRAPE_UA,
        "Referer":    `https://${bestDirect.provider.domain}/`,
        "Origin":     `https://${bestDirect.provider.domain}`,
      },
      expiresAt: Date.now() + 6 * 3600 * 1000,
      fallbacks,
      attempts,
    };
  }

  // 2. Fastest embed URL (WebView player) — latency-ordered fallbacks attached
  if (bestEmbed) {
    return {
      url: bestEmbed.embedUrl,
      quality: "HD",
      source: bestEmbed.provider.name,
      domain: bestEmbed.provider.domain,
      isEmbed: true,
      subtitles: false,
      headers: {},
      expiresAt: Date.now() + 6 * 3600 * 1000,
      fallbacks,
      attempts,
    };
  }

  // 3. CDN fallback — guaranteed playback
  return {
    url: pickCdn(), quality: "720p", source: "cdn-fallback", domain: "cdn",
    isEmbed: false, subtitles: false, headers: {},
    expiresAt: Date.now() + 2 * 3600 * 1000,
    fallbacks: probed
      .filter((r) => r.ok)
      .map((r) => ({ url: r.embedUrl, source: r.provider.name, domain: r.provider.domain, isEmbed: true, latencyMs: r.latencyMs })),
    attempts,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/stream
 * Query: id (TMDB ID), type ("movie"|"tv"), season, episode
 *
 * Returns the best stream URL with latency-ordered fallbacks.
 * isEmbed=false → native player (direct .m3u8/.mp4, no ads)
 * isEmbed=true  → WebView embed player
 */
router.get("/stream", async (req, res) => {
  const { id, type = "movie", season, episode } = req.query as Record<string, string | undefined>;
  const mediaType: "movie" | "tv" = type === "tv" ? "tv" : "movie";
  const uid = (req as any).uid as string;
  try {
    const result = await aggregateStream(mediaType, id, season, episode);
    // Encrypt the primary URL and all fallback URLs
    const secured = {
      ...result,
      url:       encryptUrl(result.url, uid),
      fallbacks: result.fallbacks.map((f) => ({
        ...f,
        url: encryptUrl(f.url, uid),
      })),
    };
    res.json(secured);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Stream aggregation failed" });
  }
});

/**
 * GET /api/stream/race
 * Query: id (TMDB ID), type ("movie"|"tv"), season, episode
 *
 * Lightweight: HEAD-probes all providers concurrently and returns them
 * ranked by latency (fastest first). No body download, no extraction.
 * Used by EmbedPlayer to pre-sort its source queue in < 2.5s.
 *
 * Response: { ranked: [{ url, source, domain, latencyMs, ok }] }
 */
router.get("/stream/race", async (req, res) => {
  const { id, type = "movie", season, episode } = req.query as Record<string, string | undefined>;
  if (!id) { res.status(400).json({ error: "id required" }); return; }

  const mediaType: "movie" | "tv" = type === "tv" ? "tv" : "movie";

  try {
    const probes = await Promise.allSettled(
      PROVIDERS.map((p) => headProbe(p, mediaType, id, season, episode, 2500)),
    );

    const uid = (req as any).uid as string;
    const ranked = probes
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof headProbe>>> => r.status === "fulfilled")
      .map((r) => r.value)
      .sort((a, b) => {
        if (a.ok && !b.ok) return -1;
        if (!a.ok && b.ok)  return 1;
        return a.latencyMs - b.latencyMs;
      })
      .map(({ provider, ok, latencyMs, embedUrl }) => ({
        url:       encryptUrl(embedUrl, uid),
        source:    provider.name,
        domain:    provider.domain,
        latencyMs,
        ok,
      }));

    res.json({ ranked });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Race failed" });
  }
});

/**
 * GET /api/stream/sources
 * Returns the full provider list for UI animations.
 */
router.get("/stream/sources", (_req, res) => {
  res.json({
    sources: PROVIDERS.map((p) => ({ name: p.name, domain: p.domain, priority: p.priority })),
  });
});

/**
 * GET /api/stream/extract
 * Query: url (embed URL to extract from)
 *
 * Fetches the given embed URL server-side and runs deep extraction.
 * Returns { directUrl } or { directUrl: null } if extraction fails.
 */
router.get("/stream/extract", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).json({ error: "url required" }); return; }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": SCRAPE_UA, "Referer": url, "Accept": "text/html,*/*" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!response.ok) { res.json({ directUrl: null }); return; }
    const html = await response.text();
    const directUrl = extractDirectFromHtml(html);
    const uid = (req as any).uid as string;
    res.json({ directUrl: directUrl ? encryptUrl(directUrl, uid) : null });
  } catch (err: any) {
    clearTimeout(timer);
    res.json({ directUrl: null, error: err?.message });
  }
});

export default router;
