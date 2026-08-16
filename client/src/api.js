const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function handleResponse(res) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.response || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function analyzeReport({ category, text, files }) {
  const formData = new FormData();
  formData.append('category', category || 'General');
  formData.append('text', text || '');
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: formData });
  return handleResponse(res);
}

export async function sendChat({ messages, context, system_context }) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context, system_context }),
  });
  return handleResponse(res);
}

export async function getConfig() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    return await res.json();
  } catch {
    return { aiConfigured: false };
  }
}

export async function getHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch {
    return { status: 'unreachable' };
  }
}