"use client";

import { useState } from "react";

interface AddressCheckerProps {
  onGeocode?: (pos: { lat: number; lng: number } | null) => void;
}

export default function AddressChecker({ onGeocode }: AddressCheckerProps) {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setResult(null);
    onGeocode?.(null);

    const res = await fetch("/api/service-area/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    const data = await res.json();
    setResult({
      ok: res.ok,
      message: data.message || data.error,
    });

    if (data.lat && data.lng) {
      onGeocode?.({ lat: data.lat, lng: data.lng });
    }

    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h3 className="text-lg font-semibold text-slate-900">
        Check if we deliver to your area
      </h3>
      <p className="mt-1 text-sm text-slate-500">Enter your address to see if you&apos;re within our service radius.</p>
      <form onSubmit={handleCheck} className="mt-5 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 123 Main St Apt 4, Fort Worth, TX"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 disabled:opacity-50 whitespace-nowrap transition-all"
        >
          {loading ? "Checking..." : "Check Address"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl p-4 text-sm font-medium ${
            result.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {result.ok ? (
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {result.message}
        </div>
      )}
    </div>
  );
}
