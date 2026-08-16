import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SEVERITY = {
  critical: { color: '#ef4444', label: 'Critical', icon: '🚨' },
  warning: { color: '#f59e0b', label: 'Warning', icon: '⚠️' },
  info: { color: '#22d3ee', label: 'Info', icon: 'ℹ️' },
};

export default function ScanOverlay({ image, findings = [], note }) {
  const [active, setActive] = useState(null);

  if (!image) return null;

  return (
    <div className="scan-overlay-wrap">
      {note && (
        <div className="scan-note">
          <span className="scan-note-icon">👁️</span>
          <div>
            <strong>AI Scan Review</strong>
            <p>{note}</p>
          </div>
        </div>
      )}

      <div className="scan-stage">
        <div
          className="scan-canvas"
          onMouseLeave={() => setActive(null)}
        >
          <img src={image} alt="Uploaded medical scan" className="scan-img" />
          {findings.map((f, i) => {
            const sev = SEVERITY[f.severity] || SEVERITY.info;
            const isActive = active === i;
            return (
              <button
                key={i}
                className={`scan-box ${sev.label.toLowerCase()}`}
                style={{
                  left: `${f.box.x * 100}%`,
                  top: `${f.box.y * 100}%`,
                  width: `${f.box.width * 100}%`,
                  height: `${f.box.height * 100}%`,
                  borderColor: sev.color,
                  background: isActive ? `${sev.color}38` : 'transparent',
                }}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive((a) => (a === i ? null : i))}
                aria-label={f.label}
              >
                {!isActive && (
                  <span
                    className="scan-box-num"
                    style={{ background: sev.color }}
                  >
                    {i + 1}
                  </span>
                )}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      className="scan-tooltip"
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      style={{ '--sev': sev.color, color: 'var(--text)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{sev.icon}</span>
                        <strong>{f.label}</strong>
                      </div>
                      {f.description && <p>{f.description}</p>}
                      <div className="scan-tooltip-meta">
                        {f.confidence != null && <span>Confidence {Math.round(f.confidence * 100)}%</span>}
                        <span style={{ color: sev.color }}>{sev.label}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend + findings list */}
      {findings.length > 0 && (
        <div className="scan-findings-list">
          <div className="scan-legend">
            {Object.entries(SEVERITY).map(([k, v]) => (
              <span key={k} className="scan-legend-item">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: v.color, display: 'inline-block' }} />
                {v.label}
              </span>
            ))}
          </div>
          {findings.map((f, i) => {
            const sev = SEVERITY[f.severity] || SEVERITY.info;
            return (
              <button
                key={i}
                className={`scan-finding-row ${active === i ? 'active' : ''}`}
                style={{ '--sev': sev.color }}
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive((a) => (a === i ? null : i))}
              >
                <span className="scan-find-num" style={{ background: sev.color }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <strong>{f.label}</strong>
                  {f.description && <small>{f.description}</small>}
                </span>
                <span className="scan-find-sev" style={{ color: sev.color }}>
                  {sev.icon} {sev.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {findings.length === 0 && (
        <div className="scan-clear">
          ✅ No faults detected on this scan by AI. Still confirm with your doctor.
        </div>
      )}
    </div>
  );
}