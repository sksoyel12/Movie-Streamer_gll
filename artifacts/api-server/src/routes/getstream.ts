/**
 * GET /api/get-stream
 *
 * Clean single-call endpoint for the mobile player.
 * Tries scrapers in priority order and returns the first direct
 * .mp4 / .m3u8 URL so the player can use expo-video instead of WebView.
 *
 * Query params:
 *   tmdbId  — TMDB numeric ID (used to look up title if not provided)
 *   title   — Movie/show title (required for scraping)
 *   type    — "movie" (default) | "tv"
 *   season  — season number (TV only)
 *   episode — episode number (TV only)
 *
 * Response:
 *   { url, source, quality, isStream, durationMs }
 *   isStream=true  → feed to expo-video (native player)
 *   isStream=false → WebView embed (url is an embed page)
 */

import { Router, type IRouter } from "express";
import { fetchHtmlCF } from "../lib/cfScraper";
import { encryptUrl } from "../lib/streamCrypto";
import {
  resolveCloudLink,
  extractStreamFromHtml,
  isDirectStream,
} from "../lib/linkResolver";

const router: IRouter = Router();

const CLOUD_PATTERN =
  /href=["'](https?:\/\/(?:hubdrive\.[a-z]+|hubcloud\.[a-z]+|katdrive\.[a-z]+|v-cloud\.[a-z]+|vcloud\.[a-z]+|vcld\.[a-z]+|gdflix\.[a-z]+|gdtot\.[a-z]+|pixeldrain\.com|gofile\.io|fastdl\.[a-z]+|vcloudz\.[a-z]+|vcdn\.[a-z]+|v1link\.[a-z]+)[^"']{0,400})["']/gi;

function extractLinks(html: string, pattern: RegExp): string[] {
  const links: string[] = [];
  const re = new RegExp(pattern.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) links.push(m[1]);
  }
  return [...new Set(links)];
}

function guessQuality(text: string): string {
  if (/2160|4k/i.test(text)) return "4K";
  if (/1080/i.test(text)) return "1080p";
  if (/720/i.test(text)) return "720p";
  if (/480/i.test(text)) return "480p";
  return "HD";
}

// ─── Per-site fast path (returns first stream found) ─────────────────────────

async function tryVegaMovies(query: string): Promise<{ url: string; quality: string } | null> {
  const base = (process.env.EXPO_PUBLIC_VEGAMOVIES_URL ?? "https://vegamovies.global").replace(/\/$/, "");
  const searchHtml = await fetchHtmlCF(`${base}/?s=${encodeURIComponent(query)}`, { referer: base, timeoutMs: 10000 });
  if (!searchHtml) return null;

  // Get first post
  const postRe = /<article[^>]*>[\s\S]{0,600}?<a[^>]+href=["']([^"']+)["'][^>]*>\s*<img/i;
  const h2Re = /class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["']/i;
  const postMatch = searchHtml.match(postRe) ?? searchHtml.match(h2Re);
  if (!postMatch) return null;

  const detailHtml = await fetchHtmlCF(postMatch[1], { referer: base, timeoutMs: 10000 });
  if (!detailHtml) return null;

  // Try direct .mp4 first
  const directMp4 = detailHtml.match(/href=["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
  if (directMp4) return { url: directMp4[1], quality: guessQuality(directMp4[1]) };

  // Try stream from page script
  const fromScript = extractStreamFromHtml(detailHtml);
  if (fromScript && isDirectStream(fromScript)) return { url: fromScript, quality: guessQuality(fromScript) };

  // Resolve cloud links
  const cloudLinks = extractLinks(detailHtml, CLOUD_PATTERN);
  for (const link of cloudLinks.slice(0, 3)) {
    const r = await resolveCloudLink(link, base);
    if (r?.isStream) return { url: r.url, quality: guessQuality(link) };
  }

  return null;
}

async function tryFZMovies(query: string): Promise<{ url: string; quality: string } | null> {
  const base = (process.env.EXPO_PUBLIC_FZMOVIES_URL ?? "https://www.fzmovies.net").replace(/\/$/, "");
  const searchHtml = await fetchHtmlCF(
    `${base}/search.php?searchname=${encodeURIComponent(query)}&searchby=moviename`,
    { referer: base, timeoutMs: 10000 },
  );
  if (!searchHtml) return null;

  const postMatch =
    searchHtml.match(/href=["']([^"']+\.html)["'][^>]*>\s*<img/) ||
    searchHtml.match(/href=["']([^"']+movie\.php[^"']*)["']/i);
  if (!postMatch) return null;

  const detailUrl = postMatch[1].startsWith("http") ? postMatch[1] : `${base}/${postMatch[1].replace(/^\//, "")}`;
  const detailHtml = await fetchHtmlCF(detailUrl, { referer: base, timeoutMs: 10000 });
  if (!detailHtml) return null;

  const dlLinks = extractLinks(detailHtml, /href=["']([^"']+download[^"']*\.php[^"']*)["']/i);

  for (const link of dlLinks.slice(0, 3)) {
    const fullLink = link.startsWith("http") ? link : `${base}/${link.replace(/^\//, "")}`;
    const dlHtml = await fetchHtmlCF(fullLink, { referer: base });
    const mp4 =
      dlHtml.match(/href=["'](https?:\/\/[^"']+\.(?:mp4|mkv)[^"']*)["']/i) ||
      dlHtml.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
    if (mp4) return { url: mp4[1], quality: link.includes("HD") ? "720p" : "480p" };
  }

  return null;
}

async function tryHDToday(query: string): Promise<{ url: string; quality: string } | null> {
  const base = "https://hdtodayz.net";
  const searchHtml = await fetchHtmlCF(`${base}/?s=${encodeURIComponent(query)}`, { referer: base, timeoutMs: 10000 });
  if (!searchHtml) return null;

  const postLinks = extractLinks(searchHtml, /href=["'](https?:\/\/hdtodayz\.net\/[^"']+)["'][^>]*>\s*<img/i);
  if (postLinks.length === 0) return null;

  const detailHtml = await fetchHtmlCF(postLinks[0], { referer: base, timeoutMs: 10000 });
  if (!detailHtml) return null;

  const direct = extractStreamFromHtml(detailHtml);
  if (direct && isDirectStream(direct)) return { url: direct, quality: guessQuality(postLinks[0]) };

  const cloudLinks = extractLinks(detailHtml, CLOUD_PATTERN);
  for (const link of cloudLinks.slice(0, 3)) {
    const r = await resolveCloudLink(link, base);
    if (r?.isStream) return { url: r.url, quality: guessQuality(link) };
  }

  return null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/get-stream", async (req, res) => {
  const {
    tmdbId,
    title,
    type = "movie",
    season,
    episode,
  } = req.query as Record<string, string | undefined>;

  if (!title || title.trim().length < 1) {
    res.status(400).json({ error: "title param required" });
    return;
  }

  const cleanTitle = title.trim().split(/[(\[]/)[0].trim();
  const tvSuffix = season ? ` Season ${season}` : "";
  const searchQuery = `${cleanTitle}${tvSuffix}`;
  const t0 = Date.now();

  try {
    // Race all scrapers — first direct stream wins
    const scrapers: Array<{
      name: string;
      fn: () => Promise<{ url: string; quality: string } | null>;
    }> = [
      { name: "VegaMovies", fn: () => tryVegaMovies(searchQuery) },
      { name: "FZMovies",   fn: () => tryFZMovies(cleanTitle)    },
      { name: "HDToday",    fn: () => tryHDToday(searchQuery)    },
    ];

    // Run all scrapers concurrently, pick first that returns a stream
    const results = await Promise.allSettled(scrapers.map(s => s.fn()));

    const uid = (req as any).uid as string;
    const winnerIdx = results.findIndex(
      (r): r is PromiseFulfilledResult<{ url: string; quality: string }> =>
        r.status === "fulfilled" && r.value !== null,
    );

    if (winnerIdx >= 0) {
      const winner = (results[winnerIdx] as PromiseFulfilledResult<{ url: string; quality: string }>).value;
      res.json({
        url:       encryptUrl(winner.url, uid),
        source:    scrapers[winnerIdx].name,
        quality:   winner.quality,
        isStream:  isDirectStream(winner.url),
        durationMs: Date.now() - t0,
      });
    } else {
      // All scrapers failed — return null so player falls back to embed
      res.json({
        url:       null,
        source:    null,
        quality:   null,
        isStream:  false,
        durationMs: Date.now() - t0,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Scraping failed" });
  }
});

export default router;
