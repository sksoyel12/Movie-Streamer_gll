import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * S-Movie users table.
 *
 * One row per Firebase-authenticated identity. Created the first time a user
 * completes Google Sign-up (see routes/identity.ts on the API server).
 *
 * `uniqueUserId` is a permanent, non-sequential 8-character alphanumeric ID
 * shown to the user in "My Profile" for support/referral purposes.
 */
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),

  // Firebase Identity Toolkit `localId` — one row per Firebase account.
  firebaseUid: text("firebase_uid").notNull().unique(),

  // Public-facing unique ID, e.g. "K7QX9RT2". Never sequential/incremental.
  uniqueUserId: text("unique_user_id").notNull().unique(),

  email: text("email"),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),

  // Stable per-device identifier (see s-movie lib/deviceFingerprint.ts) used
  // to flag duplicate sign-up attempts across different Google accounts.
  deviceFingerprint: text("device_fingerprint"),

  authProvider: text("auth_provider").notNull().default("google"),

  // Suspension gate — checked by the `blockSuspended` middleware in front of
  // all streaming/API routes.
  isSuspended: boolean("is_suspended").notNull().default(false),
  suspensionReason: text("suspension_reason"),

  // unverified | pending | verified | rejected
  verificationStatus: text("verification_status").notNull().default("unverified"),

  // Set when this account was created despite a duplicate-identity signal
  // (kept for audit; creation is normally blocked outright — see duplicateAttemptsTable).
  duplicateFlag: boolean("duplicate_flag").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

/**
 * Audit log of blocked duplicate Google sign-up attempts — a different
 * Google account tried to register from a device (or other identity signal)
 * already tied to an existing user. No new `users` row is created for these.
 */
export const duplicateAttemptsTable = pgTable("duplicate_attempts", {
  id: serial("id").primaryKey(),
  attemptedFirebaseUid: text("attempted_firebase_uid").notNull(),
  attemptedEmail: text("attempted_email"),
  matchedUserId: integer("matched_user_id").references(() => usersTable.id),
  deviceFingerprint: text("device_fingerprint"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDuplicateAttemptSchema = createInsertSchema(duplicateAttemptsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDuplicateAttempt = z.infer<typeof insertDuplicateAttemptSchema>;
export type DuplicateAttempt = typeof duplicateAttemptsTable.$inferSelect;
