import { createWorker } from 'tesseract.js';

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress >= 0.1 && m.progress <= 0.9) {
          process.stdout.write(`\rOCR: ${Math.round(m.progress * 100)}%`);
        }
      },
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function extractTextFromImage(imageBuffer) {
  try {
    const worker = await getWorker();
    process.stdout.write('\n  Running OCR...');
    const { data } = await worker.recognize(imageBuffer);
    process.stdout.write('\r');
    const text = data.text.trim();
    return text || '[Image uploaded - OCR found no text]';
  } catch (error) {
    console.error('\nOCR error:', error.message);
    return `[Image uploaded - OCR error: ${error.message}]`;
  }
}

export async function terminateWorker() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}