"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
  onBlock,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
  onBlock: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [showSparks, setShowSparks] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const sparks = [
    "What tiny thing made your day a little better?",
    "If you could teleport anywhere for one hour, where would you go?",
    "What song feels like a place you remember?",
    "What's something you're looking forward to?",
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
      <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div>
          <p className="font-semibold tracking-tight">A passing connection</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-cyan-200" : "animate-pulse bg-amber-300"}`} />
            {connected ? "Here with you" : "Finding a signal…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            aria-label="Start video call"
            title="Start video call"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-slate-200 transition hover:border-cyan-200/50 hover:text-cyan-100 disabled:opacity-40"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="m16 10 5-3v10l-5-3" />
            </svg>
          </button>
          <button
            onClick={onEnd}
            aria-label="Leave conversation"
            title="Leave conversation"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-400/12 text-rose-200 transition hover:bg-rose-400/20"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-200/10 text-xl text-cyan-100">✳</div>
            <p className="font-medium text-slate-200">The first word is yours.</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Say hello, or pick a Spark to get things flowing. Messages travel
              directly between you.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.mine
                  ? "rounded-br-md bg-cyan-200 text-slate-950"
                  : "rounded-bl-md border border-white/8 bg-white/[0.07] text-slate-100"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {showSparks && (
        <div className="border-t border-white/8 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">
            ✦ Conversation sparks
          </p>
          <div className="grid gap-2">
            {sparks.map((spark) => (
              <button
                key={spark}
                onClick={() => {
                  onSend(spark);
                  setShowSparks(false);
                }}
                className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.06]"
              >
                {spark}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="border-t border-white/8 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSparks((open) => !open)}
            disabled={!connected}
            className="rounded-full border border-cyan-100/15 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-100/8 disabled:opacity-40"
          >
            ✦ Spark a conversation
          </button>
          <button
            type="button"
            onClick={onBlock}
            className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition hover:text-rose-200"
          >
            Leave &amp; block
          </button>
        </div>
        <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          maxLength={500}
          disabled={!connected}
          className="min-w-0 flex-1 rounded-full border border-white/8 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-100/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="rounded-full bg-cyan-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:opacity-40"
        >
          Send ↗
        </button>
        </div>
        <p className="mt-2 text-right text-[10px] text-slate-600">{draft.length}/500 · no message history</p>
      </form>
    </div>
  );
}
