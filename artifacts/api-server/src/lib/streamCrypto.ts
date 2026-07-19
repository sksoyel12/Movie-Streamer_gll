/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *     Ask the project owner for this code before editing.
 *
 * Stream URL Encryption — AES-256-GCM
 *
 * Stream responses return opaque encrypted blobs instead of raw URLs.
 * The client fetches a time-scoped decryption key from /api/auth/stream-key
 * (auth-gated) and decrypts locally — raw URLs never appear in the
 * network inspector as plaintext.
 *
 * Key derivation: HMAC-SHA256(SESSION_SECRET, "<uid>:<hourSlot>")
 * Rotation: keys rotate every hour; we accept the previous hour's key
 * as well to handle boundary cases.
 *
 * Wire format: "<12-byte-iv-hex>:<ciphertext+16-byte-gcm-tag-base64>"
 */

import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto";

const _rawSecret = process.env.SESSION_SECRET;
if (!_rawSecret) {
  throw new Error(
    "SESSION_SECRET environment variable is not set. " +
    "Stream URL encryption requires a strong secret — refusing to start with an insecure default.",
  );
}
const SESSION_SECRET: string = _rawSecret;

/**
 * Key rotation interval: 15 minutes.
 * Keys rotate 4× per hour — a captured key expires in at most 15 minutes.
 * We accept the current slot and up to 2 previous slots for boundary tolerance.
 */
const SLOT_MS = 15 * 60 * 1000; // 15 minutes

// ─── Key derivation ───────────────────────────────────────────────────────────

export function currentSlot(): number {
  return Math.floor(Date.now() / SLOT_MS);
}

/** @deprecated use currentSlot() */
export const currentHourSlot = currentSlot;

export function deriveKey(uid: string, slot?: number): Buffer {
  const s = slot ?? currentSlot();
  return createHmac("sha256", SESSION_SECRET)
    .update(`${uid}:slot${s}`)
    .digest();
}

/** Returns the hex key the client needs to decrypt responses for this uid/slot. */
export function clientKey(uid: string): { key: string; expiresAt: number } {
  const slot      = currentSlot();
  const key       = deriveKey(uid, slot).toString("hex");
  const expiresAt = (slot + 1) * SLOT_MS; // ≤ 15 min from now
  return { key, expiresAt };
}

// ─── Encrypt / decrypt ────────────────────────────────────────────────────────

/**
 * Encrypt a URL string for the given uid.
 * Returns an opaque wire string: "<iv_hex>:<ciphertext+tag_base64>"
 */
export function encryptUrl(url: string, uid: string): string {
  const key = deriveKey(uid);
  const iv  = randomBytes(12); // 96-bit nonce for GCM

  const cipher    = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  const tag       = cipher.getAuthTag(); // 16 bytes

  return `${iv.toString("hex")}:${Buffer.concat([encrypted, tag]).toString("base64")}`;
}

/**
 * Encrypt any JSON-serializable object that may contain URLs.
 * Pass a set of field paths (dot-notation not supported; only top-level keys)
 * that should have their string values encrypted.
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  uid: string,
  fields: (keyof T)[],
): T {
  const result = { ...obj };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === "string" && val.length > 0) {
      (result as Record<string, unknown>)[field as string] = encryptUrl(val, uid);
    }
  }
  return result;
}

/**
 * Encrypt URLs in an array of objects.
 */
export function encryptArrayFields<T extends Record<string, unknown>>(
  arr: T[],
  uid: string,
  fields: (keyof T)[],
): T[] {
  return arr.map((item) => encryptFields(item, uid, fields));
}

/**
 * Decrypt a wire string back to the original URL.
 * Tries current hour and the previous hour (boundary tolerance).
 * Returns null if decryption fails.
 */
export function decryptUrl(enc: string, uid: string): string | null {
  try {
    const colonIdx = enc.indexOf(":");
    if (colonIdx < 0) return null;

    const iv       = Buffer.from(enc.slice(0, colonIdx), "hex");
    const combined = Buffer.from(enc.slice(colonIdx + 1), "base64");
    const tag       = combined.subarray(combined.length - 16);
    const ciphertext = combined.subarray(0, combined.length - 16);

    const slot = currentSlot();
    for (const delta of [0, 1, 2]) { // accept current + 2 previous slots
      try {
        const key = deriveKey(uid, slot - delta);
        const dec = createDecipheriv("aes-256-gcm", key, iv);
        dec.setAuthTag(tag);
        const plain = Buffer.concat([dec.update(ciphertext), dec.final()]).toString("utf8");
        return plain;
      } catch {
        // Wrong key / hour — try next
      }
    }
    return null;
  } catch {
    return null;
  }
}
