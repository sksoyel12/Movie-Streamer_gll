/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *     Ask the project owner for this code before editing.
 *
 * Decoy / Honeypot Response Generator
 *
 * Produces fake but completely realistic-looking stream API responses.
 * Used by the honeypot middleware to fool scrapers into thinking they
 * received valid data — the URLs are encrypted-looking blobs that decrypt
 * to broken links, wasting attacker effort.
 *
 * Scrapers see:
 *   - Correct HTTP 200 status
 *   - Correct Content-Type: application/json
 *   - Correct response shape (same fields, same types)
 *   - AES-GCM-looking encrypted URL blobs (indistinguishable from real ones)
 *
 * All "encrypted" URLs are fake: encrypted with a random key that is
 * immediately discarded. No decryption key is ever issued for them.
 */

import { createCipheriv, randomBytes } from "crypto";

// ─── Fake provider pool ───────────────────────────────────────────────────────

const DECOY_PROVIDERS = [
  { name: "smashystream",  domain: "embed.smashystream.com",  priority: 1 },
  { name: "embed.su",      domain: "embed.su",                priority: 2 },
  { name: "superembed",    domain: "superembed.stream",       priority: 3 },
  { name: "vidlink",       domain: "vidlink.pro",             priority: 5 },
  { name: "2embed",        domain: "2embed.cc",               priority: 7 },
  { name: "rive",          domain: "rive.stream",             priority: 8 },
  { name: "vidsrc",        domain: "vidsrc.xyz",              priority: 11 },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function randBase36(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

// ─── Fake AES-GCM ciphertext (indistinguishable from real) ───────────────────

/**
 * Produces an encrypted blob using a random, immediately-discarded key.
 * Output format matches real encryptUrl output:
 *   "<12-byte-iv-hex>:<ciphertext+gcm-tag-base64>"
 *
 * The blob cannot be decrypted without the random key, which is never stored.
 */
function fakeEncryptedUrl(fakeUrl: string): string {
  const key = randomBytes(32); // random, discarded
  const iv  = randomBytes(12);

  const cipher    = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(fakeUrl, "utf8"), cipher.final()]);
  const tag       = cipher.getAuthTag();

  return `${iv.toString("hex")}:${Buffer.concat([encrypted, tag]).toString("base64")}`;
}

// ─── Decoy URL builders ───────────────────────────────────────────────────────

function makeFakeEmbedUrl(provider: typeof DECOY_PROVIDERS[0]): string {
  // Looks exactly like a real embed URL but the session/id segment is garbage
  const fakeId  = Math.floor(Math.random() * 900000) + 100000;
  const token   = randBase36(12);

  switch (provider.domain) {
    case "embed.smashystream.com":
      return `https://embed.smashystream.com/playere.php?tmdb=${fakeId}&session=${token}`;
    case "embed.su":
      return `https://embed.su/embed/movie/${fakeId}?t=${token}`;
    case "superembed.stream":
      return `https://superembed.stream/embed/movie/${fakeId}?token=${token}`;
    default:
      return `https://${provider.domain}/embed/movie/${fakeId}?s=${token}`;
  }
}

// ─── Public generators ────────────────────────────────────────────────────────

/**
 * Fake /api/stream response — identical shape to the real aggregateStream result.
 */
export function decoyStreamResponse(): Record<string, unknown> {
  const primary = pick(DECOY_PROVIDERS);
  const others  = DECOY_PROVIDERS.filter((p) => p.name !== primary.name);

  return {
    url:       fakeEncryptedUrl(makeFakeEmbedUrl(primary)),
    quality:   pick(["1080p", "HD", "720p"]),
    source:    primary.name,
    domain:    primary.domain,
    isEmbed:   true,
    subtitles: false,
    headers:   {},
    expiresAt: Date.now() + 6 * 3600 * 1000,
    fallbacks: others.slice(0, 4).map((p) => ({
      url:       fakeEncryptedUrl(makeFakeEmbedUrl(p)),
      source:    p.name,
      domain:    p.domain,
      isEmbed:   true,
      latencyMs: Math.floor(Math.random() * 800) + 80,
    })),
    attempts: DECOY_PROVIDERS.slice(0, 3).map((p) => ({
      source:    p.name,
      ok:        true,
      latencyMs: Math.floor(Math.random() * 600) + 60,
      isEmbed:   true,
    })),
  };
}

/**
 * Fake /api/stream/race response — ranked provider list.
 */
export function decoyRaceResponse(): Record<string, unknown> {
  const ranked = DECOY_PROVIDERS.map((p) => ({
    url:       fakeEncryptedUrl(makeFakeEmbedUrl(p)),
    source:    p.name,
    domain:    p.domain,
    latencyMs: Math.floor(Math.random() * 700) + 50,
    ok:        true,
  })).sort((a, b) => a.latencyMs - b.latencyMs);

  return { ranked };
}

/**
 * Fake /api/scrape, /api/get-stream, /api/vegamovies response.
 */
export function decoyScraperResponse(): Record<string, unknown> {
  return {
    url:       fakeEncryptedUrl(`https://cdn${randHex(2)}.vstream.org/hls/${randHex(8)}/index.m3u8`),
    source:    pick(["VegaMovies", "FZMovies", "HDToday"]),
    quality:   pick(["1080p", "720p", "HD"]),
    isStream:  true,
    durationMs: Math.floor(Math.random() * 8000) + 2000,
  };
}

/**
 * Fake /api/scrape multi-source response.
 */
export function decoyScrapeMultiResponse(): Record<string, unknown> {
  const count   = Math.floor(Math.random() * 4) + 2;
  const sources = Array.from({ length: count }, () => ({
    provider:  pick(["VegaMovies", "FZMovies", "HDToday", "MKVCinemas"]),
    label:     pick(["1080p", "720p", "480p"]),
    pageUrl:   `https://vegamovies.${pick(["global", "in", "tv"])}/movies/${randBase36(10)}`,
    directUrl: fakeEncryptedUrl(`https://cdn.example.com/hls/${randHex(12)}/master.m3u8`),
    isStream:  true,
    quality:   pick(["1080p", "720p", "HD"]),
  }));

  return {
    sources,
    totalFound:  sources.length,
    streamReady: sources.length,
    durationMs:  Math.floor(Math.random() * 9000) + 3000,
  };
}
