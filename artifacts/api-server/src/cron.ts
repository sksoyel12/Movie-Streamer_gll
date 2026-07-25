/**
 * Daily email cron job — sends a "Continue Watching" or "Featured Movie"
 * email to every registered Firebase Auth user once per day at 10:00 AM UTC.
 *
 * Requires Firebase Admin credentials and TMDB key to be set.
 * If either is missing the cron still runs but logs a warning and skips.
 */

import cron from "node-cron";
import { logger } from "./lib/logger";
import {
  getAllUsers,
  getUserContinueWatching,
  getTrendingMovie,
  getNewReleaseMovie,
  tmdbPosterUrl,
  formatRating,
} from "./lib/firestoreData";
import { sendDailyFeaturedEmail } from "./utils/emailSender";

// ---------------------------------------------------------------------------
// Core batch sender
// ---------------------------------------------------------------------------

export async function runDailyEmailBatch(): Promise<void> {
  logger.info("Daily email batch — starting");

  const users = await getAllUsers();
  if (users.length === 0) {
    logger.warn("Daily email batch — no users found (Firebase Admin may not be configured)");
    return;
  }

  // Fetch featured content once — try "Now Playing" first (new release), then trending
  const [newRelease, trending] = await Promise.all([getNewReleaseMovie(), getTrendingMovie()]);
  const featured          = newRelease ?? trending;
  const fallbackPosterUrl = featured?.posterPath ? tmdbPosterUrl(featured.posterPath) : null;
  const fallbackTitle     = featured?.title     ?? "Today's Top Pick";
  const fallbackRating    = featured ? formatRating(featured.voteAverage, featured.voteCount) : null;
  const fallbackOverview  = featured?.overview  ?? null;
  const fallbackRelDate   = featured?.releaseDate ?? null;
  const isFallbackNew     = !!newRelease; // true when we actually got a now-playing movie

  logger.info({ userCount: users.length, fallbackTitle }, "Daily email batch — sending");

  // Stagger sends: 200 ms gap between each to avoid Gmail rate limits
  const DELAY_MS = 200;

  for (let i = 0; i < users.length; i++) {
    const user = users[i]!;

    try {
      // Try to get this user's real "Continue Watching" poster from Firestore
      const progress = await getUserContinueWatching(user.uid);

      const isContinueWatching = !!(progress?.posterUri ?? null);
      const posterUrl          = progress?.posterUri ?? fallbackPosterUrl;
      const movieTitle         = progress?.title     ?? fallbackTitle;

      if (!posterUrl) {
        logger.warn({ uid: user.uid }, "Skipping daily email — no poster available");
        continue;
      }

      await sendDailyFeaturedEmail({
        recipientEmail:     user.email,
        displayName:        user.displayName,
        posterUrl,
        movieTitle,
        isContinueWatching,
        // Rating and metadata only available for TMDB-sourced fallback items
        rating:      isContinueWatching ? null : fallbackRating,
        overview:    isContinueWatching ? null : fallbackOverview,
        releaseDate: isContinueWatching ? null : fallbackRelDate,
        isNewRelease: !isContinueWatching && isFallbackNew,
      });
    } catch (err) {
      // Never let one user's failure kill the entire batch
      logger.error({ err, uid: user.uid, email: user.email }, "Daily email failed for user (skipping)");
    }

    // Stagger to stay within Gmail's ~100 emails/day free tier rate limit
    if (i < users.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  logger.info({ userCount: users.length }, "Daily email batch — complete");
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/**
 * Starts the cron scheduler.
 * Schedule: every day at 10:00 AM UTC  →  "0 10 * * *"
 * Pass `runImmediately = true` in tests / development to trigger instantly.
 */
export function startCron(runImmediately = false): void {
  const schedule = process.env["DAILY_EMAIL_CRON"] ?? "0 10 * * *";

  const task = cron.schedule(
    schedule,
    () => {
      runDailyEmailBatch().catch((err) =>
        logger.error({ err }, "Unhandled error in daily email batch"),
      );
    },
    { timezone: "UTC" },
  );

  logger.info({ schedule }, "Daily email cron scheduled");

  if (runImmediately) {
    logger.info("Running daily email batch immediately (DEV mode)");
    runDailyEmailBatch().catch((err) =>
      logger.error({ err }, "Unhandled error in immediate batch run"),
    );
  }
}
