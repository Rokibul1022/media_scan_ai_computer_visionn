# MediScan AI 🩺

AI-powered medical report analyzer that converts complex medical reports into plain-language
summaries with critical-value alerts, doctor questions, and audio output.
**Deployed Link:** - https://reportscan.netlify.app/
**Fully rewritten** as a modern, deployable **React + Node.js** stack (was vanilla JS + Python/FastAPI).

## ✨ Highlights

- 🎨 **Animated React frontend** — Framer Motion landing page with a hero section, animated blobs,
  floating mockups, scroll-reveal sections, animated counters and page transitions.
- 🧠 **Groq AI analysis** — structured summaries, critical alerts, medications, key findings and
  doctor questions.
- 🔍 **OCR extraction** — `tesseract.js` pulls text from scanned images and PDFs (`pdf-parse`).
- 💬 **AI assistant chat** with medical / mental-health / voice-note modes.
- 🧰 Health tools: BMI, biological age, cost estimator, hospital finder, organ health dashboard.
- 🔊 Listen to summaries via browser speech synthesis. Export results as TXT or PDF (jsPDF).

## 🏗 Tech Stack

| Layer    | Tech                                             |
| -------- | ------------------------------------------------ |
| Frontend | React 19, Vite 8, React Router 7, Framer Motion  |
| Backend  | Node.js, Express, multer, groq-sdk               |
| OCR/PDF  | tesseract.js, pdf-parse                          |
| Deploy   | Single Node server serves the built React app    |

## 📁 Structure

```
medi_scanner/
├── client/            # React frontend (Vite)
│   └── src/
│       ├── pages/     # Landing, Analyze, Results, Chat, Tools, About
│       ├── components/# Navbar, Footer, Motion helpers
│       └── context/   # Theme + analysis state
├── server/            # Express API
│   ├── index.js       # Routes + production static serving
│   └── lib/           # ai.js (Groq), ocr.js (tesseract), pdf.js
├── package.json       # npm workspaces (client + server)
└── .env.example
```

## 🚀 Getting Started

### 1. Install

```bash
npm install
```

### 2. Set your API key(s)

```bash
cp server/.env.example server/.env
# edit server/.env and set GROQ_API_KEY=your_key_here
```

Get a free key at [console.groq.com](https://console.groq.com/keys).

**Multi-key auto-fallback (never hits limits):** the backend automatically rotates between several
Groq keys/models when one is rate-limited. Add fallback keys in `server/.env`:

```
GROQ_API_KEY=gsk_...your primary key...
GROQ_API_KEY_2=gsk_...first fallback key...
GROQ_API_KEY_3=gsk_...second fallback key...
GROQ_MODELS=llama-3.3-70b-versatile,meta-llama/llama-4-scout-17b-16e-instruct
```

On a rate-limit (429), invalid/expired key (401/403) or server error (5xx), it switches to the next
key — and if all keys are exhausted it rotates to the next model. Working key/model combos are
remembered and reused. Check `/api/health` to see configured keys (masked).

### 3. Set up the YOLO fault detector (one time)

Scan images are checked by a YOLOv8 fracture detector that runs in a Python venv. It marks faults
(bounding boxes) directly on your X-ray and falls back to OpenCV heuristics when no fracture is found.

```bash
npm run vision:setup     # creates server/venv + installs deps (torch, ultralytics, opencv)
# downloads a pretrained fracture model into server/models/
```

The model weights (`.pt`) are loaded lazily on the first request. If the Python service is down,
the app degrades gracefully to the AI vision model only.

### 4. Run in development

```bash
npm run dev              # starts API (5050), vision service (5070) and frontend (5173)
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5050
- Vision service: http://localhost:5070

Run the vision service on its own if needed:

```bash
npm run vision
```

### 5. Production build & run

```bash
npm run build        # builds client/ to client/dist
npm start            # Express serves the API + built frontend on :5050
```

Open http://localhost:5050 — a single process serves everything.

## 🌍 Deploying

### Option A — Netlify (frontend) + Render (backend) — recommended

This is the split setup: Netlify serves the React app, Render runs the Node API
and the Python vision service.

**1. Push to GitHub**

The repo already ships `netlify.toml`, `render.yaml`, `.nvmrc` and `start.sh`, so
both platforms pick up their config automatically.

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/you/mediscan-ai.git
git push -u origin main
```

> The YOLO model (`server/models/yolov8_fracture_best.pt`) is committed so fault
> detection works in production. If you'd rather not track it, delete
> `server/models/` from git and the app still runs — it just falls back to the
> OpenCV + AI vision detector.

**2. Backend → Render**

- New → Blueprint → select the repo. Render reads `render.yaml` and creates two
  services automatically:
  - `mediscan-api` (Node/Express) — the API the frontend calls
  - `mediscan-vision` (Python YOLO/OpenCV) — X-ray fault marking
- Set the secret env vars on `mediscan-api` (never commit them):
  `GROQ_API_KEY`, `GROQ_API_KEY_2`, `GROQ_API_KEY_3`, `GROQ_MODELS`,
  `GROQ_VISION_MODELS`. `VISION_URL` is auto-filled over Render's private
  network — both services must be in the **same workspace and region**. If
  that doesn't connect (or to be extra safe), set `VISION_URL` manually in
  the dashboard to `https://mediscan-vision.onrender.com` (the API accepts
  either a full URL or the injected `host:port`).
- Use the **Standard** plan (2 GB RAM) or higher for `mediscan-vision` —
  Render has no GPU, so YOLO runs on CPU, and torch needs memory. On
  Free/Starter (512 MB) it can OOM; if it does, the app degrades gracefully
  to AI-vision-only marking.
- Note the API URL, e.g. `https://mediscan-api.onrender.com`.

**3. Frontend → Netlify**

- New site from Git → select the repo. Netlify reads `netlify.toml`:
  build `npm install && npm run build`, publish `client/dist`.
- Add the build-time env var so the app calls Render:
  `VITE_API_URL = https://mediscan-api.onrender.com/api`
  (note: it must end in `/api` — the client appends `/analyze`, `/chat`, ...)
- (Fallback: if `VITE_API_URL` is unset, the `netlify.toml` proxy forwards
  `/api/*` to the Render URL — update that URL to yours.)

**4. Done.** Open your Netlify URL. CORS already allows any origin in production.

### Option B — Single service (Railway / Render / Fly / VPS)

One process serves the API, the built frontend and the vision service.

1. `npm install`
2. `npm run build`
3. Start with `./start.sh` (Node + Python vision together), or if you skip the
   vision service: `npm start` — the app then uses AI-vision marking only.

Render/Railway build settings:

```
build:   npm install && npm run build && pip install -r server/requirements-vision.txt
start:   ./start.sh
```

Set env vars: `PORT`, `GROQ_API_KEY`, `NODE_ENV=production`.

### Alternative frontend hosting

You can also serve `client/dist` on Vercel/Netlify and point it at a separately
hosted API by setting `VITE_API_URL` during build.

## 🔌 API Endpoints

| Method | Path          | Description                                    |
| ------ | ------------- | ---------------------------------------------- |
| POST   | `/api/analyze`| Multipart: `category`, `text`, `files[]`       |
| POST   | `/api/chat`   | JSON: `{ messages[], context, system_context }`|
| GET    | `/api/health` | Service health + AI key status                 |
| GET    | `/api/config` | Whether the AI key is configured               |

## ⚠️ Notes

- OCR (tesseract.js) downloads its language data + WASM on first use; the training data is cached
  after that.
- The AI response is educational, not medical advice — always confirm with a healthcare professional.
- API keys live only in the backend (`.env`), never shipped to the client.

## 🧪 Legacy files

The pre-rewrite vanilla JS (`index.html`, `app.js`, `app_advanced.js`, `chat.js`, `tools.js`,
`style.css`, `pricing.html`) and Python backend (`server.py`, `server_advanced.py`, etc.) are kept
for reference under the old names at the repo root.
