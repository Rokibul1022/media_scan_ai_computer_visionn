import { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { categories } from '../data.js';
import { analyzeReport } from '../api.js';
import { useApp } from '../context/AppContext.jsx';
import { Reveal } from '../components/Motion.jsx';
import ResultView from '../components/ResultView.jsx';

const analyzingSteps = [
  { text: 'Uploading your files', done: 'Files uploaded' },
  { text: 'Extracting text with OCR', done: 'Text extracted' },
  { text: 'Analyzing with LLM AI', done: 'Analysis complete' },
  { text: 'Scanning your report', done: 'Report scanned' },
];

const AUTO = { name: 'Auto-detect', icon: '✨', isAuto: true };

export default function Analyze() {
  const { setCurrentAnalysis } = useApp();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  const hasImage = files.some((f) => f.type.startsWith('image/'));
  const previewFile = files.find((f) => f.type.startsWith('image/'));
  const previewUrl = useMemo(() => (previewFile ? URL.createObjectURL(previewFile) : null), [previewFile]);

  useEffect(() => {
    if (result) {
      const t = setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      return () => clearTimeout(t);
    }
  }, [result]);

  const handleFiles = (list) => {
    const next = Array.from(list).filter(
      (f) => /image|pdf/.test(f.type) || /\.(jpg|jpeg|png|pdf|webp|gif|bmp)$/i.test(f.name)
    );
    setFiles((prev) => [...prev, ...next].slice(0, 5));
  };

  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const clearAll = () => {
    setFiles([]);
    setText('');
    setSelectedCategory(null);
    setError(null);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runAnalysis = async () => {
    if (files.length === 0 && !text.trim()) {
      setError('Upload a file or paste report text first.');
      return;
    }

    setError(null);
    setResult(null);
    setAnalyzing(true);
    setStep(0);
    // Files uploaded → OCR → AI analysis → scan fault-marking
    const delays = [0, 1200, 2600, 4200];
    delays.forEach((t, i) => setTimeout(() => setStep(i), t));

    try {
      const categoryName = selectedCategory?.isAuto ? 'Auto-detect' : selectedCategory?.name || 'Auto-detect';
      const res = await analyzeReport({ category: categoryName, text, files });
      setCurrentAnalysis(res);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const categorySelected = (cat) => {
    setSelectedCategory(cat);
    setError(null);
  };

  return (
    <div>
      <div className="page-hero compact">
        <Reveal>
          <h2>Analyze your medical report</h2>
          <p>Pick a category on the left, then upload or paste — AI turns it into clear insights in seconds.</p>
        </Reveal>
      </div>

      <div className="container">
        <Reveal delay={0.05}>
          <div className="analyze-layout">
            {/* Left · category panel */}
            <aside className="analyze-sidebar">
              <div className="sidebar-head">
                <strong>📋 Report type</strong>
                <span>Pick the closest match</span>
              </div>
              <div className="sidebar-cats">
                <motion.button
                  className={`side-cat ${!selectedCategory || selectedCategory.isAuto ? 'selected' : ''}`}
                  onClick={() => categorySelected(AUTO)}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="side-cat-icon">✨</span>
                  <span className="side-cat-name">Auto-detect</span>
                  {(!selectedCategory || selectedCategory.isAuto) && <span className="side-cat-check">✓</span>}
                </motion.button>
                {categories.map((cat) => {
                  const selected = selectedCategory?.name === cat.name && !selectedCategory?.isAuto;
                  return (
                    <motion.button
                      key={cat.name}
                      className={`side-cat ${selected ? 'selected' : ''}`}
                      onClick={() => categorySelected(cat)}
                      whileTap={{ scale: 0.97 }}
                    >
                      <span className="side-cat-icon">{cat.icon}</span>
                      <span className="side-cat-name">{cat.name}</span>
                      {selected && <span className="side-cat-check">✓</span>}
                    </motion.button>
                  );
                })}
              </div>
            </aside>

            {/* Right · chatbot */}
            <div className="analyze-chat">
              {/* Chat header */}
              <div className="analyze-chat-header">
                <div className="chat-avatar">🩺</div>
                <div>
                  <strong>MediScan Assistant</strong>
                  <span>AI analysis · private & secure</span>
                </div>
              </div>

              <div className="analyze-chat-body">
                {/* AI asks for category */}
                <div className="analyze-ai-msg">
                  <div className="msg-bubble">
                    <strong>What type of report is this?</strong>
                    <p>Pick a category from the left panel, or let me auto-detect it from the content.</p>
                  </div>
                </div>

                {/* User "replies" with chosen category */}
              <AnimatePresence>
                {selectedCategory && (
                  <motion.div
                    className="analyze-user-msg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <div className="msg-bubble">
                      {selectedCategory.icon} {selectedCategory.name}
                      {selectedCategory.isAuto && <small> · AI will detect the category</small>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI asks for upload */}
              <div className="analyze-ai-msg">
                <div className="msg-bubble">
                  <strong>Upload your report</strong>
                  <p>Add a scan, image or PDF — or paste the report text below.</p>
                </div>
              </div>

              {/* Upload button only */}
              <div className="upload-row">
                <motion.button
                  className="upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  whileTap={{ scale: 0.97 }}
                  disabled={analyzing}
                >
                  <span>📂</span> {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Choose files'}
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  hidden
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              {hasImage && !analyzing && (
                <motion.div
                  className="alert-card info"
                  style={{ borderLeft: '4px solid #22d3ee', background: 'var(--gradient-soft)' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="alert-icon" style={{ fontSize: '1.2rem' }}>🎯</span>
                  <div>
                    <strong>Scanning enabled</strong>
                    <p>AI will scan your upload and detect any faults in the image.</p>
                  </div>
                </motion.div>
              )}

              {/* File chips */}
              <AnimatePresence>
                {files.length > 0 && (
                  <motion.div
                    className="file-list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {files.map((f, i) => (
                      <motion.span key={`${f.name}-${i}`} className="file-chip" layout>
                        {f.type.startsWith('image/') ? (
                          <>
                            <img
                              src={URL.createObjectURL(f)}
                              alt=""
                              style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }}
                            />
                            {f.name}
                          </>
                        ) : (
                          <>
                            <span>📄</span>
                            {f.name}
                          </>
                        )}
                        <button onClick={() => removeFile(i)} aria-label="remove">✕</button>
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input + send (like chat) */}
              <div className="analyze-input-row">
                <textarea
                  className="chat-input"
                  rows={1}
                  placeholder={hasImage ? 'Optional — paste any report text…' : 'Paste report text here…'}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      runAnalysis();
                    }
                  }}
                />
                <motion.button
                  className="send-btn"
                  onClick={runAnalysis}
                  disabled={analyzing || (files.length === 0 && !text.trim())}
                  aria-label="Analyze"
                  whileTap={{ scale: 0.92 }}
                >
                  {analyzing ? '⏳' : hasImage ? '⚡' : '➤'}
                </motion.button>
              </div>

              {error && (
                <motion.div
                  className="error-box"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              <div className="analyze-actions" style={{ justifyContent: 'center', marginTop: '0.2rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={analyzing}>
                  Clear & start over
                </button>
                <Link to="/chat" className="btn btn-ghost btn-sm">Ask AI instead</Link>
              </div>
            </div>
          </div>
          </div>
        </Reveal>

        {/* 3 · Results (inline, chatbot reply) */}
        {result && (
          <div ref={resultsRef} className="results-anchor">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <ResultView data={result} />
            </motion.div>

            <Reveal delay={0.2}>
              <div className="analyze-actions" style={{ marginTop: '1.5rem', justifyContent: 'center' }}>
                <motion.button className="btn btn-primary btn-lg" onClick={clearAll} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  Analyze another report
                </motion.button>
              </div>
            </Reveal>
          </div>
        )}
      </div>

      {/* Analyzing overlay */}
      <AnimatePresence>
        {analyzing && (
          <motion.div
            className="analyzing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="analyzing-card"
              initial={{ scale: 0.88, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Animated scan visual */}
              <div className="scan-visual">
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="" className="scan-visual-img" />
                    <span className="scan-beam" />
                  </>
                ) : (
                  <div className="scan-doc">
                    <span className="scan-doc-icon">📄</span>
                    <span className="scan-beam" />
                  </div>
                )}
                <span className="scan-ring" />
                <span className="scan-corner tl" />
                <span className="scan-corner tr" />
                <span className="scan-corner bl" />
                <span className="scan-corner br" />
              </div>

              <motion.h3
                style={{ marginTop: '1.2rem', marginBottom: '0.3rem' }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {step >= 3 ? 'Scanning your report' : 'Analyzing your report'}
              </motion.h3>
              <p className="scan-subtitle">AI is reading your upload — just a moment…</p>

              {/* Animated progress */}
              <div className="scan-progress-track">
                <div
                  className="scan-progress-fill"
                  style={{ width: `${((step + 1) / analyzingSteps.length) * 100}%` }}
                />
              </div>

              <div className="analyzing-steps">
                {analyzingSteps.map((s, i) => {
                  const state = i < step ? 'done' : i === step ? 'active' : '';
                  return (
                    <motion.span
                      key={s.text}
                      className={state}
                      animate={{ opacity: i <= step ? 1 : 0.4 }}
                      layout
                    >
                      <span className={`step-dot ${state}`}>
                        {i < step ? '✓' : i === step ? '◉' : '○'}
                      </span>
                      {s.text}
                    </motion.span>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
