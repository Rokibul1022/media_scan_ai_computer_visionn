import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem, AnimatedCounter } from '../components/Motion.jsx';
import AiChat from '../components/AiChat.jsx';
import HealthTools from '../components/HealthTools.jsx';
import { features, steps, testimonials, stats } from '../data.js';

const heroContainer = {
  hidden: {},
  show: { transition: { delayChildren: 0.15, staggerChildren: 0.12 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

function HeroMockup() {
  return (
    <div className="hero-visual">
      <div className="float-chip chip-1">
        <span className="chip-ring" /> 2 critical alerts caught
      </div>
      <div className="float-chip chip-2">
        <span style={{ fontSize: '1.1rem' }}>🤖</span> Plain-language summary
      </div>

      <div className="mockup">
        <div className="mockup-bar short" />
        <div className="mockup-bar long" />
        <div className="mockup-file">
          <span style={{ fontSize: '1.4rem' }}>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>blood_report.pdf</div>
            <div style={{ color: 'var(--text-light)', fontSize: '0.72rem' }}>1.2 MB · 3 pages</div>
          </div>
          <span
            style={{
              background: 'var(--gradient)',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.3rem 0.7rem',
              borderRadius: 999,
            }}
          >
            Analyzing
          </span>
        </div>

        <div className="mockup-analysis">
          <div className="mockup-row">
            <span>💊</span>
            <span>Summary written in plain language</span>
          </div>
          <div className="mockup-row">
            <span>❓</span>
            <span>5 questions to ask your doctor</span>
          </div>
          <div className="mockup-row">
            <span>🔊</span>
            <span>Audio narration generated</span>
          </div>
        </div>

        <div style={{ marginTop: '0.8rem' }}>
          <div className="mockup-alert">
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong>Elevated Creatinine</strong>
              <span style={{ fontWeight: 400, display: 'block' }}>kidney function marker exceeds normal range</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const confetti = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        left: `${(i * 8.5 + 3) % 96}%`,
        width: `${6 + (i % 3) * 3}px`,
        height: `${8 + (i % 4) * 3}px`,
        background: ['#fff', '#ffd166', '#a78bfa', '#22d3ee'][i % 4],
        animationDelay: `${(i % 5) * 1.2}s`,
      })),
    []
  );

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="hero-bg">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="grid-overlay" />
        </div>

        <div className="container">
          <motion.div className="hero-content" variants={heroContainer} initial="hidden" animate="show">
            <div>
              <motion.div variants={heroItem}>
                <span className="hero-badge">
                  <span style={{ background: 'var(--gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✦</span>
                  AI-Powered Medical Report Analysis
                </span>
              </motion.div>

              <motion.h1 variants={heroItem}>
                Understand any <span className="gradient-text">medical report</span> in plain language
              </motion.h1>

              <motion.p className="hero-subtitle" variants={heroItem}>
                Upload a scan, PDF or paste text. MediScan AI extracts, interprets and summarizes your
                report — flagging critical values and giving you the questions to ask your doctor.
              </motion.p>

              <motion.div className="hero-cta" variants={heroItem}>
                <Link to="/analyze" className="btn btn-primary btn-lg">
                  Analyze Your Report →
                </Link>
                <Link to="/chat" className="btn btn-ghost btn-lg">
                  💬 Ask AI Assistant
                </Link>
              </motion.div>

              <motion.div className="hero-social-proof" variants={heroItem}>
                <div className="avatars">
                  <span>SM</span>
                  <span>JC</span>
                  <span>PS</span>
                </div>
                <div className="social-proof-text">
                  Trusted by <strong>40,000+</strong> patients & providers
                  <div>⭐ 4.9/5 average rating</div>
                </div>
              </motion.div>
            </div>

            <motion.div
              variants={heroItem}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <HeroMockup />
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="stats-band card"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {stats.map((s) => (
              <div className="stat-item" key={s.label}>
                <AnimatedCounter value={s.value} suffix={s.suffix} />
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ AI CHAT (embedded on home) ============ */}
      <section className="section" style={{ background: 'var(--bg-soft)' }}>
        <div className="container">
          <Reveal className="section-title">
            <div className="eyebrow">Ask anything</div>
            <h2>💬 AI Medical Assistant</h2>
            <p>Ask about your report, lab results, or any health question — all in plain language.</p>
          </Reveal>

          <Reveal delay={0.05}>
            <AiChat compact />
          </Reveal>
        </div>
      </section>

      {/* ============ TOOLS (embedded on home) ============ */}
      <section className="section">
        <div className="container">
          <Reveal className="section-title">
            <div className="eyebrow">Free utilities</div>
            <h2>🧰 Health Tools & Calculators</h2>
            <p>Track, estimate and understand your health between visits.</p>
          </Reveal>

          <Reveal delay={0.05}>
            <HealthTools max={3} />
          </Reveal>

          <Reveal className="text-center mt-2" delay={0.15}>
            <Link to="/tools" className="btn btn-ghost">
              Explore all health tools →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="section" style={{ background: 'var(--bg-soft)' }}>
        <div className="container">
          <Reveal className="section-title">
            <div className="eyebrow">Powerful under the hood</div>
            <h2>Everything you need to decode your health data</h2>
            <p>From OCR-powered extraction to AI interpretation, MediScan makes medical documents approachable.</p>
          </Reveal>

          <Stagger className="grid-3">
            {features.map((f) => (
              <StaggerItem key={f.title}>
                <div className="card card-hover feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="section">
        <div className="container">
          <Reveal className="section-title">
            <div className="eyebrow">Simple flow</div>
            <h2>Three steps to health clarity</h2>
            <p>No medical knowledge required. If you can attach a file, you can use MediScan.</p>
          </Reveal>

          <Stagger className="steps-grid" staggerChildren={0.15}>
            {steps.map((s) => (
              <StaggerItem key={s.num}>
                <div className="card card-hover step-card">
                  <span className="step-number">{s.num}</span>
                  <div className="step-icon">{s.icon}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal className="text-center mt-2" delay={0.2}>
            <Link to="/analyze" className="btn btn-primary">
              Try it now — free →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="section" style={{ background: 'var(--bg-soft)' }}>
        <div className="container">
          <Reveal className="section-title">
            <div className="eyebrow">Loved by users</div>
            <h2>Real stories of clarity</h2>
          </Reveal>

          <Stagger className="grid-3">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <div className="card card-hover testimonial-card">
                  <div className="quote-mark">"</div>
                  <p>{t.quote}</p>
                  <div className="t-person">
                    <div className="t-avatar">{t.initials}</div>
                    <div>
                      <div className="t-name">{t.name}</div>
                      <div className="t-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="section">
        <div className="container">
          <Reveal y={40}>
            <div className="cta-band">
              {confetti.map((c, i) => (
                <span key={i} className="cta-confetti" style={c} />
              ))}
              <h2>Stop guessing what your results mean</h2>
              <p>
                Get a clear, plain-language read on any medical report in under 30 seconds.
                Free to start, no sign-up required.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/analyze" className="btn btn-primary btn-lg">
                  Start Analyzing →
                </Link>
                <Link to="/tools" className="btn btn-ghost btn-lg">
                  Explore Health Tools
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}