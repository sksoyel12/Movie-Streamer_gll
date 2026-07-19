/**
 * GET /api/stream/recent
 *
 * Public endpoint — no auth required.
 * Returns a curated list of trending movies + TV shows for the home screen
 * "Trending Now" row. Data is fetched server-side from TMDB so it works even
 * when api.themoviedb.org is DNS-blocked on the user's ISP.
 *
 * Response shape:
 *   { items: TrendingItem[] }
 *
 * TrendingItem:
 *   id          — "tmdb-<number>" (matches the app's movie routing convention)
 *   tmdbId      — raw numeric TMDB ID
 *   title       — movie / show title
 *   mediaType   — "movie" | "tv"
 *   year        — release year (number)
 *   overview    — short synopsis
 *   poster      — { uri: string } | null   (wsrv.nl-proxied TMDB image)
 *   backdrop    — { uri: string } | null
 *   rating      — TMDB vote_average (0–10, one decimal)
 */

import { Router } from "express";

const router = Router();

const TMDB_KEY =
  process.env.TMDB_API_KEY_V3 ??
  process.env.TMDB_API_KEY ??
  "352d8760f635c2200e3a64ac8ea64fb0";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE  = "https://image.tmdb.org/t/p";

// Proxy images through wsrv.nl so they load even when image.tmdb.org is blocked
function imgUri(path: string | null | undefined, size = "w342"): string | null {
  if (!path) return null;
  return `https://wsrv.nl/?url=${encodeURIComponent(`${IMG_BASE}/${size}${path}`)}`;
}

async function tmdbGet(path: string, extra: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${TMDB_BASE}/${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`TMDB ${path} → HTTP ${res.status}`);
  return res.json();
}

function normalise(raw: any, forcedType?: "movie" | "tv") {
  const mediaType: "movie" | "tv" =
    forcedType ?? (raw.media_type === "tv" || raw.first_air_date ? "tv" : "movie");
  const title: string = raw.title ?? raw.name ?? "Untitled";
  const releaseDate: string = raw.release_date ?? raw.first_air_date ?? "2024-01-01";
  const year = parseInt(releaseDate.slice(0, 4), 10) || 2024;

  return {
    id:        `tmdb-${raw.id}`,
    tmdbId:    raw.id as number,
    title,
    mediaType,
    year,
    overview:  raw.overview ?? "",
    poster:    imgUri(raw.poster_path, "w342"),
    backdrop:  imgUri(raw.backdrop_path, "w780"),
    rating:    Math.round((raw.vote_average ?? 0) * 10) / 10,
  };
}

// Cache results for 3 hours so repeated opens don't hammer TMDB
let _cache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

router.get("/stream/recent", async (_req, res) => {
  // Serve from cache if still fresh
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    res.json(_cache.data);
    return;
  }

  try {
    // Fetch three lists in parallel: weekly trending (all), popular movies, popular TV
    const [trendingRes, moviesRes, tvRes] = await Promise.allSettled([
      tmdbGet("trending/all/week"),
      tmdbGet("movie/popular", { page: "1" }),
      tmdbGet("tv/popular",    { page: "1" }),
    ]);

    const seen = new Set<number>();
    const items: ReturnType<typeof normalise>[] = [];

    const addFrom = (result: PromiseSettledResult<any>, forcedType?: "movie" | "tv") => {
      if (result.status !== "fulfilled") return;
      const results: any[] = result.value?.results ?? [];
      for (const r of results) {
        if (!r.id || seen.has(r.id)) continue;
        // Skip entries with no images — they'd render as blank boxes
        if (!r.poster_path && !r.backdrop_path) continue;
        seen.add(r.id);
        items.push(normalise(r, forcedType));
        if (items.length >= 30) return;
      }
    };

    addFrom(trendingRes);
    addFrom(moviesRes, "movie");
    addFrom(tvRes, "tv");

    const response = { items, fetchedAt: new Date().toISOString() };
    _cache = { data: response, ts: Date.now() };
    res.json(response);
  } catch (err: any) {
    // If TMDB is completely unreachable, return an empty list rather than 500
    // so the app shows a graceful empty state rather than crashing.
    res.status(200).json({ items: [], error: err?.message ?? "upstream unavailable" });
  }
});

export default router;
