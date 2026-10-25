import sharp from "sharp";
import { createHash } from "node:crypto";

export type ProcessedImage = { data: Buffer; thumb: Buffer; sha256: string };

/**
 * Normalises any uploaded image (JPEG/PNG/WebP/…) into:
 *  - `data`:  JPEG, max 1800px, auto-rotated, EXIF kept (camera time / GPS if the phone recorded it)
 *  - `thumb`: JPEG, max 600px, no metadata (lists + compact PDF)
 * Throws if the file is not a decodable image.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const base = sharp(input, { failOn: "none", limitInputPixels: 100_000_000 }).rotate();

  const data = await base
    .clone()
    .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .keepExif()
    .toBuffer();

  const thumb = await base
    .clone()
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();

  return { data, thumb, sha256: createHash("sha256").update(data).digest("hex") };
}
