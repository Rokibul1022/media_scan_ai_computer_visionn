import { Jimp } from 'jimp';

const MAX_DIM = 800; // largest side after downscale
const JPEG_QUALITY = 82;

/**
 * Prepares an image buffer for a vision-model request by downscaling to a
 * reasonable size and re-encoding as JPEG. This keeps the base64 payload (and
 * therefore the token / rate-limit cost) low.
 *
 * @param {Buffer} buffer original image bytes
 * @returns {{ base64: string, mime: string }} JPEG base64 for the vision call
 */
export async function prepareVisionImage(buffer) {
  try {
    const image = await Jimp.read(buffer);
    if (image.width > MAX_DIM || image.height > MAX_DIM) {
      image.scaleToFit(MAX_DIM, MAX_DIM);
    }
    const out = await image.getBuffer('image/jpeg', { quality: JPEG_QUALITY });
    return { base64: out.toString('base64'), mime: 'image/jpeg' };
  } catch (error) {
    console.warn('Image prep failed, sending original:', error.message);
    return { base64: buffer.toString('base64'), mime: 'image/jpeg' };
  }
}

/**
 * Cheap heuristic that tells a scanned text document (bright background with
 * sparse dark text) apart from a medical scan / X-ray (dark background).
 * @param {Buffer} buffer original image bytes
 * @returns {{ type: 'document'|'scan', stats: { mean: number, white: number, dark: number } }}
 */
export async function classifyImage(buffer) {
  try {
    const image = await Jimp.read(buffer);
    const w = image.width;
    const h = image.height;
    if (!w || !h) return { type: 'scan', stats: null };

    const stepX = Math.max(1, Math.floor(w / 48));
    const stepY = Math.max(1, Math.floor(h / 48));
    let sum = 0;
    let white = 0;
    let dark = 0;
    let n = 0;
    for (let y = 0; y < h; y += stepY) {
      for (let x = 0; x < w; x += stepX) {
        const idx = image.getPixelIndex(x, y);
        const r = image.bitmap.data[idx];
        const g = image.bitmap.data[idx + 1];
        const b = image.bitmap.data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += lum;
        if (lum > 200) white++;
        else if (lum < 45) dark++;
        n++;
      }
    }
    const mean = sum / n;
    const whiteFrac = white / n;
    const darkFrac = dark / n;
    const type = mean > 130 && whiteFrac > 0.3 ? 'document' : 'scan';
    return { type, stats: { mean: Math.round(mean), white: +whiteFrac.toFixed(3), dark: +darkFrac.toFixed(3) } };
  } catch (error) {
    console.warn('Image classification failed, assuming scan:', error.message);
    return { type: 'scan', stats: null };
  }
}