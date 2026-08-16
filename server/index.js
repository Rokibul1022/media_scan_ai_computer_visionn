import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { analyzeWithGroq, chatWithGroq, hasValidApiKey, keyInfo, analyzeScanWithVision, analyzeScanWithVisionFull } from './lib/ai.js';
import { prepareVisionImage, classifyImage } from './lib/image.js';
import { detectWithYolo, visionHealth } from './lib/yolo.js';
import { extractTextFromImage, terminateWorker } from './lib/ocr.js';
import { extractTextFromPdf } from './lib/pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Dedup helpers (prevent duplicate warnings/findings) ----------

function iou(a, b) {
  const ax1 = a.box.x, ay1 = a.box.y, ax2 = a.box.x + a.box.width, ay2 = a.box.y + a.box.height;
  const bx1 = b.box.x, by1 = b.box.y, bx2 = b.box.x + b.box.width, by2 = b.box.y + b.box.height;
  const iw = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const ih = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const inter = iw * ih;
  const aArea = Math.max(0.0001, a.box.width * a.box.height);
  const bArea = Math.max(0.0001, b.box.width * b.box.height);
  return inter / (aArea + bArea - inter);
}

// Merge near-identical bounding boxes (same label + heavy overlap) into one.
function dedupeFindings(findings) {
  const kept = [];
  for (const f of findings || []) {
    const label = (f.label || 'area').toLowerCase().trim();
    let merged = false;
    for (let i = 0; i < kept.length; i++) {
      const k = kept[i];
      if (k.box && f.box && k.label.toLowerCase().trim() === label && iou(k, f) > 0.45) {
        if ((k.confidence ?? 0) < (f.confidence ?? 0)) kept[i] = f;
        merged = true;
        break;
      }
    }
    if (!merged) kept.push(f);
  }
  return kept;
}

function dedupeByTitle(arr) {
  const seen = new Set();
  return (arr || []).filter((a) => {
    const k = String(a.title || a || '').toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function dedupeStrings(arr) {
  const seen = new Set();
  return (arr || []).filter((s) => {
    const k = String(s || '').trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function dedupeMedications(arr) {
  const seen = new Set();
  return (arr || []).filter((m) => {
    const key = String(m.name || m.dosage || m.frequency || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const app = express();
const PORT = process.env.PORT || 5050;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// ---------- Middleware ----------
app.use(express.json({ limit: '10mb' }));

app.use(
  cors({
    origin: NODE_ENV === 'production' ? true : [CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ---------- API Routes ----------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MediScan AI API',
    version: '3.0.0',
    ai: hasValidApiKey() ? 'configured' : 'api_key_missing',
    keys: keyInfo().keys,
    key_masks: keyInfo().keyMasks,
    models: keyInfo().models,
  });
});

app.get('/api/vision', async (req, res) => {
  const health = await visionHealth();
  res.json({ service: 'yolo', ...health });
});

app.post('/api/analyze', upload.array('files', 5), async (req, res) => {
  const category = req.body.category || 'Auto-detect';
  const text = req.body.text || '';
  const files = req.files || [];

let extractedText = text;
    let scanImageBase64 = null; // first image, used for scan fault-marking
    let scanImageBuffer = null; // original image bytes, used for YOLO detection
    let scanImageMime = 'image/png';
    let visionInput = null; // downscaled, token-cheap image for the vision model
    let firstImageOcr = ''; // OCR text of the first image, used to tell reports from scans

  try {
    for (const file of files) {
      if (!file || !file.buffer) continue;

      const filename = (file.originalname || '').toLowerCase();
      const ext = filename.split('.').pop();

      if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename) || ext === 'jpg') {
        if (!scanImageBase64 && file.buffer.length < 9 * 1024 * 1024) {
          scanImageBase64 = file.buffer.toString('base64');
        }
        if (!scanImageBuffer) {
          scanImageBuffer = file.buffer;
          scanImageMime = file.mimetype || `image/${ext === 'jpg' ? 'jpeg' : ext || 'png'}`;
        }
        if (!visionInput) {
          visionInput = await prepareVisionImage(file.buffer);
        }
        const ocrText = await extractTextFromImage(file.buffer);
        if (!firstImageOcr) firstImageOcr = ocrText;
        extractedText += `\n${ocrText}`;
      } else if (!filename || /\.pdf$/i.test(filename) || file.mimetype === 'application/pdf') {
        const pdfText = await extractTextFromPdf(file.buffer);
        extractedText += `\n${pdfText}`;
      } else {
        // Try OCR for any other binary file type (scans etc.)
        const ocrText = await extractTextFromImage(file.buffer);
        extractedText += `\n${ocrText}`;
      }
    }

    // For a pure image upload (no text typed), keep the analysis meaningful.
    if (!text.trim() && scanImageBase64 && !extractedText.trim()) {
      extractedText = 'Please analyze this medical scan/report image.';
    }

    let finalCategory = category;

    // Decide whether the uploaded image is a text report (read-only, OCR +
    // text analysis) or a medical scan / X-ray (fault-marking). A document is
    // a bright-background image whose OCR returned real text; an X-ray is dark
    // and yields little text, so it must be scanned.
    let isDocument = false;
    if (scanImageBuffer) {
      const ocrLen = firstImageOcr.replace(/\[Image uploaded[^\]]*\]/g, '').trim().length;
      const imgClass = await classifyImage(scanImageBuffer);
      isDocument = imgClass.type === 'document' && ocrLen >= 15;
    }

    // Vision scan analysis (only for scans — reports are read, not marked)
    let scanFindings = [];
    let scanNote = null;
    let visionDetected = null;
    let detectEngine = null;
    if (visionInput && !isDocument) {
      try {
        const vision = await analyzeScanWithVision({
          imageBase64: visionInput.base64,
          mime: visionInput.mime,
          category: category === 'Auto-detect' ? 'Auto-detect' : category,
          ocrText: extractedText === 'Please analyze this medical scan/report image.' ? '' : extractedText,
        });
        scanFindings = vision.findings || [];
        scanNote = vision.overall_note || null;
        visionDetected = vision.detected_category || null;
        if (category === 'Auto-detect' && visionDetected && visionDetected !== 'Unknown') {
          finalCategory = visionDetected;
        }
      } catch (visionErr) {
        console.warn('Vision scan analysis skipped:', visionErr.message);
      }
    }

    // YOLO fault detection (Python vision service) — primary fault locator.
    // Real bounding boxes beat the LLM's guesses, so YOLO findings win when present.
    if (scanImageBuffer && !isDocument) {
      try {
        const yolo = await detectWithYolo(scanImageBuffer, scanImageMime);
        if (yolo.image_type === 'document') {
          isDocument = true;
        } else if (Array.isArray(yolo.findings) && yolo.findings.length > 0) {
          scanFindings = yolo.findings;
          scanNote = yolo.note || scanNote;
          detectEngine = yolo.engine || 'yolo';
        }
      } catch (yoloErr) {
        console.warn('YOLO detection skipped:', yoloErr.message);
      }
    }

    const effectiveText =
      extractedText === 'Please analyze this medical scan/report image.'
        ? `This is a ${finalCategory} scan. Please analyze the image and the following OCR text: ${extractedText}`
        : extractedText || 'No text extracted.';

    if (!scanImageBase64 && !effectiveText.trim()) {
      return res.status(400).json({ error: 'No text content found. Please upload a file with text or enter text manually.' });
    }

    // When a scan image is present, drive the analysis from the image itself so
    // X-rays get a real visual summary instead of a "not enough text" reply.
    // Pass the YOLO findings so the summary stays consistent with what's marked.
    // Reports (documents) are analyzed from their extracted text instead.
    let analysis = null;
    if (visionInput && !isDocument) {
      try {
        analysis = await analyzeScanWithVisionFull({
          imageBase64: visionInput.base64,
          mime: visionInput.mime,
          category: finalCategory,
          ocrText: effectiveText === 'Please analyze this medical scan/report image.' ? '' : effectiveText,
          detectedFindings: scanFindings,
        });
      } catch (visionFullErr) {
        console.warn('Image-based analysis failed, falling back to text:', visionFullErr.message);
        analysis = null;
      }
    }

    // Fallback: text-only analysis (paste text / PDFs / documents / no usable image model)
    if (!analysis) {
      analysis = await analyzeWithGroq(finalCategory, effectiveText);
    }

    // Only attach the image payload when it's reasonably small to keep the response light,
    // and never for reports — a document is read, not marked with fault boxes.
    const attachImage = scanImageBase64 && !isDocument && scanImageBase64.length < 12 * 1024 * 1024;

    return res.json({
      category: finalCategory,
      auto_detected: category === 'Auto-detect',
      extracted_text: effectiveText,
      summary: analysis.summary,
      critical_values: dedupeByTitle(analysis.critical_values),
      questions: dedupeStrings(analysis.questions),
      medications: dedupeMedications(analysis.medications),
      key_findings: dedupeStrings(analysis.key_findings),
      scan_findings: isDocument ? [] : dedupeFindings(scanFindings),
      scan_note: isDocument ? null : scanNote,
      detect_engine: scanImageBuffer && !isDocument ? detectEngine : null,
      analyzed_at: new Date().toISOString(),
      ...(attachImage ? { scan_image: `data:image/png;base64,${scanImageBase64}` } : {}),
    });
  } catch (error) {
    console.error('Analyze error:', error);
    return res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], context = null, system_context } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ response: 'Please provide a message.' });
    }

    const response = await chatWithGroq({ messages, context, systemContext: system_context });
    return res.json({ response });
  } catch (error) {
    console.error('Chat error:', error.message);
    return res.status(500).json({ response: `Error: ${error.message}` });
  }
});

app.get('/api/config', (req, res) => {
  res.json({ aiConfigured: hasValidApiKey() });
});

// ---------- Static frontend ----------
// Serves the built React app whenever client/dist exists (after `npm run build`).
// This lets `npm run build && npm start` run the whole app on a single port.
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`Serving frontend from ${clientDist}`);
}

app.listen(PORT, () => {
  console.log(`\n® MediScan AI API running on http://localhost:${PORT}`);
  console.log(`  Mode: ${NODE_ENV}`);
  console.log(`  AI: ${hasValidApiKey() ? 'LLM configured' : 'warning: AI API key not set (set it in server/.env)'}\n`);
});

// Graceful shutdown - terminate tesseract worker
process.on('SIGINT', async () => {
  await terminateWorker();
  process.exit(0);
});