import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="nav-brand" style={{ marginBottom: '0.8rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🩺</span>
              MediScan AI
            </Link>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', maxWidth: 280 }}>
              Turning complex medical reports into plain-language insights, critical alerts and doctor
              questions — all powered by LLM AI.
            </p>
          </div>

          <div>
            <h4>Product</h4>
            <div className="footer-links">
              <Link to="/analyze">Analyze Report</Link>
              <Link to="/chat">AI Chat</Link>
              <Link to="/tools">Health Tools</Link>
            </div>
          </div>

          <div>
            <h4>Company</h4>
            <div className="footer-links">
              <Link to="/about">About</Link>
              <Link to="/about">Privacy</Link>
              <Link to="/about">Security</Link>
              <Link to="/about">Contact</Link>
            </div>
          </div>

          <div>
            <h4>Stay safe</h4>
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', maxWidth: 240 }}>
              MediScan is an educational tool. Always consult a licensed healthcare professional for
              medical advice.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MediScan AI. All rights reserved.</span>
          <span>Built with React · Node.js · LLM AI</span>
        </div>
      </div>
    </footer>
  );
}