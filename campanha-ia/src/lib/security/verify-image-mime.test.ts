import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { verifyImageMime } from "./verify-image-mime";

async function makePng(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
}

async function makeJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 255, b: 0 } },
  }).jpeg().toBuffer();
}

describe("verifyImageMime (D-16)", () => {
  it("accepts real PNG claimed as image/png", async () => {
    const buf = await makePng();
    const r = await verifyImageMime(buf, "image/png");
    expect(r.ok).toBe(true);
  });

  it("rejects PNG buffer claimed as image/jpeg (mismatch)", async () => {
    const buf = await makePng();
    const r = await verifyImageMime(buf, "image/jpeg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/mime_mismatch/);
  });

  it("rejects junk buffer claimed as image/png", async () => {
    const buf = Buffer.from("MZ\x90\x00not-a-png-just-fake-exe-header");
    const r = await verifyImageMime(buf, "image/png");
    expect(r.ok).toBe(false);
  });

  it("rejects unsupported claimed MIME", async () => {
    const buf = await makePng();
    const r = await verifyImageMime(buf, "application/octet-stream");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unsupported_claimed_mime/);
  });

  it("accepts JPEG claimed as image/jpg (alias)", async () => {
    const buf = await makeJpeg();
    const r = await verifyImageMime(buf, "image/jpg");
    expect(r.ok).toBe(true);
  });
});
