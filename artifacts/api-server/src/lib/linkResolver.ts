/**
 * Cloud Drive Link Resolver
 *
 * Converts intermediate cloud storage URLs (Hubdrive, V-Cloud, GDFlix,
 * Pixeldrain, etc.) to direct playable .mp4 / .m3u8 URLs.
 */

import { fetchHtmlCF, fetchJsonCF, followRedirects } from "./cfScraper";

const DIRECT_EXTS = [".mp4", ".m3u8", ".mkv", ".webm", ".ts", ".avi", ".mov"];

export function isDirectStream(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return DIRECT_EXTS.some(ext => path.endsWith(ext));
  } catch {
    return false;
  }
}

export function extractStreamFromHtml(html: string): string | null {
  if (!html) return null;

  const patterns = [
    // JWPlayer / VideoJS "file": "url"
    /["']file["']\s*:\s*["'`](https?:\/\/[^"'`\s]{20,}\.(?:mp4|m3u8)[^"'`\s]*?)["'`]/gi,
    // src="url.mp4/m3u8"
    /src=["'`](https?:\/\/[^"'`\s]{20,}\.(?:mp4|m3u8)[^"'`\s]*?)["'`]/gi,
    // source src
    /<source[^>]+src=["'](https?:\/\/[^"'\s]+\.(?:mp4|m3u8)[^"'\s]*?)["']/gi,
    // Bare URL in script block
    /(https?:\/\/[^\s"'<>]{20,}\.(?:mp4|m3u8)[^\s"'<>]*)/gi,
    // downloadUrl or videoUrl in JSON
    /(?:downloadUrl|videoUrl|streamUrl|hls_url|mp4_url)["']?\s*:\s*["'`](https?:\/\/[^"'`\s]+)["'`]/gi,
  ];

  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(html);
    if (m) {
      const u = (m[1] ?? m[0]).trim();
      if (u.length > 25 && !u.includes("placeholder") && !u.includes("example") && !u.includes("sample")) {
        return u;
      }
    }
  }
  return null;
}

// ─── Individual resolvers ─────────────────────────────────────────────────────

async function resolveHubdrive(url: string): Promise<string | null> {
  try {
    const base = new URL(url).origin;
    const idMatch = url.match(/\/(?:file|d|e|share)\/([a-zA-Z0-9_-]{4,})/);
    if (!idMatch) return null;
    const fileId = idMatch[1];

    // Try known Hubdrive / HubCloud API patterns
    const apiEndpoints = [
      `${base}/api/ajax/e/${fileId}`,
      `${base}/ajax.php?action=get_file&id=${fileId}`,
    ];

    for (const apiUrl of apiEndpoints) {
      const json = await fetchJsonCF(apiUrl, { referer: url });
      if (json?.link) {
        const finalUrl = await followRedirects(json.link);
        return finalUrl;
      }
      if (json?.sources?.[0]?.file) return json.sources[0].file;
    }

    // Fallback: parse page HTML
    const html = await fetchHtmlCF(url);
    return extractStreamFromHtml(html);
  } catch {
    return null;
  }
}

async function resolveVCloud(url: string, referer?: string): Promise<string | null> {
  try {
    const html = await fetchHtmlCF(url, { referer: referer ?? "https://vegamovies.navy" });
    if (!html) return null;

    const direct = extractStreamFromHtml(html);
    if (direct) return direct;

    // V-Cloud "Watch Now" / "Download" button
    const btnPatterns = [
      /href=["'](https?:\/\/[^"']+)["'][^>]*class=["'][^"']*(?:btn|button|download|watch)[^"']*["']/gi,
      /href=["'](https?:\/\/[^"']+)["'][^>]*>\s*(?:Watch|Stream|Play|Fast Download|Instant DL)/gi,
    ];

    for (const p of btnPatterns) {
      const m = p.exec(html);
      if (m) {
        const nextUrl = m[1];
        const next = await fetchHtmlCF(nextUrl, { referer: url });
        const d = extractStreamFromHtml(next);
        if (d) return d;

        // One more hop
        const thirdBtn = next.match(/href=["'](https?:\/\/[^"']+\.mp4[^"']*?)["']/i);
        if (thirdBtn) return thirdBtn[1];
      }
    }

    // Pixeldrain / fastdl links embedded on page
    const pdMatch = html.match(/href=["'](https?:\/\/(?:pixeldrain\.com|fastdl\.me|bowfile\.com)[^"']+)["']/i);
    if (pdMatch) return resolvePixeldrain(pdMatch[1]);

    return null;
  } catch {
    return null;
  }
}

async function resolveGDFlix(url: string): Promise<string | null> {
  try {
    const html = await fetchHtmlCF(url);
    if (!html) return null;

    const direct = extractStreamFromHtml(html);
    if (direct) return direct;

    // GDFlix: "Instant Download" or "Fast Server"
    const m = html.match(/href=["'](https?:\/\/[^"']+)["'][^>]*>\s*(?:Instant Download|Fast Server|Server \d)/i);
    if (m) {
      const next = await fetchHtmlCF(m[1], { referer: url });
      return extractStreamFromHtml(next);
    }
    return null;
  } catch {
    return null;
  }
}

async function resolvePixeldrain(url: string): Promise<string | null> {
  try {
    const idMatch = url.match(/\/(?:u|l|f)\/([a-zA-Z0-9]{6,})/);
    if (!idMatch) return null;
    // Pixeldrain direct download URL
    return `https://pixeldrain.com/api/file/${idMatch[1]}?download`;
  } catch {
    return null;
  }
}

async function resolveFastDL(url: string, referer?: string): Promise<string | null> {
  try {
    // fastdl.zip/embed?download=TOKEN — fetch page and extract direct link
    const html = await fetchHtmlCF(url, { referer: referer ?? "https://nexdrive.fit" });
    if (!html) return null;
    const direct = extractStreamFromHtml(html);
    if (direct) return direct;
    // Look for a download button pointing to a direct file
    const m = html.match(/href=["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv)[^"']*)["']/i);
    if (m) return m[1];
    // Follow any redirect
    const final = await followRedirects(url);
    if (final !== url && isDirectStream(final)) return final;
    return null;
  } catch {
    return null;
  }
}

async function resolveDropGalaxy(url: string, referer?: string): Promise<string | null> {
  try {
    const html = await fetchHtmlCF(url, { referer: referer ?? "https://nexdrive.fit" });
    if (!html) return null;
    const direct = extractStreamFromHtml(html);
    if (direct) return direct;
    const m = html.match(/href=["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv)[^"']*)["']/i);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

async function resolveGofile(url: string): Promise<string | null> {
  try {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9]+)/);
    if (!idMatch) return null;
    const contentId = idMatch[1];

    // Get token first
    const tokenRes = await fetchJsonCF("https://api.gofile.io/accounts", { method: "POST", referer: url });
    const token = tokenRes?.data?.token;

    const data = await fetchJsonCF(
      `https://api.gofile.io/contents/${contentId}?wt=4fd6sg89d7s6&cache=true`,
      { method: "GET", referer: url, ...(token ? { ua: token } : {}) }
    );

    const files = data?.data?.contents;
    if (files) {
      const first = Object.values(files as Record<string, any>)[0];
      if (first?.link) return first.link;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export async function resolveCloudLink(
  url: string,
  referer?: string,
): Promise<{ url: string; isStream: boolean } | null> {
  if (!url) return null;

  if (isDirectStream(url)) return { url, isStream: true };

  const lower = url.toLowerCase();
  let result: string | null = null;

  try {
    if (lower.includes("hubdrive") || lower.includes("hubcloud") || lower.includes("katdrive")) {
      result = await resolveHubdrive(url);
    } else if (
      lower.includes("v-cloud") || lower.includes("vcloud") ||
      lower.includes("vcld") || lower.includes("vcdn") ||
      lower.includes("v1link") || lower.includes("vcloudz") ||
      lower.includes("vcloud.zip")
    ) {
      result = await resolveVCloud(url, referer);
    } else if (lower.includes("gdflix") || lower.includes("gdtot")) {
      result = await resolveGDFlix(url);
    } else if (lower.includes("pixeldrain")) {
      result = await resolvePixeldrain(url);
    } else if (lower.includes("gofile")) {
      result = await resolveGofile(url);
    } else if (lower.includes("fastdl")) {
      result = await resolveFastDL(url, referer);
    } else if (lower.includes("dropgalaxy") || lower.includes("buzzheavier") || lower.includes("krakenfiles") || lower.includes("send.cm")) {
      result = await resolveDropGalaxy(url, referer);
    } else {
      // Unknown cloud host — try fetching + extracting
      const html = await fetchHtmlCF(url, { referer });
      result = extractStreamFromHtml(html);
      if (!result) {
        // Try following as redirect
        const final = await followRedirects(url);
        if (final !== url && isDirectStream(final)) result = final;
      }
    }
  } catch {
    result = null;
  }

  if (result) {
    return { url: result, isStream: isDirectStream(result) };
  }

  // Return original as a non-stream fallback so caller can still use it
  return { url, isStream: false };
}

// ─── Batch resolver — stop at first direct stream ─────────────────────────────

export async function resolveFirstStream(
  links: string[],
  referer?: string,
): Promise<{ url: string; isStream: boolean; source: string } | null> {
  for (const link of links) {
    const r = await resolveCloudLink(link, referer);
    if (r?.isStream) return { ...r, source: new URL(link).hostname };
  }
  // Return first non-null even if not a direct stream
  for (const link of links) {
    const r = await resolveCloudLink(link, referer);
    if (r) return { ...r, source: new URL(link).hostname };
  }
  return null;
}
