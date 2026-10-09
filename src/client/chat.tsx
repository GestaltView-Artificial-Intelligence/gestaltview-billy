import './index.css';

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { context } from '@devvit/web/client';

type Role = 'user' | 'billy' | 'system';

type Message = {
  id: string;
  role: Role;
  text: string;
  receiptId?: string;
  retryable?: boolean;
};

type ApiResult = {
  status: string;
  text?: string;
  message?: string;
  receipt_id?: string;
  retryable?: boolean;
};

const STARTERS = [
  'What is the Recognition Gap?',
  'Help me think through a difficult decision.',
  'Explain my idea back to me, more clearly.',
];

function readResult(value: unknown): ApiResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'degraded', message: 'GestaltView returned an invalid response.' };
  }
  const data = Object.fromEntries(Object.entries(value));
  return {
    status: typeof data.status === 'string' ? data.status : 'degraded',
    ...(typeof data.text === 'string' ? { text: data.text } : {}),
    ...(typeof data.message === 'string' ? { message: data.message } : {}),
    ...(typeof data.receipt_id === 'string' ? { receipt_id: data.receipt_id } : {}),
    ...(typeof data.retryable === 'boolean' ? { retryable: data.retryable } : {}),
  };
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Billy is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-cyan-300"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

function MessageBubble({ message, onRetry }: { message: Message; onRetry?: () => void }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-cyan-300 px-4 py-3 text-slate-950">
          {message.text}
        </div>
      </div>
    );
  }
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-center text-sm text-amber-200">
          <p className="whitespace-pre-wrap">{message.text}</p>
          {message.retryable && onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 rounded-full border border-amber-300/50 px-4 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-300/20"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start gap-2.5">
      <div
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-500 text-sm font-bold text-slate-950"
      >
        B
      </div>
      <div className="max-w-[85%]">
        <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100">
          {message.text}
        </div>
        {message.receiptId && (
          <p className="mt-1 text-[11px] text-slate-500">Receipt {message.receiptId}</p>
        )}
      </div>
    </div>
  );
}

export const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy || text.length > 4000) return;
    const userMessage: Message = { id: uid(), role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setBusy(true);
    try {
      const response = await fetch('/api/insight/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, requestId: uid() }),
      });
      const result = readResult(await response.json());
      if (result.status === 'completed' && result.text) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'billy', text: result.text as string, receiptId: result.receipt_id },
        ]);
      } else if (result.status === 'queued') {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'system',
            text: 'Your question is queued — Billy will answer shortly.',
            retryable: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'system',
            text: result.message ?? 'Something went wrong reaching GestaltView.',
            retryable: result.retryable ?? response.ok,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'system',
          text: 'Could not reach Insight-Bot. Check your connection and try again.',
          retryable: true,
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) void send(lastUser.text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-500 text-lg font-bold text-slate-950"
          >
            B
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">Talk to Billy</h1>
            <p className="truncate text-xs text-slate-400">
              Ask questions, explore ideas — a thoughtful AI collaborator, right inside this post.
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-400 sm:inline">
            Replies are private
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && !busy && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <p className="max-w-md text-slate-300">
              Welcome{context.username ? `, ${context.username}` : ''}. Ask Billy anything —
              a question you're chewing on, an idea you want reflected back, a perspective you
              haven't considered.
            </p>
            <div className="flex max-w-md flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-cyan-300 hover:text-cyan-200"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="max-w-md text-xs text-slate-500">
              Replies are private to you. This adapter does not retain your input.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onRetry={m.role === 'system' && m.retryable ? retryLast : undefined}
          />
        ))}

        {busy && (
          <div className="flex justify-start gap-2.5">
            <div
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-500 text-sm font-bold text-slate-950"
            >
              B
            </div>
            <div className="rounded-2xl rounded-bl-md border border-slate-700 bg-slate-900 px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-slate-800 px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={4000}
            rows={2}
            placeholder="Write your question… (Enter to send)"
            aria-label="Your question for Billy"
            className="max-h-32 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 p-3 text-base outline-none placeholder:text-slate-500 focus:border-cyan-300"
          />
          <button
            onClick={() => void send(draft)}
            disabled={busy || !draft.trim()}
            aria-label="Send question"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-xl font-bold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↑
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-[11px] text-slate-500">
          {draft.length}/4000 · Input is not retained by this adapter · Billy is an AI collaborator,
          not a professional advisor.
        </p>
      </footer>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Chat />
  </StrictMode>
);
