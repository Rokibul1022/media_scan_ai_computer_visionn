import { Reveal, Stagger, StaggerItem } from '../components/Motion.jsx';

const cards = [
  { icon: '🎯', title: 'Our Mission', desc: 'Making medical reports accessible and understandable for everyone through AI-powered analysis.' },
  { icon: '🔒', title: 'Privacy First', desc: 'Your data is processed securely. No reports are stored permanently in this version.' },
  { icon: '⚡', title: 'Powered by AI', desc: 'Using LLM-powered inference for accurate, near-instant medical analysis.' },
  { icon: '🌐', title: '12 Categories', desc: 'From general prescriptions to oncology reports — comprehensive coverage across medicine.' },
];

const techs = ['React', 'Node.js', 'Express', 'LLM AI', 'Tesseract OCR', 'pdf-parse', 'Framer Motion'];

export default function About() {
  return (
    <div>
      <div className="page-hero">
        <Reveal>
          <h2>About MediScan AI</h2>
          <p>Turning complex medical reports into plain-language insights, one document at a time.</p>
        </Reveal>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        <Stagger className="grid-2" staggerChildren={0.1}>
          {cards.map((c) => (
            <StaggerItem key={c.title}>
              <div className="card card-hover feature-card" style={{ height: '100%' }}>
                <div className="feature-icon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.95rem' }}>{c.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.2}>
          <div className="card text-center mt-2">
            <h3 style={{ marginBottom: '1.2rem' }}>Technology Stack</h3>
            <div className="tech-tags">
              {techs.map((t) => (
                <span className="tech-tag" key={t}>{t}</span>
              ))}
            </div>
            <p style={{ color: 'var(--text-light)', marginTop: '1.4rem', fontSize: '0.9rem', maxWidth: 560, marginInline: 'auto' }}>
              This version is a full rewrite from vanilla JavaScript + Python/FastAPI to a modern,
              deployable React + Node.js stack with Framer Motion animations.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}