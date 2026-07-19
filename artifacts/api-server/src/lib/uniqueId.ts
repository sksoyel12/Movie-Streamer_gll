import { randomBytes } from "crypto";

/**
 * Generates a non-sequential, 8-character alphanumeric user ID.
 *
 * Alphabet excludes visually ambiguous characters (0/O, 1/I/L) so IDs are
 * easy to read aloud or type in for support/referral purposes.
 * Cryptographically random — never derived from a counter or timestamp.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateUniqueUserId(length = 8): string {
  const bytes = randomBytes(length);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}
