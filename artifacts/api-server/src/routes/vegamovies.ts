/**
 * /api/vegamovies — VegaMovies scraper
 *
 * Uses WordPress REST API to search, then axios + cheerio to parse
 * the post page for nexdrive.fit / cloud links, resolves to direct .mp4/.m3u8.
 *
 * Query params:
 *   title   — movie / show title (required)
 *   season  — season number (TV only)
 *   episode — episode number (TV only)
 *
 * Response:
 *   { url, quality, source, isStream, durationMs }
 */

import { Router, type IRouter } from "express";
import axios, { type AxiosRequestConfig } from "axios";
import { encryptUrl } from "../lib/streamCrypto";
import * as cheerio from "cheerio";
import { resolveCloudLink, isDirectStream, extractStreamFromHtml } from "../lib/linkResolver";

const router: IRouter = Router();

const BASE = (process.env.EXPO_PUBLIC_VEGAMOVIES_URL ?? "https://vegamovies.navy").replace(/\/$/, "");

// ─── Rotating User-Agents ─────────────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.53 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.40 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
];

function pickUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─── Cookie jar ───────────────────────────────────────────────────────────────
const cookieJar = new Map<string, Map<string, string>>();

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function getJarCookies(domain: string): string {
  const jar = cookieJar.get(domain);
  if (!jar || jar.size === 0) return "";
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeResponseCookies(url: string, setCookie: string | string[] | undefined): void {
  if (!setCookie) return;
  const domain = getDomain(url);
  if (!cookieJar.has(domain)) cookieJar.set(domain, new Map());
  const jar = cookieJar.get(domain)!;
  const raw = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of raw) {
    const main = c.split(";")[0].trim();
    const eq = main.indexOf("=");
    if (eq > 0) jar.set(main.slice(0, eq).trim(), main.slice(eq + 1).trim());
  }
}

// ─── Axios fetch with Chrome headers ─────────────────────────────────────────

async function get(url: string, referer?: string, retries = 3): Promise<string> {
  const domain = getDomain(url);
  const cookies = getJarCookies(domain);

  for (let attempt = 0; attempt < retries; attempt++) {
    const ua = pickUA();
    const isMobile = ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone");

    const config: AxiosRequestConfig = {
      timeout: 12000,
      maxRedirects: 10,
      responseType: "text",
      validateStatus: (s) => s < 500,
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": referer ? "cross-site" : "none",
        "Sec-Fetch-User": "?1",
        "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-CH-UA-Mobile": isMobile ? "?1" : "?0",
        "Sec-CH-UA-Platform": isMobile ? '"Android"' : '"Windows"',
        "Cache-Control": "no-cache",
        ...(referer ? { "Referer": referer } : {}),
        ...(cookies ? { "Cookie": cookies } : {}),
      },
    };

    try {
      const res = await axios.get(url, config);
      storeResponseCookies(url, res.headers["set-cookie"] as string | string[] | undefined);

      if (res.status === 403 || res.status === 429 || res.status === 503) {
        if (attempt < retries - 1) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        return "";
      }

      return typeof res.data === "string" ? res.data : "";
    } catch {
      if (attempt < retries - 1) await sleep(600 * (attempt + 1));
    }
  }
  return "";
}

async function getJsonRest(url: string): Promise<any> {
  const domain = getDomain(url);
  const cookies = getJarCookies(domain);
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (s) => s < 500,
      headers: {
        "User-Agent": pickUA(),
        "Accept": "application/json, */*;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
        ...(cookies ? { "Cookie": cookies } : {}),
      },
    });
    storeResponseCookies(url, res.headers["set-cookie"] as string | string[] | undefined);
    if (res.status >= 400) return null;
    return res.data ?? null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Quality helpers ──────────────────────────────────────────────────────────

function guessQuality(text: string): string {
  const t = (text ?? "").toLowerCase();
  if (/4k|2160/.test(t)) return "4K";
  if (/1080/.test(t)) return "1080p";
  if (/720/.test(t)) return "720p";
  if (/480/.test(t)) return "480p";
  return "HD";
}

function qualityScore(text: string): number {
  const t = (text ?? "").toLowerCase();
  if (/2160|4k/.test(t)) return 5;
  if (/1080/.test(t)) return 4;
  if (/720/.test(t)) return 3;
  if (/480/.test(t)) return 2;
  return 1;
}

// ─── Cloud-link host patterns (includes nexdrive.fit intermediary) ────────────
const CLOUD_HOSTS_RE = /(?:nexdrive|hubdrive|hubcloud|katdrive|v-cloud|vcloud|vcld|vcloudz|vcdn|v1link|gdflix|gdtot|pixeldrain|gofile|fastdl|dropgalaxy|buzzheavier|krakenfiles|send\.cm)/i;

// ─── Step 1: Search VegaMovies via WordPress REST API ────────────────────────
// Much more reliable than scraping the AJAX-powered search page.

async function searchVegaMovies(query: string): Promise<string[]> {
  const restUrl = `${BASE}/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&per_page=5&_fields=link,title,slug`;
  const posts = await getJsonRest(restUrl) as Array<{ link: string; title: { rendered: string } }> | null;

  if (Array.isArray(posts) && posts.length > 0) {
    return posts.map((p) => p.link).filter(Boolean);
  }

  // Fallback: standard WordPress search (follows redirect from /?s= to /search.html?q=)
  const searchUrl = `${BASE}/?s=${encodeURIComponent(query)}`;
  const html = await get(searchUrl, BASE);
  if (!html) return [];

  const $ = cheerio.load(html);
  const postUrls: string[] = [];

  $("article").each((_, el) => {
    const href = $(el).find("a[href]").first().attr("href");
    if (href && href.startsWith("http") && !postUrls.includes(href)) {
      postUrls.push(href);
    }
  });

  if (postUrls.length === 0) {
    $(".entry-title a, .post-title a, h2.title a, h3.title a, .card-title a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("http") && !postUrls.includes(href)) postUrls.push(href);
    });
  }

  return postUrls.slice(0, 5);
}

// ─── Step 2: Parse post page for cloud-hosting links ─────────────────────────

interface DownloadCandidate {
  href: string;
  label: string;
  score: number;
}

async function parsePostPage(postUrl: string): Promise<DownloadCandidate[]> {
  const html = await get(postUrl, BASE);
  if (!html) return [];

  const $ = cheerio.load(html);
  const candidates: DownloadCandidate[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim() ?? "";
    const text = $(el).text().trim();
    const parent = $(el).parent().text().trim();
    const context = `${text} ${parent}`.toLowerCase();

    if (!href || seen.has(href)) return;

    // Direct .mp4/.m3u8 — best case
    if (/\.mp4|\.m3u8|\.mkv/i.test(href)) {
      seen.add(href);
      candidates.push({ href, label: text || "Direct", score: qualityScore(context) + 20 });
      return;
    }

    // nexdrive.fit links (primary on VegaMovies posts)
    if (href.includes("nexdrive.fit") || href.includes("nexdrive.cv")) {
      seen.add(href);
      candidates.push({ href, label: text || guessQuality(href), score: qualityScore(context) + 10 });
      return;
    }

    // Any other cloud hosting link
    if (CLOUD_HOSTS_RE.test(href) && href.startsWith("http")) {
      seen.add(href);
      candidates.push({ href, label: text || guessQuality(href), score: qualityScore(context) });
      return;
    }

    // VegaMovies internal /go/ redirect to cloud
    if (href.includes("/go/") && href.startsWith("http")) {
      seen.add(href);
      candidates.push({ href, label: text || "Download", score: qualityScore(context) });
    }
  });

  // Prefer 1080p > 720p > 4K > 480p > untagged
  candidates.sort((a, b) => {
    const aDirect = /\.mp4|\.m3u8/i.test(a.href) ? 100 : 0;
    const bDirect = /\.mp4|\.m3u8/i.test(b.href) ? 100 : 0;
    return (bDirect + b.score) - (aDirect + a.score);
  });

  return candidates;
}

// ─── Step 3: Resolve nexdrive.fit → inner cloud link → direct stream ──────────

async function resolveNexdrive(url: string): Promise<string | null> {
  const html = await get(url, BASE);
  if (!html) return null;

  // Extract any direct stream immediately
  const direct = extractStreamFromHtml(html);
  if (direct) return direct;

  // Collect cloud links from the nexdrive page
  const $ = cheerio.load(html);
  const cloudLinks: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim() ?? "";
    if (!href.startsWith("http")) return;
    const host = getDomain(href);
    if (host.includes("nexdrive")) return; // skip self
    if (CLOUD_HOSTS_RE.test(href) || /vcloud|fastdl|gdtot|dropgalaxy|buzzheavier/i.test(href)) {
      cloudLinks.push(href);
    }
  });

  // Try each inner link (V-Cloud, FastDL, GDTot, etc.)
  for (const inner of cloudLinks.slice(0, 4)) {
    const r = await resolveCloudLink(inner, url);
    if (r?.isStream) return r.url;
    // Accept even if not confirmed stream — player will attempt
    if (r?.url && r.url !== inner) return r.url;
  }

  // Return first cloud link as last resort
  return cloudLinks[0] ?? null;
}

// ─── Main scraper function ────────────────────────────────────────────────────

async function scrapeVegaMovies(
  title: string,
  season?: number,
  episode?: number,
): Promise<{ url: string; quality: string } | null> {
  const searchQuery = season ? `${title} Season ${season}` : title;

  const postUrls = await searchVegaMovies(searchQuery);

  if (postUrls.length === 0 && season) {
    const plain = await searchVegaMovies(title);
    postUrls.push(...plain);
  }

  if (postUrls.length === 0) return null;

  for (const postUrl of postUrls.slice(0, 3)) {
    const candidates = await parsePostPage(postUrl);
    if (candidates.length === 0) continue;

    for (const candidate of candidates.slice(0, 8)) {
      const href = candidate.href;

      // Direct stream — return immediately
      if (isDirectStream(href)) {
        return { url: href, quality: guessQuality(candidate.label) };
      }

      // nexdrive.fit — resolve through inner chain
      if (href.includes("nexdrive")) {
        const resolved = await resolveNexdrive(href);
        if (resolved) {
          const q = guessQuality(candidate.label);
          return { url: resolved, quality: q };
        }
        continue;
      }

      // Other cloud link — use standard resolver
      const resolved = await resolveCloudLink(href, postUrl);
      if (resolved?.isStream) {
        return { url: resolved.url, quality: guessQuality(candidate.label) };
      }
      if (resolved?.url && resolved.url !== href) {
        if (/\.mp4|\.m3u8|\.mkv/i.test(resolved.url)) {
          return { url: resolved.url, quality: guessQuality(candidate.label) };
        }
      }
    }
  }

  return null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/vegamovies", async (req, res) => {
  const { title, season, episode } = req.query as Record<string, string | undefined>;

  if (!title || title.trim().length < 1) {
    res.status(400).json({ error: "title param required" });
    return;
  }

  const cleanTitle = title.trim().split(/[(\[]/)[0].trim();
  const t0 = Date.now();

  try {
    const result = await scrapeVegaMovies(
      cleanTitle,
      season ? parseInt(season, 10) : undefined,
      episode ? parseInt(episode, 10) : undefined,
    );

    const uid = (req as any).uid as string;
    if (result) {
      res.json({
        url:       encryptUrl(result.url, uid),
        quality:   result.quality,
        source:    "VegaMovies",
        isStream:  true,
        durationMs: Date.now() - t0,
      });
    } else {
      res.json({
        url:       null,
        quality:   null,
        source:    null,
        isStream:  false,
        durationMs: Date.now() - t0,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "VegaMovies scrape failed" });
  }
});

export default router;
