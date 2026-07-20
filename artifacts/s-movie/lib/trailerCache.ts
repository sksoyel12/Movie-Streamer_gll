/**
 * Trailer / Video metadata cache
 * Two-tier: in-memory (instant) → AsyncStorage (24 h TTL).
 * Prevents redundant TMDB /videos API calls on every detail-page visit.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface VideoEntry {
  key: string;
  name: string;
  type: string;
  site: string;
  isHindi?: boolean;
}

const MEM: Map<string, { videos: VideoEntry[]; ts: number }> = new Map();
const TTL = 24 * 60 * 60 * 1000; // 24 h
const PREFIX = "@smovie_videos_";

function mk(tmdbId: number, type: "movie" | "tv") {
  return `${PREFIX}${type}_${tmdbId}`;
}

export async function getCachedVideos(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<VideoEntry[] | null> {
  const k = mk(tmdbId, type);
  const hit = MEM.get(k);
  if (hit && Date.now() - hit.ts < TTL) return hit.videos;
  try {
    const raw = await AsyncStorage.getItem(k);
    if (!raw) return null;
    const parsed: { videos: VideoEntry[]; ts: number } = JSON.parse(raw);
    if (Date.now() - parsed.ts > TTL) {
      AsyncStorage.removeItem(k).catch(() => {});
      return null;
    }
    MEM.set(k, parsed);
    return parsed.videos;
  } catch {
    return null;
  }
}

export async function setCachedVideos(
  tmdbId: number,
  type: "movie" | "tv",
  videos: VideoEntry[],
): Promise<void> {
  const k = mk(tmdbId, type);
  const entry = { videos, ts: Date.now() };
  MEM.set(k, entry);
  try {
    await AsyncStorage.setItem(k, JSON.stringify(entry));
  } catch {}
}
