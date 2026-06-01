"use client";

import { useEffect, useState, useCallback } from "react";

export default function PricingAdmin() {
  const [deliveryFeeDollars, setDeliveryFeeDollars] = useState("15.00");
  const [asapEnabled, setAsapEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // DEF pricing
  const [defPrice2_5, setDefPrice2_5] = useState("30.00");
  const [defPrice5, setDefPrice5] = useState("55.00");
  const [savingDef, setSavingDef] = useState(false);

  const loadData = useCallback(async () => {
    const settingsRes = await fetch("/api/admin/settings");
    const settingsData = await settingsRes.json();

    setDeliveryFeeDollars((settingsData.deliveryFeeCents / 100).toFixed(2));
    setAsapEnabled(settingsData.asapEnabled !== false);
    setDefPrice2_5((settingsData.defPriceCents2_5 / 100).toFixed(2));
    setDefPrice5((settingsData.defPriceCents5 / 100).toFixed(2));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveSettings() {
    setSaving(true);
    setError("");

    const feeCents = Math.round(parseFloat(deliveryFeeDollars) * 100);

    if (isNaN(feeCents) || feeCents < 0) {
      setError("Delivery fee must be 0 or greater");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryFeeCents: feeCents,
        defaultMarkupPercent: 0,
        asapEnabled,
      }),
    });

    if (res.ok) {
      setSuccess("Settings saved!");
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save settings");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Pricing & Settings</h1>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-3.5 text-sm font-medium text-green-700">
          {success}
        </div>
      )}

      {/* Delivery Fee & Settings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Delivery Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          These settings apply to all new orders.
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Service / Delivery Fee ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={deliveryFeeDollars}
            onChange={(e) => setDeliveryFeeDollars(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
          />
          <p className="mt-1 text-xs text-slate-400">
            Non-subscriber service fee per delivery (e.g., 15.00 = $15.00). Boats use a separate $20 fee.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">ASAP Delivery</p>
            <p className="text-xs text-slate-400">Allow customers to request immediate delivery</p>
          </div>
          <button
            type="button"
            onClick={() => setAsapEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${asapEnabled ? "bg-red-600" : "bg-slate-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${asapEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* DEF Fluid Pricing */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">DEF Fluid Pricing</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set DEF (Diesel Exhaust Fluid) prices. These are flat prices per container, not per-gallon.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              2.5 Gallon DEF ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={defPrice2_5}
              onChange={(e) => setDefPrice2_5(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-400">
              Current: ${defPrice2_5} for 2.5 gallons
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              5 Gallon DEF ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={defPrice5}
              onChange={(e) => setDefPrice5(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-400">
              Current: ${defPrice5} for 5 gallons
            </p>
          </div>
        </div>

        <button
          onClick={async () => {
            setSavingDef(true);
            setError("");
            const res = await fetch("/api/admin/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                defPriceCents2_5: Math.round(parseFloat(defPrice2_5) * 100),
                defPriceCents5: Math.round(parseFloat(defPrice5) * 100),
              }),
            });
            if (res.ok) {
              setSuccess("DEF prices updated!");
              setTimeout(() => setSuccess(""), 3000);
            } else {
              setError("Failed to save DEF prices");
            }
            setSavingDef(false);
          }}
          disabled={savingDef}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {savingDef ? "Saving..." : "Save DEF Prices"}
        </button>
      </div>

      {/* Pricing Explainer */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h3 className="text-sm font-semibold text-slate-700">How Pricing Works</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>
            <strong>Fuel Orders</strong> — Customers pre-fund a dollar amount or choose Fill Up ($1 hold). You enter the actual gallons and price per gallon at completion.
          </li>
          <li>
            <strong>Service Fee</strong> — $15 for non-subscribers (vehicles), $20 for boats. Subscribers get free delivery.
          </li>
          <li>
            <strong>DEF</strong> — Flat price per container size (set above).
          </li>
          <li>
            <strong>Completion</strong> — All orders are charged at completion based on actual gallons pumped × current fuel price.
          </li>
        </ul>
      </div>
    </div>
  );
}
