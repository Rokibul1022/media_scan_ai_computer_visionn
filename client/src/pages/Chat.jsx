import { Reveal } from '../components/Motion.jsx';
import AiChat from '../components/AiChat.jsx';

export default function Chat() {
  return (
    <div>
      <div className="page-hero">
        <Reveal>
          <h2>🤖 AI Medical Assistant</h2>
          <p>Ask questions, upload a report, or get mental health support — all in plain language.</p>
        </Reveal>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        <Reveal delay={0.1}>
          <AiChat />
        </Reveal>
      </div>
    </div>
  );
}