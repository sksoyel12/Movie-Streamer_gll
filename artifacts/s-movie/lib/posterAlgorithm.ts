/**
 * posterAlgorithm.ts — Netflix-style 15-hour locked poster rotation
 *
 * Algorithm:
 *   rotation_key = Math.floor(Date.now() / (15 * 60 * 60 * 1000))
 *
 * • Every title gets a poster locked for one 15-hour window.
 * • The same poster is shown to the user throughout a browsing session
 *   (anti-flicker) — it only changes when the next 15-hour window opens.
 * • Home screen and Detail screen intentionally use DIFFERENT posters:
 *     Home   → pool[rotation_key % pool.length]
 *     Detail → images[1]  (different fixed index)
 *
 * Auto-purge runs at app start and removes expired locks (> 24 h old) so
 * AsyncStorage memory footprint stays low.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const POSTER_LOCK_PREFIX  = "smovie_poster_rkv2_";
const ROTATION_PERIOD_MS  = 15 * 60 * 60 * 1000; // 15 hours

// ─── Core rotation helpers ─────────────────────────────────────────────────────

/** Returns the current 15-hour rotation bucket integer. Changes every 15 hours. */
export function getRotationKey(): number {
  return Math.floor(Date.now() / ROTATION_PERIOD_MS);
}

/**
 * Deterministic poster index for a given movie within the current 15-hour window.
 * Uses movieId as additional entropy so different titles pick different posters
 * from their respective pools even within the same rotation window.
 */
export function getPosterIndexForWindow(movieId: number | string, poolSize: number): number {
  if (poolSize <= 0) return 0;
  const rk  = getRotationKey();
  const seed = rk * 31 + Number(String(movieId).replace(/\D/g, "").slice(-6) || 0);
  return Math.abs(seed) % poolSize;
}

// ─── AsyncStorage-backed locked poster ────────────────────────────────────────

/**
 * Returns a poster URI that is stable for the current 15-hour window.
 *
 * 1. Checks AsyncStorage: if a valid entry exists for `movieId` in the current
 *    rotation window → returns it immediately (no flicker, no network).
 * 2. Otherwise selects a new poster using rotation_key % pool.length, persists
 *    the choice, and returns the URI.
 *
 * @param movieId    TMDB id used as the storage key discriminator.
 * @param posters    Array of file_path strings from TMDB /images (up to 50).
 * @param toUri      Function that converts a file_path to a fully-proxied URI.
 * @param fallback   URI returned when posters array is empty.
 */
export async function getLockedHomePosterUri(
  movieId: number | string,
  posters: string[],
  toUri:   (path: string) => string | null,
  fallback: string | null = null,
): Promise<string | null> {
  if (posters.length === 0) return fallback;

  const rk         = getRotationKey();
  const storageKey = POSTER_LOCK_PREFIX + String(movieId);

  // Return the cached choice if it belongs to the current rotation window
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      const entry: { uri: string; rk: number } = JSON.parse(raw);
      if (entry.rk === rk && entry.uri) return entry.uri;
    }
  } catch {}

  // Pool: up to 50 posters (as available from TMDB /images)
  const pool = posters.slice(0, Math.min(50, posters.length));
  const idx  = getPosterIndexForWindow(movieId, pool.length);
  const uri  = toUri(pool[idx]);
  if (!uri) return fallback;

  // Persist the selection for this window (fire-and-forget)
  AsyncStorage.setItem(storageKey, JSON.stringify({ uri, rk })).catch(() => {});
  return uri;
}

// ─── Detail-page poster selector ──────────────────────────────────────────────

/**
 * Returns the DETAIL page poster — always images[1] so the detail screen shows
 * different artwork than the home screen (which uses rotation_key-based index).
 * Falls back to images[0] when the pool has only one entry.
 */
export function getDetailPoster(posters: string[]): string | null {
  if (posters.length === 0) return null;
  return posters.length > 1 ? posters[1] : posters[0];
}

// ─── 24-hour cache purge ──────────────────────────────────────────────────────

/**
 * Removes AsyncStorage poster-lock entries that are > 24 hours old.
 * Call once per app session (fire-and-forget) to keep storage lean.
 *
 * Purge logic: an entry is stale when its saved rotation_key is ≥ 2 windows
 * behind the current window (each window = 15 h → 2 windows = 30 h > 24 h).
 */
export async function clearExpiredPosterLocks(): Promise<void> {
  try {
    const allKeys  = await AsyncStorage.getAllKeys();
    const lockKeys = allKeys.filter((k) => k.startsWith(POSTER_LOCK_PREFIX));
    if (lockKeys.length === 0) return;

    const currentRk = getRotationKey();
    const pairs     = await AsyncStorage.multiGet(lockKeys);
    const toRemove: string[] = [];

    for (const [key, raw] of pairs) {
      if (!raw) { toRemove.push(key); continue; }
      try {
        const { rk } = JSON.parse(raw) as { rk: number };
        if (currentRk - rk >= 2) toRemove.push(key);
      } catch {
        toRemove.push(key);
      }
    }

    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch {
    // Storage errors are non-fatal
  }
}
