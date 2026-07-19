import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * One row per photo-ID verification attempt. The raw image is analyzed
 * on-the-fly (blur / tamper / fake-ID detection) and only the verdict is
 * persisted here — the photo itself is not stored.
 */
export const identityVerificationsTable = pgTable("identity_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),

  // pending | approved | rejected
  status: text("status").notNull(),
  rejectionReason: text("rejection_reason"),

  blurScore: real("blur_score"),
  tampered: text("tampered"), // "yes" | "no" | "uncertain"
  fakeId: text("fake_id"),    // "yes" | "no" | "uncertain"

  // Raw structured verdict returned by the analysis model, kept for audit.
  analysis: jsonb("analysis"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIdentityVerificationSchema = createInsertSchema(identityVerificationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertIdentityVerification = z.infer<typeof insertIdentityVerificationSchema>;
export type IdentityVerification = typeof identityVerificationsTable.$inferSelect;
