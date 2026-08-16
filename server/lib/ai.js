import Groq from 'groq-sdk';

// ------------------------------------------------------------------
// Multi-key + multi-model rotation
// If the current Groq key/model hits a rate limit (429) or a 5xx error,
// we automatically fall back to the next key (GROQ_API_KEY_2, ...3),
// then the next model if every key is exhausted. Keeps serving even
// when an individual key's quota runs out.
// ------------------------------------------------------------------

const collect = (name) => {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'your_groq_api_key_here');
};

const KEYS = [
  ...collect('GROQ_API_KEY'),
  ...collect('GROQ_API_KEY_2'),
  ...collect('GROQ_API_KEY_3'),
  ...collect('GROQ_API_KEY_4'),
  ...collect('GROQ_API_KEY_5'),
];

const MODELS = collect('GROQ_MODELS').length
  ? collect('GROQ_MODELS')
  : ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'];

// Vision-capable model used to mark findings directly on scan images
const VISION_MODELS = collect('GROQ_VISION_MODELS').length
  ? collect('GROQ_VISION_MODELS')
  : ['qwen/qwen3.6-27b'];

// Hybrid: some text models may also accept images; adding them here lets the
// vision call fall back to a text model if the dedicated vision model fails.
const VISION_FALLBACK_MODELS = [...VISION_MODELS, ...MODELS];

// clients per key, state per combo
const clients = KEYS.map((k) => new Groq({ apiKey: k }));
const combos = [];
for (let m = 0; m < MODELS.length; m++) {
  for (let k = 0; k < Math.max(clients.length, 1); k++) {
    combos.push({ client: clients[k] || null, model: MODELS[m], keyIndex: k, modelIndex: m });
  }
}

const state = {
  active: 0, // last successfully used combo index
  // key-level cooldown so a rate-limited key isn't hammered
  keyCooldownUntil: [],
};

const COOLDOWN_MS = 60_000; // 60s pause before retrying a throttled key

if (KEYS.length > 0) {
  state.keyCooldownUntil = new Array(KEYS.length).fill(0);
}

function mask(key) {
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function hasValidApiKey() {
  return KEYS.length > 0;
}

export function keyInfo() {
  return {
    keys: KEYS.length,
    keyMasks: KEYS.map(mask),
    models: MODELS,
  };
}

function isRetryableError(err) {
  const status = err?.status;
  const message = String(err?.message || '');
  const has429 = status === 429 || message.includes('429');
  const hasOverload = /overloaded|rate limit|rate_limit|quota|try again/i.test(message);
  const isServerError = status >= 500 && status <= 599;
  // Rotate on rate-limit, overload, and server errors; throw immediately on auth errors
  return has429 || hasOverload || isServerError;
}

function inCooldown(keyIndex) {
  return state.keyCooldownUntil[keyIndex] > Date.now();
}

function markCooldown(keyIndex) {
  state.keyCooldownUntil[keyIndex] = Date.now() + COOLDOWN_MS;
}

/**
 * Run a Groq call with full key+model fallback.
 * @param {(call: {client, model, keyIndex, modelIndex}) => Promise<T>} task
 * @param {string[]} [modelList] optional model rotation list (defaults to MODELS)
 */
async function withFallback(task, modelList = MODELS) {
  if (combos.length === 0) {
    throw new Error('No AI API key configured. Set GROQ_API_KEY in server/.env');
  }

  const activeList = modelList.length ? modelList : MODELS;

  // Build rotation order starting from the last working combo, preferring
  // the same model across fallback keys before rotating the model.
  const candidates = [];
  for (let m = 0; m < activeList.length; m++) {
    for (let k = 0; k < KEYS.length; k++) {
      candidates.push({ client: clients[k], model: activeList[m], keyIndex: k, modelIndex: m });
    }
  }

  let order = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[(state.active + i) % candidates.length];
    if (c.client && !inCooldown(c.keyIndex)) order.push(c);
  }
  // If everything is in cooldown, allow any combo to proceed (limits may have reset)
  if (order.length === 0) order = candidates.filter((c) => c.client);

  let lastError = null;
  for (const c of order) {
    try {
      const result = await task(c);
      state.active = candidates.indexOf(c);
      return result;
    } catch (err) {
      lastError = err;
      if (isRetryableError(err)) {
        console.warn(
          `  🔄 key#${c.keyIndex + 1} (${mask(KEYS[c.keyIndex])}) / ${c.model} hit a limit — trying next…`
        );
        markCooldown(c.keyIndex);
        continue;
      }
      // Auth errors (401/403): mark this key as bad and try the next one
      if (err?.status === 401 || err?.status === 403) {
        console.warn(`  ⚠️  key#${c.keyIndex + 1} auth failed — skipping…`);
        markCooldown(c.keyIndex);
        continue;
      }
      // Any other non-retryable error: throw immediately
      throw normalizeError(err, c);
    }
  }

  // All keys exhausted — if they're all in cooldown, wait for the soonest one and retry once
  const soonest = state.keyCooldownUntil.reduce((min, t) => (t < min ? t : min), Infinity);
  const wait = soonest - Date.now();
  if (wait > 0 && wait < 65_000) {
    console.warn(`  ⏳ All keys in cooldown — waiting ${Math.ceil(wait / 1000)}s then retrying…`);
    await new Promise((r) => setTimeout(r, wait + 200));
    // Reset cooldowns and try once more
    state.keyCooldownUntil.fill(0);
    for (const c of candidates.filter((c) => c.client)) {
      try {
        const result = await task(c);
        state.active = candidates.indexOf(c);
        return result;
      } catch (err) {
        lastError = err;
        if (isRetryableError(err) || err?.status === 401 || err?.status === 403) continue;
        throw normalizeError(err, c);
      }
    }
  }

  if (lastError) {
    throw new Error(`All ${KEYS.length} LLM API key(s) exhausted. Last error: ${lastError.message}`);
  }
  throw new Error('All LLM API keys exhausted.');
}

function normalizeError(err, combo) {
  const m = new Error(`${err.message}`.replace(/^Error:\s*/, ''));
  if (combo) m.message = `LLM (key#${combo.keyIndex + 1}/${combo.model}) failed: ${m.message}`;
  return m;
}

// ------------------------------------------------------------------
// Prompt helpers
// ------------------------------------------------------------------

function jsonPrompt(category, textContent) {
  const catLine =
    category === 'Auto-detect'
      ? 'You are a medical AI assistant. First determine the report category from the content, then analyze it.'
      : `You are a medical AI assistant analyzing a ${category} report.`;
  return `${catLine}

Report content:
${textContent.slice(0, 4000)}

Provide a structured analysis with:
1. SUMMARY: Plain language explanation (3-4 sentences) that a patient can understand
2. CRITICAL_VALUES: List any dangerous or concerning values with severity
3. QUESTIONS: 5 specific questions the patient should ask their doctor
4. MEDICATIONS: Extract any medications mentioned (name, dosage, frequency)
5. KEY_FINDINGS: Important test results or observations

Format your response ONLY as valid JSON:
{
  "summary": "plain text summary",
  "critical_values": [
    {"title": "High Creatinine", "message": "Your kidney function marker is elevated", "severity": "critical"}
  ],
  "questions": ["Question 1?", "Question 2?"],
  "medications": [{"name": "Metformin", "dosage": "500mg", "frequency": "twice daily"}],
  "key_findings": ["finding1", "finding2"]
}`;
}

function extractJson(text) {
  // Strip leading reasoning/thinking blocks some models emit before the JSON.
  let t = String(text || '').replace(/^\s*thinking\s*/i, '');
  t = t.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  const thinkMatch = t.match(/^(thinking|reasoning)[\s\S]*?\n\n/);
  if (thinkMatch) t = t.slice(thinkMatch[0].length);

  // Walk every '{' and try to parse each brace-balanced object. Keeps scanning
  // past prose / thinking blocks even when an earlier balanced object isn't JSON.
  let i = t.indexOf('{');
  while (i !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < t.length; j++) {
      const ch = t[j];
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\' && inStr) {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = !inStr;
      if (!inStr) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(t.slice(i, j + 1));
            } catch {
              break;
            }
          }
        }
      }
    }
    i = t.indexOf('{', i + 1);
  }
  return null;
}

export async function analyzeWithGroq(category, textContent) {
  const content = await withFallback(async ({ client, model }) => {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a medical AI assistant. Always respond with valid JSON only.' },
        { role: 'user', content: jsonPrompt(category, textContent) },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });
    return response.choices[0].message.content;
  });

  const parsed = extractJson(content);
  if (parsed) {
    return {
      summary: parsed.summary || content,
      critical_values: parsed.critical_values || [],
      questions: parsed.questions || [],
      medications: parsed.medications || [],
      key_findings: parsed.key_findings || [],
    };
  }

  return {
    summary: content,
    critical_values: [],
    questions: [
      'What do these results mean for my health?',
      'Do I need any follow-up tests?',
      'Should I make any lifestyle changes?',
      'Are there any medications I should take?',
      'When should I schedule my next checkup?',
    ],
    medications: [],
    key_findings: [],
  };
}

/**
 * Full medical analysis driven by the scan image itself (not just OCR text).
 * Produces the same shape as analyzeWithGroq so image-only uploads (X-rays,
 * scans) get a real, image-based summary instead of a "not enough text" reply.
 */
export async function analyzeScanWithVisionFull({ imageBase64, mime = 'image/jpeg', category = 'Auto-detect', ocrText = '', detectedFindings = [] }) {
  const autoDetected = Array.isArray(detectedFindings)
    ? detectedFindings
        .map((f) => `- ${f.label} (${f.severity || 'info'}, confidence ${f.confidence != null ? Math.round(f.confidence * 100) : '?'}%) near (${f.box ? `${Math.round((f.box.x || 0) * 100)}%,${Math.round((f.box.y || 0) * 100)}%` : '?'})`)
        .join('\n')
    : '';

  const prompt = `You are a medical AI assistant analyzing a medical scan/report image.

Report category: ${category}
${ocrText ? `Text already extracted from this image (use it to cross-check):\n${ocrText.slice(0, 2500)}` : ''}
${
  autoDetected
    ? `An automated detector found these suspicious areas on the image (treat them as likely faults worth describing):\n${autoDetected}`
    : ''
}

Carefully inspect the image. It may be an X-ray, CT, MRI, ultrasound, or a photographed document.
1. Describe what you observe: visible structures (bones, joints, organs, lungs, heart), any fractures, breaks, lesions, opacities, fluid, foreign bodies, or abnormal shapes.
2. Flag any dangerous or concerning findings with a severity level (critical/warning).
3. Write a plain-language summary a patient can understand.

Return ONLY valid JSON with this exact shape:
{
  "summary": "plain language summary of what the scan appears to show",
  "critical_values": [{"title": "short title", "message": "what it means", "severity": "critical|warning"}],
  "questions": ["specific question for the doctor"],
  "medications": [{"name": "name", "dosage": "dose", "frequency": "how often"}],
  "key_findings": ["key observation 1", "key observation 2"]
}

RULES:
- Base the analysis on the VISIBLE image content, never just the OCR text.
- If a fracture, break, opacity, mass or other abnormality is visible, describe it and include it in key_findings and critical_values (severity warning/critical as appropriate).
- If no clear abnormality is visible, say the scan appears unremarkable but always advise confirming with a doctor.
- Never say "insufficient information" when an image is present — analyze the visible anatomy.`;

  const content = await withFallback(
    async ({ client, model }) => {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
      });
      return response.choices[0].message.content;
    },
    VISION_FALLBACK_MODELS
  );

  const parsed = extractJson(content);
  if (parsed) {
    return {
      summary: parsed.summary || content,
      critical_values: parsed.critical_values || [],
      questions: parsed.questions || [],
      medications: parsed.medications || [],
      key_findings: parsed.key_findings || [],
    };
  }
  return {
    summary: content,
    critical_values: [],
    questions: [],
    medications: [],
    key_findings: [],
  };
}

export async function chatWithGroq({ messages, context, systemContext }) {
  let systemPrompt =
    'You are a helpful medical AI assistant. Explain medical concepts in simple terms. Always remind users to consult their doctor for medical advice.';

  if (context) {
    systemPrompt += `\n\nCurrent report context:\n${context}`;
  }
  if (systemContext) {
    systemPrompt += `\n\n${systemContext}`;
  }

  const groqMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  return withFallback(async ({ client, model }) => {
    const response = await client.chat.completions.create({
      model,
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 900,
    });
    return response.choices[0].message.content;
  });
}

// ------------------------------------------------------------------
// Vision: mark findings directly on a scan image
// ------------------------------------------------------------------

/**
 * Analyzes a medical scan/report image and returns detected abnormalities
 * with normalized bounding boxes (0–1) so the frontend can draw markers.
 */
export async function analyzeScanWithVision({ imageBase64, mime = 'image/jpeg', category, ocrText }) {
  const prompt = `You are analyzing a medical scan/report image.

${
  category && category !== 'Auto-detect'
    ? `Report category: ${category}`
    : 'Determine the report category yourself from the image content.'
}
${
  ocrText
    ? `Text already extracted from this image (use it to cross-check findings):\n${ocrText.slice(0, 1500)}`
    : ''
}

Carefully inspect the image. Identify any visible abnormalities, suspicious regions, broken/irregular areas, or important text regions and describe them. Also provide a plain-language overall note.

Return ONLY valid JSON with this exact shape:
{
  "overall_note": "short plain-language note about what was seen",
  "detected_category": "the most likely report category, or 'Unknown'",
  "findings": [
    {
      "label": "short label of the finding",
      "description": "what it looks like and why it matters",
      "severity": "critical | warning | info",
      "confidence": 0.0 to 1.0,
      "box": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 }
    }
  ]
}

RULES:
- box coordinates are normalized to image dimensions: x,y are the top-left corner, width/height are size; all values between 0 and 1.
- Be conservative: only report something as a fault if it is clearly visible.
- If the image looks normal, return findings: [] with severity "info" note.`;

  const content = await withFallback(async ({ client, model }) => {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content;
  }, VISION_FALLBACK_MODELS);

  const parsed = extractJson(content);
  if (!parsed) {
    return { overall_note: 'Scan analyzed (no structured findings returned).', detected_category: null, findings: [] };
  }

  const findings = Array.isArray(parsed.findings)
    ? parsed.findings
        .map((f) => ({
          label: f.label || 'Detected area',
          description: f.description || '',
          severity: ['critical', 'warning', 'info'].includes(f.severity) ? f.severity : 'info',
          confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : null,
          box: {
            x: clamp01(f.box?.x),
            y: clamp01(f.box?.y),
            width: clamp01(f.box?.width),
            height: clamp01(f.box?.height),
          },
        }))
        .filter((f) => f.box.width > 0.005 && f.box.height > 0.005)
    : [];

  return {
    overall_note: parsed.overall_note || 'Scan analyzed.',
    detected_category: parsed.detected_category || null,
    findings,
  };
}

function clamp01(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}