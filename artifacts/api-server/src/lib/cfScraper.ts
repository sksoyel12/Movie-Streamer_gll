/**
 * Cloudflare Bypass Scraper — Node.js
 *
 * Rotates mobile Chrome/Safari User-Agents, sends full Chrome-matching
 * header sets (Sec-Fetch-*, Sec-CH-UA, Accept-*), and persists cf_clearance
 * cookies across requests to the same domain.
 *
 * Works for: CF "Managed Challenge" (cookie-based), sites in logging-only
 * mode, and sites with light bot-detection.
 * Does NOT solve CF JS-challenge (requires a real browser / Puppeteer).
 */

const MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.53 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.40 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
  "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
];

// Domain-scoped cookie jar
const cookieJar = new Map<string, Map<string, string>>();

export function pickUA(): string {
  return MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
}

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function getStoredCookies(domain: string): string {
  const jar = cookieJar.get(domain);
  if (!jar || jar.size === 0) return "";
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(url: string, res: Response): void {
  const domain = getDomain(url);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;

  if (!cookieJar.has(domain)) cookieJar.set(domain, new Map());
  const jar = cookieJar.get(domain)!;

  // Handle comma-separated Set-Cookie headers
  const parts = setCookie.split(/,(?=[^ ][^=]+=)/);
  for (const part of parts) {
    const main = part.split(";")[0].trim();
    const eqIdx = main.indexOf("=");
    if (eqIdx > 0) {
      jar.set(main.slice(0, eqIdx).trim(), main.slice(eqIdx + 1).trim());
    }
  }
}

function buildChromeHeaders(url: string, referer?: string, ua?: string): Record<string, string> {
  const domain = getDomain(url);
  const cookies = getStoredCookies(domain);
  const isMobile = (ua ?? "").includes("Mobile") || (ua ?? "").includes("Android") || (ua ?? "").includes("iPhone");

  const h: Record<string, string> = {
    "User-Agent": ua ?? pickUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-CH-UA-Mobile": isMobile ? "?1" : "?0",
    "Sec-CH-UA-Platform": isMobile ? '"Android"' : '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "cross-site" : "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };

  if (referer) h["Referer"] = referer;
  if (cookies) h["Cookie"] = cookies;

  return h;
}

function buildAjaxHeaders(url: string, referer: string, ua?: string): Record<string, string> {
  const domain = getDomain(url);
  const cookies = getStoredCookies(domain);

  const h: Record<string, string> = {
    "User-Agent": ua ?? pickUA(),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-CH-UA-Mobile": "?1",
    "Sec-CH-UA-Platform": '"Android"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Origin": new URL(referer).origin,
    "Referer": referer,
  };

  if (cookies) h["Cookie"] = cookies;
  return h;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchHtmlCF(
  url: string,
  opts?: { referer?: string; timeoutMs?: number; retries?: number }
): Promise<string> {
  const { referer, timeoutMs = 10000, retries = 3 } = opts ?? {};

  for (let attempt = 0; attempt < retries; attempt++) {
    const ua = pickUA();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: buildChromeHeaders(url, referer, ua),
        redirect: "follow",
      });
      clearTimeout(timer);
      storeCookies(url, res);

      if (res.status === 429 || res.status === 503) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (res.status === 403) {
        // CF block — try with different UA
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
          continue;
        }
        return "";
      }

      if (!res.ok) return "";
      return await res.text();
    } catch {
      clearTimeout(timer);
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return "";
}

export async function fetchJsonCF(
  url: string,
  opts?: {
    method?: string;
    body?: string;
    referer?: string;
    timeoutMs?: number;
    ua?: string;
  }
): Promise<any> {
  const { method = "POST", body, referer, timeoutMs = 8000, ua } = opts ?? {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      method,
      headers: buildAjaxHeaders(url, referer ?? url, ua),
      ...(body ? { body } : {}),
      redirect: "follow",
    });
    clearTimeout(timer);
    storeCookies(url, res);
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function followRedirects(url: string, maxHops = 5): Promise<string> {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(current, {
        signal: ctrl.signal,
        headers: buildChromeHeaders(current),
        redirect: "manual",
      });
      clearTimeout(t);
      storeCookies(current, res);
      const loc = res.headers.get("location");
      if (!loc || (res.status < 300 || res.status >= 400)) return current;
      current = loc.startsWith("http") ? loc : new URL(loc, current).href;
    } catch {
      clearTimeout(t);
      return current;
    }
  }
  return current;
}
