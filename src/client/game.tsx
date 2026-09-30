import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';

type Result = { status: string; text?: string; message?: string; receipt_id?: string };

function readResult(value: unknown): Result {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'degraded', message: 'GestaltView returned an invalid response.' };
  }
  const data = Object.fromEntries(Object.entries(value));
  return {
    status: typeof data.status === 'string' ? data.status : 'degraded',
    text: typeof data.text === 'string' ? data.text : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
    receipt_id: typeof data.receipt_id === 'string' ? data.receipt_id : undefined,
  };
}

export const App = () => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/insight/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, requestId: crypto.randomUUID(), visibility: 'private' }),
      });
      const body = readResult(await response.json());
      setResult(body);
    } catch {
      setResult({ status: 'degraded', message: 'Could not reach Insight-Bot. Please retry.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="border-b border-slate-700 pb-5">
          <p className="text-xs font-semibold tracking-[0.3em] text-cyan-300">GESTALTVIEW / INSIGHT-BOT</p>
          <h1 className="mt-3 text-3xl font-semibold">A doorway to deeper perspective.</h1>
          <p className="mt-2 text-slate-300">Ask a question or explore an idea. Replies are private by default.</p>
        </header>
        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="prompt">
          What would you like to explore?
          <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} rows={6} className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-base font-normal outline-none focus:border-cyan-300" placeholder="Write your question…" />
        </label>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{prompt.length}/4000</span>
          <span>Input is not retained by this adapter.</span>
        </div>
        <button onClick={() => void submit()} disabled={busy || !prompt.trim()} className="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Connecting to GestaltView…' : 'Ask Insight-Bot'}
        </button>
        {result && <section aria-live="polite" className="whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900 p-5">
          <p className="mb-3 text-xs uppercase tracking-widest text-cyan-300">{result.status}</p>
          <p>{result.text ?? result.message}</p>
          {result.receipt_id && <p className="mt-4 text-xs text-slate-500">Receipt {result.receipt_id}</p>}
        </section>}
      </main>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
