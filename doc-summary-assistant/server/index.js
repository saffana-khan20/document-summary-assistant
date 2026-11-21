const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Tesseract = require("tesseract.js");
const { summarize } = require("./summarizer");

// Safety net: some native/worker libraries (like Tesseract's worker threads)
// can throw asynchronously outside of a promise chain. Without these handlers
// a single bad file could crash the entire server process.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

/**
 * Extracts text from a PDF file using pdfjs-dist (Mozilla's PDF.js).
 * pdfjs-dist ships as an ES module, so we load it with a dynamic import()
 * from this CommonJS file. disableWorker keeps it simple for a Node
 * environment (no browser worker thread needed).
 */
async function extractTextFromPDF(filePath) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- File upload config ---
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
]);

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error("Unsupported file type. Please upload a PDF, PNG, JPG, or WEBP file."));
  },
});

// --- Health check ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Document Summary Assistant API is running" });
});

// --- Main upload + summarize endpoint ---
app.post("/api/summarize", (req, res) => {
  upload.single("document")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const filePath = req.file.path;
    const length = ["short", "medium", "long"].includes(req.body.length)
      ? req.body.length
      : "medium";

    try {
      let extractedText = "";

      if (req.file.mimetype === "application/pdf") {
        extractedText = await extractTextFromPDF(filePath);
      } else {
        // Image file -> OCR via Tesseract.
        // We point langPath at a locally bundled eng.traineddata file instead
        // of letting Tesseract.js download it from a CDN at request time —
        // that download is a common source of flaky/slow first requests and
        // can fail entirely in locked-down hosting environments.
        const { data } = await Tesseract.recognize(filePath, "eng", {
          langPath: path.join(__dirname, "tessdata"),
          gzip: false,
        });
        extractedText = data.text;
      }

      extractedText = (extractedText || "").trim();

      if (!extractedText || extractedText.length < 20) {
        cleanup(filePath);
        return res.status(422).json({
          error:
            "Could not extract readable text from this file. Try a clearer scan or a text-based PDF.",
        });
      }

      const { summary, keyPoints, sentenceCount } = summarize(extractedText, length);

      cleanup(filePath);

      return res.json({
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        length,
        sentenceCount,
        wordCount: extractedText.split(/\s+/).filter(Boolean).length,
        extractedText,
        summary,
        keyPoints,
      });
    } catch (processingError) {
      cleanup(filePath);
      console.error("Processing error:", processingError);
      return res.status(500).json({
        error: "Failed to process the document. Please try again with a different file.",
      });
    }
  });
});

function cleanup(filePath) {
  fs.unlink(filePath, (unlinkErr) => {
    if (unlinkErr) console.warn("Could not delete temp file:", unlinkErr.message);
  });
}

// --- Global error handler (multer errors etc.) ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`Document Summary Assistant API running on http://localhost:${PORT}`);
});
