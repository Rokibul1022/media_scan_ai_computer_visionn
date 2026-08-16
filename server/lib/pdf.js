import pdf from 'pdf-parse';

export async function extractTextFromPdf(pdfBuffer) {
  try {
    const data = await pdf(pdfBuffer);
    const text = data.text?.trim();
    return text || '[PDF uploaded - no extractable text found]';
  } catch (error) {
    console.error('PDF error:', error.message);
    return `[PDF error: ${error.message}]`;
  }
}