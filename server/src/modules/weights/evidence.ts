import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from '../../middleware/errors';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
/** Big enough to read the digits on a scale, small enough to store cheaply. */
const MAX_SIDE = 2048;

/**
 * Checks the real image type from its bytes and re-encodes it, which drops all metadata
 * (GPS location of a photo taken at home, camera details).
 */
export async function processEvidence(input: Buffer) {
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new HttpError(415, 'unsupported_image');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) throw new HttpError(415, 'unsupported_image');

  let image: Buffer;
  try {
    image = await sharp(input, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    // Recognised as an image but can't be decoded: a damaged or disguised file.
    throw new HttpError(415, 'unsupported_image');
  }
  return { image, sha256: createHash('sha256').update(image).digest('hex') };
}
