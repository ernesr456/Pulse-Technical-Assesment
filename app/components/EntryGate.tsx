"use client";

import { useState } from "react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void onReady(pos.coords.latitude, pos.coords.longitude).catch(() => {
          setStatus("error");
          setError("Couldn't connect to Pulse. Please try again.");
        });
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="entry-shell flex min-h-full flex-1 items-center justify-center p-5 text-zinc-100">
      <div className="entry-card w-full max-w-lg rounded-[2rem] p-8 text-center sm:p-12">
        <div className="mx-auto mb-9 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-3xl text-cyan-100 shadow-[0_0_60px_rgba(86,219,224,0.12)]">
          ✳
        </div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          A little less alone
        </div>
        <h1 className="text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
          Pulse<span className="text-cyan-200">.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-base leading-7 text-slate-300">
          A living world of people, passing through the same moment as you.
          Find a stranger. Share a conversation.
        </p>

        <button
          onClick={enter}
          disabled={status === "locating"}
          className="mt-9 inline-flex min-w-52 items-center justify-center gap-3 rounded-full bg-cyan-200 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-[0_10px_40px_rgba(86,219,224,0.18)] transition hover:-translate-y-0.5 hover:bg-cyan-100 disabled:translate-y-0 disabled:opacity-60"
        >
          {status === "locating" ? "Finding your place…" : "Step into Pulse"}
          {status !== "locating" && <span aria-hidden="true">↗</span>}
        </button>

        {status === "error" && (
          <p role="alert" className="mx-auto mt-4 max-w-sm text-sm text-rose-300">
            {error}
          </p>
        )}

        <div className="mx-auto mt-10 grid max-w-sm grid-cols-2 gap-3 text-left">
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <span className="block text-xs uppercase tracking-wider text-slate-500">Your place</span>
            <span className="mt-1 block text-sm text-slate-200">Fuzzed by 1–3 km</span>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <span className="block text-xs uppercase tracking-wider text-slate-500">Your words</span>
            <span className="mt-1 block text-sm text-slate-200">Never stored</span>
          </div>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          No profile, no history. Close this tab and you disappear.
        </p>
      </div>
    </div>
  );
}
