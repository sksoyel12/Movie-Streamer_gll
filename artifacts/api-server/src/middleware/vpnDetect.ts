/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *     Ask the project owner for this code before editing.
 *
 * VPN / Proxy / Datacenter Detection Middleware
 *
 * Uses ip-api.com (free tier, no API key required) to check whether the
 * client IP belongs to a known VPN, proxy, Tor exit node, or datacenter.
 *
 * Results are cached per-IP for 30 minutes to stay within the free-tier
 * rate limit (45 req/min) and to reduce latency.
 *
 * Behaviour:
 *   - Private/loopback IPs always pass (dev/internal traffic)
 *   - VPN or proxy detected → 403 with code VPN_DETECTED
 *   - Datacenter IP detected → 403 with code DATACENTER_IP
 *   - API unavailable → fail OPEN (do not block users during outages)
 */

import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

// ─── Private / reserved IP ranges to skip ────────────────────────────────────

const PRIVATE_IP_RE =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fc|fd|fe80)/i;

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RE.test(ip);
}

// ─── ip-api.com response shape ────────────────────────────────────────────────

interface IpApiResponse {
  status:  "success" | "fail";
  proxy:   boolean; // true = VPN / proxy / Tor exit
  hosting: boolean; // true = datacenter / cloud provider
  query:   string;
}

// ─── Result cache ─────────────────────────────────────────────────────────────

interface CacheEntry {
  isVpn:      boolean;
  isProxy:    boolean;
  isHosting:  boolean;
  cachedAt:   number;
}

const IP_CACHE   = new Map<string, CacheEntry>();
const CACHE_TTL  = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE  = 50_000;

function getCached(ip: string): CacheEntry | null {
  const entry = IP_CACHE.get(ip);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    IP_CACHE.delete(ip);
    return null;
  }
  return entry;
}

function setCached(ip: string, entry: Omit<CacheEntry, "cachedAt">) {
  if (IP_CACHE.size >= MAX_CACHE) {
    const oldest = IP_CACHE.keys().next().value;
    if (oldest) IP_CACHE.delete(oldest);
  }
  IP_CACHE.set(ip, { ...entry, cachedAt: Date.now() });
}

// ─── ip-api.com check ─────────────────────────────────────────────────────────

async function checkIpApi(ip: string): Promise<CacheEntry | null> {
  const cached = getCached(ip);
  if (cached) return cached;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);

    // Free tier is HTTP only; HTTPS requires a paid plan.
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,proxy,hosting,query`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as IpApiResponse;
    if (data.status !== "success") return null;

    const entry: Omit<CacheEntry, "cachedAt"> = {
      isVpn:     data.proxy,
      isProxy:   data.proxy,
      isHosting: data.hosting,
    };

    setCached(ip, entry);
    logger.debug({ ip, ...entry }, "VPN check result");
    return { ...entry, cachedAt: Date.now() };
  } catch {
    // API unreachable — fail open (do not block users)
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Block requests originating from known VPN / proxy / Tor / datacenter IPs.
 *
 * Attaches `req.isVpn` boolean for downstream use.
 * On block, returns HTTP 403 with a JSON body the mobile app can parse
 * to show a friendly "Disable VPN to continue" modal.
 */
export async function vpnDetect(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? "";

  // Skip loopback / private / dev traffic
  if (!ip || isPrivateIp(ip)) {
    (req as any).isVpn = false;
    return next();
  }

  const result = await checkIpApi(ip);

  // Fail open when API is down
  if (!result) {
    (req as any).isVpn = false;
    return next();
  }

  if (result.isVpn || result.isProxy) {
    logger.warn({ ip }, "VPN/proxy detected — request blocked");
    res.status(403).json({
      error:   "VPN or proxy detected. Please disable your VPN to continue.",
      code:    "VPN_DETECTED",
      blocked: true,
    });
    return;
  }

  if (result.isHosting) {
    logger.warn({ ip }, "Datacenter IP detected — request blocked");
    res.status(403).json({
      error:   "Requests from datacenter or cloud IPs are not permitted.",
      code:    "DATACENTER_IP",
      blocked: true,
    });
    return;
  }

  (req as any).isVpn = false;
  next();
}
