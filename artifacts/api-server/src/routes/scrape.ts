/**
 * /api/scrape — Multi-source Indian content scraper
 *
 * Scrapes VegaMovies, FZMovies, HDToday, MKVCinemas, MoviesMod.
 * Uses CF-bypass headers + rotating User-Agents. Resolves cloud links
 * (Hubdrive, V-Cloud, GDFlix) to direct .mp4 / .m3u8 where possible.
 */

import { Router, type IRouter } from "express";
import { fetchHtmlCF } from "../lib/cfScraper";
import { encryptFields, encryptArrayFields } from "../lib/streamCrypto";
import { resolveCloudLink, resolveFirstStream, extractStreamFromHtml, isDirectStream } from "../lib/linkResolver";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

interface ScrapedSource {
  provider: string;
  label: string;
  pageUrl: string;
  directUrl: string | null;
  isStream: boolean;
  quality: string;
}

// ─── Cloud-link patterns shared across scrapers ───────────────────────────────
const CLOUD_PATTERN =
  /href=["'](https?:\/\/(?:hubdrive\.[a-z]+|hubcloud\.[a-z]+|katdrive\.[a-z]+|v-cloud\.[a-z]+|vcloud\.[a-z]+|vcld\.[a-z]+|gdflix\.[a-z]+|gdtot\.[a-z]+|pixeldrain\.com|gofile\.io|fastdl\.[a-z]+|vcloudz\.[a-z]+|vcdn\.[a-z]+|v1link\.[a-z]+)[^"']{0,400})["']/gi;

// ─── VegaMovies scraper ───────────────────────────────────────────────────────
async function scrapeVegaMovies(query: string): Promise<ScrapedSource[]> {
  const base = (process.env.EXPO_PUBLIC_VEGAMOVIES_URL ?? "https://vegamovies.global").replace(/\/$/, "");

  const searchHtml = await fetchHtmlCF(`${base}/?s=${encodeURIComponent(query)}`, {
    referer: base,
    timeoutMs: 12000,
    retries: 3,
  });
  if (!searchHtml) return [];

  // Extract first few article post links
  const postLinks: string[] = [];
  const postRe = /<article[^>]*>[\s\S]{0,600}?<a[^>]+href=["']([^"']+)["'][^>]*>\s*<img/gi;
  let pm: RegExpExecArray | null;
  while ((pm = postRe.exec(searchHtml)) !== null && postLinks.length < 3) {
    postLinks.push(pm[1]);
  }

  // Fallback: h2/h3 entry-title links
  if (postLinks.length === 0) {
    const h2Re = /class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["']/gi;
    while ((pm = h2Re.exec(searchHtml)) !== null && postLinks.length < 3) postLinks.push(pm[1]);
  }

  if (postLinks.length === 0) return [];

  const results: ScrapedSource[] = [];

  for (const postUrl of postLinks.slice(0, 2)) {
    const detailHtml = await fetchHtmlCF(postUrl, { referer: base, timeoutMs: 10000 });
    if (!detailHtml) continue;

    // Extract cloud links
    const cloudLinks = extractLinks(detailHtml, CLOUD_PATTERN);

    // Also check for direct .mp4 links
    const directLinks = extractLinks(detailHtml, /href=["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
    for (const dl of directLinks.slice(0, 2)) {
      results.push({
        provider: "VegaMovies",
        label: guessQuality(dl),
        pageUrl: postUrl,
        directUrl: dl,
        isStream: true,
        quality: guessQuality(dl),
      });
    }

    // Resolve cloud links
    for (const link of cloudLinks.slice(0, 4)) {
      const quality = guessQuality(link + detailHtml.slice(Math.max(0, detailHtml.indexOf(link) - 200), detailHtml.indexOf(link) + 50));
      const resolved = await resolveCloudLink(link, base);
      results.push({
        provider: "VegaMovies",
        label: quality,
        pageUrl: postUrl,
        directUrl: resolved?.url ?? null,
        isStream: resolved?.isStream ?? false,
        quality,
      });
      if (resolved?.isStream) break; // Got a direct stream — enough from this post
    }

    if (results.some(r => r.isStream)) break;
  }

  return results;
}

// ─── FZMovies scraper ─────────────────────────────────────────────────────────
async function scrapeFZMovies(query: string): Promise<ScrapedSource[]> {
  const base = (process.env.EXPO_PUBLIC_FZMOVIES_URL ?? "https://www.fzmovies.net").replace(/\/$/, "");

  const searchHtml = await fetchHtmlCF(
    `${base}/search.php?searchname=${encodeURIComponent(query)}&searchby=moviename`,
    { referer: base, timeoutMs: 10000 },
  );
  if (!searchHtml) return [];

  // Find first movie result
  const postMatch =
    searchHtml.match(/href=["']([^"']+\.html)["'][^>]*>\s*<img/) ||
    searchHtml.match(/href=["']([^"']+movie\.php[^"']*)["']/i);
  if (!postMatch) return [];

  const detailUrl = postMatch[1].startsWith("http") ? postMatch[1] : `${base}/${postMatch[1].replace(/^\//, "")}`;
  const detailHtml = await fetchHtmlCF(detailUrl, { referer: base, timeoutMs: 10000 });
  if (!detailHtml) return [];

  // FZMovies download links
  const dlLinks = extractLinks(detailHtml, /href=["']([^"']+download[^"']*\.php[^"']*)["']/i);

  const results: ScrapedSource[] = [];
  for (const link of dlLinks.slice(0, 4)) {
    const fullLink = link.startsWith("http") ? link : `${base}/${link.replace(/^\//, "")}`;
    const dlHtml = await fetchHtmlCF(fullLink, { referer: base, timeoutMs: 8000 });

    // FZMovies final download page
    const mp4Match =
      dlHtml.match(/href=["'](https?:\/\/[^"']+\.(?:mp4|mkv)[^"']*)["']/i) ||
      dlHtml.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);

    const quality = link.includes("HD") || link.includes("720") ? "720p" : "480p";
    results.push({
      provider: "FZMovies",
      label: quality,
      pageUrl: detailUrl,
      directUrl: mp4Match?.[1] ?? null,
      isStream: Boolean(mp4Match),
      quality,
    });

    if (mp4Match) break; // First direct link found
  }

  return results;
}

// ─── HDToday scraper ──────────────────────────────────────────────────────────
async function scrapeHDToday(query: string): Promise<ScrapedSource[]> {
  const base = "https://hdtodayz.net";

  const searchHtml = await fetchHtmlCF(`${base}/?s=${encodeURIComponent(query)}`, {
    referer: base,
    timeoutMs: 10000,
  });
  if (!searchHtml) return [];

  const postLinks = extractLinks(searchHtml, /href=["'](https?:\/\/hdtodayz\.net\/[^"']+)["'][^>]*>\s*<img/i);
  if (postLinks.length === 0) {
    // Fallback: entry-title
    const fallback = extractLinks(searchHtml, /class=["'][^"']*entry-title[^"']*["'][^>]*>[\s\S]{0,100}<a[^>]+href=["']([^"']+)["']/i);
    postLinks.push(...fallback);
  }

  if (postLinks.length === 0) return [];

  const detailHtml = await fetchHtmlCF(postLinks[0], { referer: base, timeoutMs: 10000 });
  if (!detailHtml) return [];

  // HDToday uses embed players — try extracting direct URL from page scripts
  const direct = extractStreamFromHtml(detailHtml);
  const cloudLinks = extractLinks(detailHtml, CLOUD_PATTERN);

  const results: ScrapedSource[] = [];

  if (direct) {
    results.push({
      provider: "HDToday",
      label: guessQuality(postLinks[0]),
      pageUrl: postLinks[0],
      directUrl: direct,
      isStream: isDirectStream(direct),
      quality: guessQuality(postLinks[0]),
    });
  }

  for (const link of cloudLinks.slice(0, 3)) {
    const resolved = await resolveCloudLink(link, base);
    results.push({
      provider: "HDToday",
      label: guessQuality(link),
      pageUrl: postLinks[0],
      directUrl: resolved?.url ?? null,
      isStream: resolved?.isStream ?? false,
      quality: guessQuality(link),
    });
    if (resolved?.isStream) break;
  }

  return results;
}

// ─── MKVCinemas scraper ───────────────────────────────────────────────────────
async function scrapeMKVCinemas(query: string): Promise<ScrapedSource[]> {
  const base = "https://mkvcinemas.cat";
  const searchHtml = await fetchHtmlCF(`${base}/?s=${encodeURIComponent(query)}`, {
    referer: base,
    timeoutMs: 10000,
  });
  if (!searchHtml) return [];

  const postMatch = searchHtml.match(/class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["']/i);
  if (!postMatch) return [];

  const detailHtml = await fetchHtmlCF(postMatch[1], { referer: base, timeoutMs: 10000 });
  if (!detailHtml) return [];

  const cloudLinks = extractLinks(detailHtml, CLOUD_PATTERN);
  const results: ScrapedSource[] = [];

  for (const link of cloudLinks.slice(0, 3)) {
    const quality = guessQuality(detailHtml.slice(Math.max(0, detailHtml.indexOf(link) - 300), detailHtml.indexOf(link)));
    const resolved = await resolveCloudLink(link, base);
    results.push({
      provider: "MKVCinemas",
      label: quality,
      pageUrl: postMatch[1],
      directUrl: resolved?.url ?? null,
      isStream: resolved?.isStream ?? false,
      quality,
    });
    if (resolved?.isStream) break;
  }

  return results;
}

// ─── MoviesMod scraper ────────────────────────────────────────────────────────
async function scrapeMoviesMod(query: string): Promise<ScrapedSource[]> {
  const base = "https://moviesmod.farm";
  const searchHtml = await fetchHtmlCF(`${base}/?s=${encodeURIComponent(query)}`, {
    referer: base,
    timeoutMs: 10000,
  });
  if (!searchHtml) return [];

  const postMatch = searchHtml.match(/class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["']/i);
  if (!postMatch) return [];

  const detailHtml = await fetchHtmlCF(postMatch[1], { referer: base, timeoutMs: 10000 });
  if (!detailHtml) return [];

  const cloudLinks = extractLinks(detailHtml, CLOUD_PATTERN);
  const results: ScrapedSource[] = [];

  for (const link of cloudLinks.slice(0, 3)) {
    const resolved = await resolveCloudLink(link, base);
    results.push({
      provider: "MoviesMod",
      label: "HD",
      pageUrl: postMatch[1],
      directUrl: resolved?.url ?? null,
      isStream: resolved?.isStream ?? false,
      quality: "1080p",
    });
    if (resolved?.isStream) break;
  }

  return results;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/scrape?title=Pushpa+2&season=1&episode=1
 *
 * Runs all scrapers in parallel. Returns combined results sorted by
 * stream-readiness (direct .mp4/.m3u8 first).
 */
router.get("/scrape", async (req, res) => {
  const { title, season, episode } = req.query as Record<string, string | undefined>;

  if (!title || title.trim().length < 2) {
    res.status(400).json({ error: "title param required (min 2 chars)" });
    return;
  }

  const cleanTitle = title.trim().split(/[(\[]/)[0].trim();
  const searchQuery = season ? `${cleanTitle} Season ${season}` : cleanTitle;
  const t0 = Date.now();

  try {
    const [vega, fz, hdt, mkv, mod] = await Promise.allSettled([
      scrapeVegaMovies(searchQuery),
      scrapeFZMovies(cleanTitle),
      scrapeHDToday(searchQuery),
      scrapeMKVCinemas(searchQuery),
      scrapeMoviesMod(searchQuery),
    ]);

    let sources: ScrapedSource[] = [];
    for (const r of [vega, fz, hdt, mkv, mod]) {
      if (r.status === "fulfilled") sources.push(...r.value);
    }

    // Episode sort
    if (episode) {
      const ep = parseInt(episode, 10);
      const s = season ? parseInt(season, 10) : 1;
      const epTag = `E${String(ep).padStart(2, "0")}`;
      const sTag = `S${String(s).padStart(2, "0")}${epTag}`;
      sources.sort((a, b) => {
        const aHit = a.label.toUpperCase().includes(epTag) || a.pageUrl.toUpperCase().includes(sTag);
        const bHit = b.label.toUpperCase().includes(epTag) || b.pageUrl.toUpperCase().includes(sTag);
        return aHit === bHit ? 0 : aHit ? -1 : 1;
      });
    }

    // Stream-ready first
    sources.sort((a, b) => Number(b.isStream) - Number(a.isStream));

    const uid = (req as any).uid as string;
    // Encrypt directUrl fields (pageUrl is not a stream URL — leave plaintext)
    const securedSources = sources.map((s) => ({
      ...s,
      directUrl: s.directUrl ? encryptFields({ directUrl: s.directUrl }, uid, ["directUrl"]).directUrl : null,
    }));

    res.json({
      sources:     securedSources,
      totalFound:  sources.length,
      streamReady: sources.filter(s => s.isStream && s.directUrl).length,
      durationMs:  Date.now() - t0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Scraping failed" });
  }
});

export default router;
