"use client";

import { useState } from "react";

const REFERRAL_OPTIONS = [
  { value: "Facebook", icon: "📘" },
  { value: "Instagram", icon: "📷" },
  { value: "TikTok", icon: "🎵" },
  { value: "Word of Mouth", icon: "🗣️" },
  { value: "Friend or Family", icon: "👥" },
  { value: "Other", icon: "💬" },
];

interface ReferralSourceModalProps {
  onComplete: () => void;
}

export default function ReferralSourceModal({ onComplete }: ReferralSourceModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/referral-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: selected }),
      });

      if (res.ok) {
        onComplete();
      }
    } catch {
      // Still let them through if there's a network error
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white font-bold text-sm shadow-lg shadow-red-200 mb-4">
            OTG
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Where did you hear about us?
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Help us know how you found On The Go Fueling
          </p>
        </div>

        <div className="space-y-2">
          {REFERRAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelected(option.value)}
              className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                selected === option.value
                  ? "border-red-500 bg-red-50 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-xl">{option.icon}</span>
              <span className={`text-sm font-medium ${
                selected === option.value ? "text-red-700" : "text-slate-700"
              }`}>
                {option.value}
              </span>
              {selected === option.value && (
                <svg className="ml-auto h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!selected || submitting}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
