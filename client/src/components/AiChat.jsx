import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiModes } from '../data.js';
import { sendChat, analyzeReport } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

const NIKO_INTRO =
  "Hi, I'm NIKO — your AI health assistant. Ask me about your medical reports, lab results, or any health question. I explain things in plain language. 🤍";

const welcomeMessages = {
  medical: NIKO_INTRO,
  therapy: "I'm NIKO, and I'm here to listen. How have you been feeling about your health lately? Remember — I'm AI, not a replacement for professional therapy.",
  voice: "Voice notes mode active. Upload a photo of your doctor's notes or describe them, and I'll organize them for you.",
};

const modePrompts = {
  medical: 'You are NIKO, a warm, intelligent and trustworthy medical AI assistant. Explain medical concepts in simple, plain language with empathy. Structure longer answers with short paragraphs and bullet points. Always remind users to consult a real doctor for medical advice.',
  therapy: 'You are NIKO, a compassionate mental-health support AI. Respond with empathy and care to health anxiety and emotional concerns. Offer grounding techniques when appropriate. Always remind users to seek professional help for serious mental health issues.',
  voice: 'You are NIKO, helping users transcribe and organize doctor visit notes. Provide clean, structured, easy-to-read summaries of medical conversations.',
};

const SUGGESTIONS = [
  'Explain my latest blood test',
  'What does high creatinine mean?',
  'How can I lower my blood pressure?',
  'What should I ask my doctor?',
];

function renderInline(text) {
  const nodes = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) nodes.push(<code key={key++} className="md-code">{tok.slice(1, -1)}</code>);
    else nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderMarkdown(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let list = [];
  let listType = null;
  let key = 0;
  const flush = () => {
    if (list.length) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      out.push(
        <Tag key={key++} className="md-list">
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </Tag>
      );
      list = [];
      listType = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    const ul = line.match(/^[-*]\s+(.*)/);
    const ol = line.match(/^\d+[.)]\s+(.*)/);
    if (ul || ol) {
      if (!listType) listType = ol ? 'ol' : 'ul';
      list.push(renderInline(ul ? ul[1] : ol[1]));
      continue;
    }
    flush();
    if (!line) continue;
    out.push(
      <span key={key++} className="md-line">
        {renderInline(line)}
      </span>
    );
  }
  flush();
  return out;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AiChat({ compact }) {
  const { currentAnalysis } = useApp();
  const [mode, setMode] = useState('medical');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const addMessage = (role, content) =>
    setMessages((prev) => [...prev, { role, content, time: nowTime() }]);

  const switchMode = (m) => {
    setMode(m);
    addMessage('assistant', welcomeMessages[m]);
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  const send = async (preset) => {
    const text = (preset ?? input).trim();
    if (!text || busy) return;

    addMessage('user', text);
    setInput('');
    setTyping(true);

    const history = [...messages, { role: 'user', content: text }]
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));

    try {
      const context = currentAnalysis
        ? JSON.stringify({ summary: currentAnalysis.summary, critical_values: currentAnalysis.critical_values, questions: currentAnalysis.questions })
        : null;
      const res = await sendChat({
        messages: history,
        context,
        system_context: modePrompts[mode],
      });
      addMessage('assistant', res.response);
    } catch (err) {
      addMessage('assistant', `❌ Sorry, I hit an error: ${err.message}. Please try again.`);
    } finally {
      setTyping(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;

    addMessage('user', `${file.type.startsWith('image/') ? '🖼️' : '📄'} Uploaded: ${file.name}`);
    setTyping(true);

    try {
      const res = await analyzeReport({ category: currentAnalysis?.category || 'General', text: 'Please analyze this medical document.', files: [file] });
      setTyping(false);
      addMessage('assistant', `**Analyzed "${file.name}"**\n\n${res.summary}`);
      if (res.critical_values?.length) {
        const alerts = res.critical_values.map((a) => `- **${a.title}**: ${a.message}`).join('\n');
        addMessage('assistant', `⚠️ **Critical values found:**\n${alerts}`);
      }
    } catch (err) {
      setTyping(false);
      addMessage('assistant', `❌ Could not process the file: ${err.message}`);
    }
  };

  const hasReportContext = Boolean(currentAnalysis);

  return (
    <div className={`chat-shell ${compact ? 'chat-shell-compact' : ''}`}>
      {/* NIKO header */}
      <div className="niko-header">
        <div className="niko-brand">
          <div className="niko-avatar">N</div>
          <div>
            <div className="niko-name">
              NIKO <span className="niko-ai">AI</span>
            </div>
            <div className="niko-status">
              <span className="niko-dot" /> Online · replies instantly
            </div>
          </div>
        </div>
        <div className="niko-actions">
          {hasReportContext && <span className="niko-context" title="Report loaded into context">📄 context</span>}
          <button className="niko-clear" onClick={clearChat} aria-label="Clear chat">🗑️</button>
        </div>
      </div>

      <div className="chat-body">
        <div className="chat-modes">
          {aiModes.map((m) => (
            <button
              key={m.id}
              className={`chat-mode-btn ${mode === m.id ? 'active' : ''}`}
              onClick={() => switchMode(m.id)}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div className="chat-messages" ref={messagesRef}>
          {messages.length === 0 && (
            <div className="niko-empty">
              <div className="niko-empty-avatar">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  🤖
                </motion.div>
              </div>
              <h3>Ask NIKO anything about your health</h3>
              <p>Medical reports, lab results, symptoms — explained in plain language.</p>
              <div className="suggestions">
                {[
                  ...SUGGESTIONS,
                  ...(hasReportContext ? ['Summarize my current report'] : []),
                ].map((s) => (
                  <motion.button
                    key={s}
                    className="suggestion-chip"
                    onClick={() => send(s)}
                    whileTap={{ scale: 0.96 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + Math.random() * 0.2 }}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={`${msg.time}-${i}`}
                className={`chat-msg ${msg.role}`}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {msg.role === 'assistant' && <div className="niko-msg-avatar">N</div>}
                <div className="msg-bubble">
                  {msg.role === 'assistant' ? (
                    renderMarkdown(msg.content)
                  ) : (
                    <span className="md-line">{msg.content}</span>
                  )}
                  <span className="msg-time">{msg.time}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {typing && (
            <motion.div
              className="chat-msg assistant"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="niko-msg-avatar">N</div>
              <div className="msg-bubble">
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            </motion.div>
          )}

          {/* Follow-up suggestions after last reply */}
          {messages.length > 0 && !typing && (
            <div className="followups">
              {[
                'Explain that in simpler terms',
                'What are the next steps?',
                'Is this serious?',
              ].map((s) => (
                <button key={s} className="followup-chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="chat-input-row">
          <button className="chat-attach" onClick={() => fileInputRef.current?.click()} aria-label="Attach file" title="Upload image or PDF">
            📎
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" hidden onChange={handleFile} />
          <textarea
            className="chat-input"
            rows={1}
            placeholder={hasReportContext ? 'Ask NIKO about your report…' : 'Message NIKO…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <motion.button
            className="send-btn"
            onClick={() => send()}
            disabled={busy || !input.trim()}
            aria-label="Send"
            whileTap={{ scale: 0.9 }}
          >
            {typing ? '⏳' : '➤'}
          </motion.button>
        </div>
        <div className="niko-disclaimer">NIKO is AI assistance — always confirm important information with your doctor.</div>
      </div>
    </div>
  );
}