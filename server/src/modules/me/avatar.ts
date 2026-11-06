import sharp from 'sharp';
import { HttpError } from '../../middleware/errors';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
export const AVATAR_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Checks the real image type from its bytes (not the file name) and re-encodes it.
 * Re-encoding drops all metadata, including GPS location from phone photos.
 */
export async function processAvatar(input: Buffer): Promise<Buffer> {
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new HttpError(415, 'unsupported_image');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) throw new HttpError(415, 'unsupported_image');

  return sharp(input, { limitInputPixels: 40_000_000 })
    .rotate() // apply EXIF orientation before the metadata is dropped
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();
}
