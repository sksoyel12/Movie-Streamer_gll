import AsyncStorage from "@react-native-async-storage/async-storage";

export type WatchProgress = {
  movieId: string;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
  title?: string;
  posterUri?: string;
};

const STORAGE_KEY = "smovie_watch_progress_v2";

async function loadAll(): Promise<Record<string, WatchProgress>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, WatchProgress>) : {};
  } catch {
    return {};
  }
}

async function saveAll(data: Record<string, WatchProgress>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/** Persist playback position for a movie. Only saves if more than 5s in. */
export async function saveProgress(progress: WatchProgress): Promise<void> {
  if (progress.positionSec < 5) return;
  const all = await loadAll();
  all[progress.movieId] = { ...progress, updatedAt: Date.now() };
  await saveAll(all);
}

/** Load saved progress for a specific movie, or null if none. */
export async function loadProgress(
  movieId: string,
): Promise<WatchProgress | null> {
  const all = await loadAll();
  return all[movieId] ?? null;
}

/**
 * Return all movies with saved progress, sorted by most recently watched.
 * Filters out:
 *  - Videos watched < 5s (accidental starts)
 *  - Videos > 95% complete (considered finished)
 */
export async function loadAllProgress(): Promise<WatchProgress[]> {
  const all = await loadAll();
  return Object.values(all)
    .filter((p) => {
      if (p.positionSec < 5) return false;
      if (p.durationSec > 0 && p.positionSec >= p.durationSec * 0.95)
        return false;
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Remove saved progress for a finished or manually cleared movie. */
export async function clearProgress(movieId: string): Promise<void> {
  const all = await loadAll();
  delete all[movieId];
  await saveAll(all);
}
