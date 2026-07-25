/**
 * Server-side Firestore + Firebase Auth + TMDB queries for the email system.
 * All functions return null / [] on error so callers can degrade gracefully.
 */

import { logger } from "./logger";
import { getFirestore, getAuth } from "./firebaseAdmin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserRecord {
  uid:         string;
  email:       string;
  displayName: string | null;
}

export interface ContinueWatchingItem {
  movieId:   string;
  title:     string | null;
  posterUri: string | null;
}

export interface TmdbMovie {
  id:          number;
  title:       string;
  posterPath:  string | null;
  voteAverage: number;
  voteCount:   number;
  releaseDate: string | null;
  overview:    string | null;
}

// ---------------------------------------------------------------------------
// TMDB API key helper
// ---------------------------------------------------------------------------

function tmdbKey(): string | null {
  return (
    process.env["TmDB_api_kay_"] ??
    process.env["TMDB_API_KEY_V3"] ??
    process.env["TMDB_API_KEY"] ??
    process.env["EXPO_PUBLIC_TMDB_API_KEY"] ??
    null
  );
}

// ---------------------------------------------------------------------------
// Get the most recently watched item for a single user
// ---------------------------------------------------------------------------

export async function getUserContinueWatching(
  uid: string,
): Promise<ContinueWatchingItem | null> {
  const db = getFirestore();
  if (!db) return null;

  try {
    const snap = await db
      .collection("user_progress")
      .where("userId", "==", uid)
      .orderBy("lastWatchedAtMs", "desc")
      .limit(1)
      .get();

    if (snap.empty) return null;
    const data = snap.docs[0]!.data();
    return {
      movieId:   String(data["movieId"]   ?? ""),
      title:     typeof data["title"]     === "string" ? data["title"]     : null,
      posterUri: typeof data["posterUri"] === "string" ? data["posterUri"] : null,
    };
  } catch (err) {
    logger.warn({ err, uid }, "Could not fetch user continue-watching from Firestore");
    return null;
  }
}

// ---------------------------------------------------------------------------
// List all enabled users from Firebase Auth (paginated, up to 1 000)
// ---------------------------------------------------------------------------

export async function getAllUsers(): Promise<UserRecord[]> {
  const auth = getAuth();
  if (!auth) return [];

  const result: UserRecord[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const listResult = await auth.listUsers(1000, pageToken);
      for (const u of listResult.users) {
        if (u.email && !u.disabled) {
          result.push({ uid: u.uid, email: u.email, displayName: u.displayName ?? null });
        }
      }
      pageToken = listResult.pageToken;
    } while (pageToken);
  } catch (err) {
    logger.error({ err }, "Failed to list Firebase Auth users");
  }

  return result;
}

// ---------------------------------------------------------------------------
// TMDB helpers
// ---------------------------------------------------------------------------

async function fetchTmdb(endpoint: string): Promise<unknown> {
  const key = tmdbKey();
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${endpoint}?api_key=${key}&language=en-US`,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function mapMovie(m: Record<string, unknown>): TmdbMovie {
  return {
    id:          Number(m["id"]           ?? 0),
    title:       String(m["title"]        ?? m["name"] ?? ""),
    posterPath:  typeof m["poster_path"]  === "string" ? m["poster_path"]  : null,
    voteAverage: Number(m["vote_average"] ?? 0),
    voteCount:   Number(m["vote_count"]   ?? 0),
    releaseDate: typeof m["release_date"] === "string" ? m["release_date"] : null,
    overview:    typeof m["overview"]     === "string" ? m["overview"]     : null,
  };
}

/** Fetch today's #1 trending movie (used as fallback for users with no watch history). */
export async function getTrendingMovie(): Promise<TmdbMovie | null> {
  if (!tmdbKey()) {
    logger.warn("TMDB key not set — skipping trending fetch");
    return null;
  }
  const data = (await fetchTmdb("trending/movie/day")) as { results?: unknown[] } | null;
  const movie = data?.results?.[0] as Record<string, unknown> | undefined;
  return movie ? mapMovie(movie) : null;
}

/** Fetch the latest "Now Playing" movie (new release). */
export async function getNewReleaseMovie(): Promise<TmdbMovie | null> {
  if (!tmdbKey()) return null;
  const data = (await fetchTmdb("movie/now_playing")) as { results?: unknown[] } | null;
  const movie = data?.results?.[0] as Record<string, unknown> | undefined;
  return movie ? mapMovie(movie) : null;
}

/** Fetch full movie details (for ratings + overview) by TMDB ID. */
export async function getMovieDetails(tmdbId: string | number): Promise<TmdbMovie | null> {
  if (!tmdbKey()) return null;
  const data = (await fetchTmdb(`movie/${tmdbId}`)) as Record<string, unknown> | null;
  return data ? mapMovie(data) : null;
}

/** Convert a TMDB poster_path to a wsrv.nl-proxied, email-safe image URL. */
export function tmdbPosterUrl(posterPath: string, size = "w500"): string {
  const tmdbUrl = `https://image.tmdb.org/t/p/${size}${posterPath}`;
  return `https://wsrv.nl/?url=${encodeURIComponent(tmdbUrl)}&w=600&output=jpg`;
}

/** Format a 0-10 vote_average as filled/empty star string (e.g. "★★★★☆ 8.4/10"). */
export function formatRating(voteAverage: number, voteCount: number): string {
  const clamped = Math.min(10, Math.max(0, voteAverage));
  const stars   = Math.round(clamped / 2); // 0-5 scale
  const filled  = "★".repeat(stars);
  const empty   = "☆".repeat(5 - stars);
  const votes   = voteCount >= 1000
    ? `${(voteCount / 1000).toFixed(1)}k`
    : String(voteCount);
  return `${filled}${empty} ${clamped.toFixed(1)}/10 (${votes} votes)`;
}
