/**
 * SmartImage — ISP-bypass robust image loader (speed-optimised)
 *
 * Problem: image.tmdb.org is DNS-blocked on Indian ISPs (BSNL, Airtel, Jio).
 *
 * Retry chain (fastest first):
 *   1. wsrv.nl  w780   ← Cloudflare CDN edge-cache, NOT in Indian ISP blocklists (~50ms)
 *   2. wsrv.nl  w500   ← same CDN, slightly smaller
 *   3. /api/image      ← Replit server proxy (ISP fallback if wsrv.nl also blocked)
 *   4. weserv.nl w780  ← secondary CDN proxy
 *   5. direct image.tmdb.org ← last resort
 *   6. All failed → placeholder
 *
 * Each attempt gets 2.5s before stepping to the next.
 * expo-image memory-disk cache ensures each URL loads only once per session.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageContentFit, type ImageSource } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { API_HOST } from "@/lib/apiBase";

// Blurhash placeholder shown while image loads
const BLURHASH = "L02Yr=xuofj[~qj[ofj[M{j[M{j[";

// ─── Proxy hosts ──────────────────────────────────────────────────────────────
const WSRV   = "https://wsrv.nl/?url=";
const WESERV = "https://images.weserv.nl/?url=";

const _API_HOST = API_HOST;
const SERVER_PROXY: string | null = _API_HOST ? `${_API_HOST}/api/image?url=` : null;

function buildProxyUrl(directTmdbUrl: string, proxy: string, size: string): string {
  const sized = directTmdbUrl.includes("/t/p/")
    ? directTmdbUrl.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`)
    : directTmdbUrl;
  return `${proxy}${encodeURIComponent(sized)}`;
}

// ─── Retry chain: [proxy, size] — fastest first for Netflix-like speed ────────
// wsrv.nl (Cloudflare) has Indian CDN edge nodes → ~50ms vs ~400ms for a
// US-based Replit server. Server proxy kept as ISP-proof fallback for the rare
// case where Cloudflare is also blocked.
type ProxyStep = [string, string];

const RETRY_CHAIN: ProxyStep[] = [
  // Server proxy FIRST — ISP-proof, works in India (Jio/Airtel/BSNL all block TMDB)
  ...(SERVER_PROXY
    ? [[SERVER_PROXY, "w780"] as ProxyStep]
    : []),
  [WSRV,   "w780"],    // Fallback 1 — Cloudflare CDN
  [WSRV,   "w500"],    // Fallback 2 — same CDN, smaller size
  [WESERV, "w780"],    // Fallback 3 — secondary CDN
  // Final fallback = direct TMDB URL
];

// 3 s per step — enough for server proxy cold-start round-trip
const STEP_TIMEOUT_MS = 3_000;

// ─── URI normalisation ────────────────────────────────────────────────────────
function extractDirectUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  // Already a wsrv / weserv proxied URL — decode inner URL
  if (raw.includes("wsrv.nl") || raw.includes("weserv.nl")) {
    const m = raw.match(/[?&]url=([^&]+)/);
    if (m) {
      try { return decodeURIComponent(m[1]); } catch {}
    }
    return raw;
  }

  // Server proxy URL — extract the inner url= param
  if (raw.includes("/api/image?url=")) {
    const m = raw.match(/\/api\/image\?url=([^&]+)/);
    if (m) {
      try { return decodeURIComponent(m[1]); } catch {}
    }
    return raw;
  }

  // Bare TMDB path like /abc123.jpg
  if (raw.startsWith("/")) return `https://image.tmdb.org/t/p/w780${raw}`;

  // Direct image.tmdb.org URL
  if (raw.includes("image.tmdb.org")) return raw;

  // http → https
  if (raw.startsWith("http://")) return raw.replace("http://", "https://");

  return raw;
}

function buildRetryUrl(directUrl: string, step: number): string {
  if (step >= RETRY_CHAIN.length) return directUrl; // final step: direct TMDB
  const [proxy, size] = RETRY_CHAIN[step];
  return buildProxyUrl(directUrl, proxy, size);
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────
function Shimmer({ style }: { style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, sh.shimmer, style, { opacity }]} />
  );
}
const sh = StyleSheet.create({ shimmer: { backgroundColor: "#1e2a3a" } });

// ─── SmartImage ───────────────────────────────────────────────────────────────
interface Props {
  source: ImageSource | null | undefined;
  style?: any;
  contentFit?: ImageContentFit;
  contentPosition?: any;
  transition?: number;
  recyclingKey?: string;
  cachePolicy?: "none" | "disk" | "memory" | "memory-disk";
  priority?: "low" | "normal" | "high";
}

export default function SmartImage({
  source,
  style,
  contentFit = "cover",
  contentPosition,
  transition = 250,
  recyclingKey,
  cachePolicy = "memory-disk",
  priority = "normal",
}: Props) {
  const rawUri =
    typeof source === "object" && source !== null && "uri" in source
      ? (source as { uri?: string }).uri
      : typeof source === "string"
      ? source
      : undefined;

  const directUrl = extractDirectUrl(rawUri);
  const isTmdb = Boolean(directUrl?.includes("image.tmdb.org"));

  const [step, setStep] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset whenever the source changes
  useEffect(() => {
    setStep(0);
    setLoadFailed(false);
    setIsLoading(true);
  }, [directUrl]);

  // Per-step timeout: 2.5s then advance chain
  useEffect(() => {
    if (loadFailed || !isLoading || !directUrl) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => handleError(), STEP_TIMEOUT_MS);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  // handleError is stable (useCallback + no deps that change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, directUrl, loadFailed]);

  const handleError = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const nextStep = step + 1;
    const maxSteps = isTmdb ? RETRY_CHAIN.length + 1 : 1;
    if (nextStep < maxSteps && directUrl) {
      setStep(nextStep);
      setIsLoading(true);
    } else {
      setLoadFailed(true);
      setIsLoading(false);
    }
  }, [step, directUrl, isTmdb]);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsLoading(false);
  }, []);

  // No usable URI at all — show shimmer (not "No image") while we wait for data
  if (!directUrl) {
    return <View style={[styles.wrap, style]}><Shimmer /></View>;
  }

  if (loadFailed) {
    return (
      <View style={[styles.wrap, styles.failBg, styles.failCenter, style]}>
        <Ionicons name="film-outline" size={26} color="#2a3a4a" />
        <Text style={styles.failText}>No image</Text>
      </View>
    );
  }

  const currentUri: string = directUrl && isTmdb
    ? buildRetryUrl(directUrl, step)
    : (directUrl ?? (source as any));

  return (
    <View style={[styles.wrap, style]}>
      {isLoading && <Shimmer />}
      <Image
        source={{ uri: currentUri }}
        placeholder={{ blurhash: BLURHASH }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        contentPosition={contentPosition}
        transition={isLoading ? 0 : transition}
        cachePolicy={cachePolicy}
        recyclingKey={recyclingKey ?? currentUri}
        priority={priority}
        onLoad={handleLoad}
        onError={handleError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:       { overflow: "hidden", backgroundColor: "#0f1923" },
  failBg:     { backgroundColor: "#111820" },
  failCenter: { justifyContent: "center", alignItems: "center", gap: 6 },
  failText:   { color: "#2a3a4a", fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
});

// ─── Prefetch utility ─────────────────────────────────────────────────────────
/**
 * Prefetch a list of image URIs using the primary wsrv.nl proxy.
 * Call after data loads to warm the Cloudflare edge cache before the user scrolls.
 */
export async function prefetchImages(uris: (string | undefined | null)[]): Promise<void> {
  const valid = uris.filter(Boolean) as string[];
  await Promise.allSettled(
    valid.map((uri) => {
      const direct = extractDirectUrl(uri);
      const proxied = direct ? buildRetryUrl(direct, 0) : uri;
      return Image.prefetch(proxied);
    }),
  );
}

/**
 * Normalise any raw image URI to the primary wsrv.nl proxy URL (step 0).
 * Exported for components that build their own `{ uri }` sources.
 */
export function normaliseImageUri(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const direct = extractDirectUrl(raw);
  if (!direct) return undefined;
  if (direct.includes("image.tmdb.org")) return buildRetryUrl(direct, 0);
  return direct;
}

/** @deprecated use normaliseImageUri */
export const normaliseUri = normaliseImageUri;
