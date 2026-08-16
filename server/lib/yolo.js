/**
 * Thin client for the Python YOLO vision service (server/vision_service.py).
 * Returns findings with normalized boxes in the same shape the frontend expects.
 */

const RAW_VISION_URL = process.env.VISION_URL || 'http://localhost:5070';
// Normalize: VISION_URL may be a full URL or a bare "host:port" from Render's
// fromService hostport property (internal private-network address, plain HTTP).
// Full URLs (e.g. https://mediscan-vision.onrender.com) are kept as-is.
const VISION_URL = /^https?:\/\//i.test(RAW_VISION_URL) ? RAW_VISION_URL : `http://${RAW_VISION_URL}`;

export async function detectWithYolo(buffer, mime = 'image/png') {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), 'scan.jpg');
  const res = await fetch(`${VISION_URL}/detect`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vision service error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function visionHealth() {
  try {
    const res = await fetch(`${VISION_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return await res.json();
  } catch {
    return { status: 'unreachable' };
  }
}