# 📄 Document Summary Assistant

Upload a PDF or a scanned image and get an instant, smart summary — with adjustable
length (short / medium / long) and auto-extracted key points.

Built for the "Document Summary Assistant" technical assessment.

**Author:** Saffana Khan

---

## Live Demo

- **App:** _add your deployed frontend URL here_
- **API:** _add your deployed backend URL here_
- **Repo:** _add your GitHub repo link here_

---

## Features

- 📤 Drag-and-drop **or** click-to-browse file upload (PDF, PNG, JPG, WEBP)
- 📑 **PDF text extraction** using `pdfjs-dist` (Mozilla's PDF.js)
- 🔍 **OCR for scanned images** using `tesseract.js`, with the English language
  model bundled locally (no runtime CDN download — faster and more reliable)
- ✂️ **Extractive summarization** (short / medium / long) with zero external
  API keys required — runs entirely on your own server for free
- ✅ Key point extraction, word/sentence counts, and a collapsible "full
  extracted text" view
- ⏳ Loading states, drag-active states, and clear error messages throughout
- 📱 Mobile-responsive UI

---

## Tech Stack

| Layer          | Choice                                   |
|----------------|-------------------------------------------|
| Frontend       | React 18 + Vite                           |
| Backend        | Node.js + Express                         |
| PDF parsing    | `pdfjs-dist`                              |
| OCR            | `tesseract.js` (local `eng.traineddata`)  |
| Summarization  | Custom extractive algorithm (see below)   |
| File upload    | `multer`                                  |

---

## Project Structure

```
doc-summary-assistant/
├── server/                 # Express API
│   ├── index.js            # Routes, upload handling, extraction pipeline
│   ├── summarizer.js        # Extractive summarization logic
│   ├── tessdata/            # Locally bundled OCR language data
│   └── uploads/             # Temp storage (files deleted right after processing)
└── client/                  # React (Vite) frontend
    └── src/
        ├── App.jsx           # Upload UI, summary display
        └── index.css         # Styling
```

---

## How Summarization Works (no paid AI API needed)

This project uses an **extractive** approach rather than calling a paid LLM API:

1. Split the extracted text into sentences.
2. Build a word-frequency table (ignoring common stopwords).
3. Score every sentence by how many "important" (high-frequency, meaningful) words it contains.
4. Pick the top-scoring sentences for the requested length, then re-order them
   back into their original sequence so the summary still reads naturally.

This keeps the whole app **free and dependency-free of API keys** — no signup,
no rate limits, no cost. If you want abstractive (rephrased, more fluent)
summaries instead, `server/summarizer.js` is the only file you'd need to swap
out — e.g. for Hugging Face's free Inference API or the Anthropic API.

---

## Running Locally

### 1. Backend

```bash
cd server
npm install
npm start
# API runs on http://localhost:5000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
# App runs on http://localhost:5173 and proxies /api to the backend
```

Open `http://localhost:5173` in your browser.

---

## Deployment

### Backend (needs a persistent Node process — not a static host)

Recommended: **Render** (free tier), Railway, or a Heroku-compatible host.

1. Push this repo to GitHub.
2. Create a new **Web Service** on Render, pointing at the `server/` folder.
   - Build command: `npm install`
   - Start command: `npm start`
3. Note the deployed URL, e.g. `https://your-app.onrender.com`.

> ⚠️ Vercel/Netlify serverless functions have execution time limits and
> read-only filesystems by default, which don't play well with Tesseract's
> worker threads and temp file writes. A standard Node host (Render/Railway/
> Heroku) is the simplest fit for this backend.

### Frontend (static — Netlify or Vercel work great)

1. In `client/`, set the deployed backend URL:
   ```bash
   cp .env.example .env
   # edit .env → VITE_API_URL=https://your-app.onrender.com
   ```
2. Build: `npm run build` (outputs to `client/dist`)
3. Deploy the `dist` folder to Netlify or Vercel (or connect the repo and let
   their build pipeline run `npm run build` automatically, with the env var
   set in their dashboard).

---

## Approach Write-Up (for submission, ~190 words)

I built a full-stack document summarizer using React (Vite) for the frontend
and Node/Express for the backend. Users can drag-and-drop or browse for a PDF
or image. PDFs are parsed with `pdfjs-dist`; scanned images go through OCR via
`tesseract.js`, with the English language model bundled locally rather than
fetched from a CDN at request time, which made OCR both faster and more
reliable in restricted network environments.

For summarization, I chose a frequency-based extractive algorithm over a paid
LLM API: it scores each sentence by the density of meaningful (non-stopword)
terms it contains, then selects the top-scoring sentences for the requested
length while preserving their original order. This keeps the whole app free
to run indefinitely, with no API keys or rate limits, while still producing
genuinely representative summaries plus a "key points" list.

The UI focuses on clear states: drag-active styling, a spinner during
processing (OCR can take a few seconds), and explicit error messages for
unsupported files or unreadable scans. The backend validates file type/size,
deletes uploaded files immediately after processing, and never crashes on a
single bad file thanks to global error handlers around the extraction pipeline.

---

## Notes on Error Handling & Edge Cases

- Unsupported file types (anything but PDF/PNG/JPG/WEBP) are rejected before processing.
- Files over 15MB are rejected client-side and server-side.
- If extracted text is too short/empty (e.g. a blank scan), the API returns a clear 422 error instead of an empty summary.
- Uploaded files are deleted from disk immediately after processing (success or failure) — nothing persists.
