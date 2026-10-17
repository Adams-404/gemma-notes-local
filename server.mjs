import http from 'node:http';
import { readFile } from 'node:fs/promises';

export const MODEL = 'gemma4:e2b';
export const API_MODEL = 'gemma-4-26b-a4b-it';
const SYSTEM = `Answer the question using the supplied notes. Be concise. If the notes do not contain the answer, say so.`;

export function plainAnswer(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Gemma did not return an answer. Please try again.');
  return raw.trim();
}

export function validateRequest(body) {
  if (!body || typeof body.notes !== 'string' || !body.notes.trim() || body.notes.length > 6000)
    throw new Error('Add some notes first, up to 6,000 characters.');
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 12)
    throw new Error('Start a new conversation to continue.');
  for (const [i, message] of body.messages.entries()) {
    if (message?.role !== (i % 2 === 0 ? 'user' : 'assistant') || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 3000)
      throw new Error('Invalid conversation. Start a new conversation and try again.');
  }
  if (body.messages.at(-1).role !== 'user' || body.messages.at(-1).content.length > 1000)
    throw new Error('Ask a question up to 1,000 characters.');
  if (body.notes.length + body.messages.reduce((n, m) => n + m.content.length, 0) > 14000)
    throw new Error('This conversation is full. Start a new conversation.');
  return {
    model: MODEL, stream: false, think: false, keep_alive: '10m',
    options: { num_ctx: 8192, num_predict: 384, temperature: 0.4 },
    messages: [
      { role: 'system', content: SYSTEM },
      ...body.messages.map((message, i) => ({
        role: message.role,
        content: i === 0 ? `Reference notes:\n<notes>\n${body.notes}\n</notes>\n\nQuestion: ${message.content}` : message.content,
      })),
    ],
  };
}

export function createApp({ ollama = 'http://127.0.0.1:11434', fetchModel = fetch, apiKey = process.env.GEMINI_API_KEY || '' } = {}) {
  const url = new URL(ollama);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password)
    throw new Error('This demo only connects to Ollama on this computer.');
  let busy = false;
  const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/mlh-logo.svg': ['mlh-logo.svg', 'image/svg+xml'], '/google-cloud-logo.png': ['google-cloud-logo.png', 'image/png'] };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    const address = server.address();
    const hosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
    if (!hosts.includes(req.headers.host)) return json(403, { error: 'Open this demo on localhost.' });
    if (req.headers.origin && !hosts.map(h => `http://${h}`).includes(req.headers.origin))
      return json(403, { error: 'This app accepts requests from its own page only.' });
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && files[pathname]) {
      const [file, type] = files[pathname];
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      return res.end(await readFile(new URL(`./public/${file}`, import.meta.url)));
    }
    if (req.method === 'GET' && pathname === '/api/status') {
      try {
        const r = await fetchModel(`${url.origin}/api/tags`, { signal: AbortSignal.timeout(2500), redirect: 'error' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        return json(200, { ready: data.models?.some(m => m.name === MODEL), model: MODEL, local: true });
      } catch { return json(200, { ready: false, model: MODEL, local: true }); }
    }
    if (req.method !== 'POST' || pathname !== '/api/chat') return json(404, { error: 'Not found.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'Use JSON.' });
    let payload, body, provider;
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 65536) { json(413, { error: 'That request is too large.' }); return; }
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString());
      provider = body.provider || 'local';
      if (!['api', 'local'].includes(provider)) throw new Error('Choose Google API or Local.');
      payload = validateRequest(body);
    } catch (error) { return json(400, { error: error instanceof SyntaxError ? 'Invalid request.' : error.message }); }
    if (provider === 'api' && !apiKey.trim()) return json(503, { error: 'Add GEMINI_API_KEY to this app’s .env file, then restart the app. Local mode does not need a key.' });
    if (busy) return json(429, { error: 'Gemma is answering another question. Please try again in a moment.' });
    busy = true;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 120000);
    res.on('close', () => abort.abort());
    const send = data => { if (!res.destroyed) res.write(`${JSON.stringify(data)}\n`); };
    try {
      const local = provider === 'local';
      const endpoint = local ? `${url.origin}/api/chat` : `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent`;
      const request = local ? payload : {
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: payload.messages.slice(1).map(m => m.content).join('\n') }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.2, thinkingConfig: { thinkingLevel: 'minimal' } },
      };
      const upstream = await fetchModel(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(!local ? { 'x-goog-api-key': apiKey } : {}) },
        body: JSON.stringify(request), signal: abort.signal, redirect: 'error',
      });
      if (!upstream.ok) throw new Error(local ? 'Could not run the local model. Check Ollama and the Gemma download.' : `Google API returned ${upstream.status}. Check your key, connection and API quota.`);
      const result = await upstream.json();
      const candidate = result.candidates?.[0];
      if (local ? (!result.done || result.done_reason === 'length') : candidate?.finishReason !== 'STOP')
        throw new Error('Gemma did not finish an answer. Please try a shorter question.');
      const raw = local ? result.message?.content : candidate.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('');
      const text = plainAnswer(raw);
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      send({ text }); send({ done: true }); res.end();
    } catch (error) {
      const message = abort.signal.aborted ? 'The answer took too long. Please try again.' : error.message === 'fetch failed' ? (provider === 'local' ? 'Open Ollama and download gemma4:e2b, then try again.' : 'Could not reach Google. Check your internet connection or select Local.') : error.message;
      if (!res.destroyed) json(503, { error: message });
    } finally { clearTimeout(timeout); busy = false; }
  });
  return server;
}
