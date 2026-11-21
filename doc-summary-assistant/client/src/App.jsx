import React, { useCallback, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const ACCEPTED_EXT = ".pdf,.png,.jpg,.jpeg,.webp";

export default function App() {
  const [file, setFile] = useState(null);
  const [length, setLength] = useState("medium");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleFileSelect = (selected) => {
    setError("");
    setResult(null);
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Unsupported file type. Please upload a PDF, PNG, JPG, or WEBP file.");
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      setError("File too large. Maximum size is 15MB.");
      return;
    }
    setFile(selected);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    handleFileSelect(dropped);
  }, []);

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("document", file);
    formData.append("length", length);

    try {
      const res = await fetch(`${API_BASE}/api/summarize`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="app">
      <header className="header">
        <h1>📄 Document Summary Assistant</h1>
        <p>Upload a PDF or a scanned image and get an instant smart summary.</p>
        <span className="author-tag">Built by Saffana Khan</span>
      </header>

      <main className="main">
        <section
          className={`dropzone ${isDragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXT}
            hidden
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
          />
          {file ? (
            <div className="file-info">
              <strong>{file.name}</strong>
              <span>{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          ) : (
            <div className="dropzone-hint">
              <span className="icon">⬆️</span>
              <p>Drag & drop a PDF or image here, or click to browse</p>
              <small>PDF, PNG, JPG, WEBP — up to 15MB</small>
            </div>
          )}
        </section>

        <div className="controls">
          <label htmlFor="length-select">Summary length</label>
          <select
            id="length-select"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>

          <button className="primary-btn" onClick={handleSubmit} disabled={loading || !file}>
            {loading ? "Processing…" : "Generate Summary"}
          </button>

          {(file || result) && (
            <button className="secondary-btn" onClick={reset} disabled={loading}>
              Reset
            </button>
          )}
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Extracting text and generating your summary — this can take a moment for scanned images…</p>
          </div>
        )}

        {error && <div className="error-box shake-in">⚠️ {error}</div>}

        {result && (
          <section className="result fade-in-up">
            <div className="result-meta">
              <span>📎 {result.fileName}</span>
              <span>{result.wordCount} words extracted</span>
              <span>{result.length} summary</span>
            </div>

            <h2>Summary</h2>
            <p className="summary-text">{result.summary}</p>

            {result.keyPoints?.length > 0 && (
              <>
                <h3>Key Points</h3>
                <ul className="key-points">
                  {result.keyPoints.map((point, i) => (
                    <li key={i} className="stagger-in" style={{ animationDelay: `${i * 0.08}s` }}>
                      {point}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <details className="extracted-text">
              <summary>View full extracted text</summary>
              <p>{result.extractedText}</p>
            </details>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Made with 💛 by Saffana Khan — React + Node/Express + pdf-parse + Tesseract.js</p>
      </footer>
    </div>
  );
}
