/**
 * Phase 4 D-16: verify uploaded buffer's magic bytes match the claimed MIME type.
 *
 * Why: route handlers historically trust `File.type` (browser-supplied; trivially
 * forgeable). A `evil.exe` renamed to `image/png` reaches Sharp/Storage before
 * any check fires. Sharp's error then surfaces as a 500, not a 400.
 *
 * sharp.metadata() returns `{ format: 'jpeg' | 'png' | 'webp' | 'gif' | 'svg' | … }`.
 * We coerce the claim to the expected sharp `format` and reject mismatches.
 *
 * Returns:
 *   - { ok: true, format } on match
 *   - { ok: false, reason } on mismatch / unreadable
 */

import sharp from "sharp";

const CLAIMED_TO_SHARP: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type VerifyResult =
  | { ok: true; format: string }
  | { ok: false; reason: string };

export async function verifyImageMime(
  buffer: Buffer,
  claimedMime: string,
): Promise<VerifyResult> {
  const expected = CLAIMED_TO_SHARP[claimedMime?.toLowerCase?.() ?? ""];
  if (!expected) {
    return { ok: false, reason: `unsupported_claimed_mime:${claimedMime}` };
  }
  let detected: string | undefined;
  try {
    const meta = await sharp(buffer).metadata();
    detected = meta.format;
  } catch (err) {
    return {
      ok: false,
      reason: `sharp_metadata_failed:${(err as Error).message?.slice(0, 80) ?? "unknown"}`,
    };
  }
  if (!detected) {
    return { ok: false, reason: "no_format_detected" };
  }
  if (detected !== expected) {
    return {
      ok: false,
      reason: `mime_mismatch:claimed=${claimedMime},detected=${detected}`,
    };
  }
  return { ok: true, format: detected };
}
