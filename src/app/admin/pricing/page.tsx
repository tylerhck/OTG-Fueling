"use client";

import { useEffect, useState, useCallback } from "react";
import { FUEL_TYPE_LABELS } from "@/types";
import type { FuelType } from "@/types";

const FUEL_TYPES: FuelType[] = ["REGULAR_87", "PREMIUM_93", "DIESEL"];

interface FuelPrice {
  id: string;
  fuelType: string;
  basePriceCents: number;
  markupPercent: number;
  effectivePriceCents: number;
  updatedAt: string;
}

interface ExternalPrice {
  fuelType: string;
  label: string;
  pricePerGallon: number;
  priceCents: number;
  period: string;
}

export default function PricingAdmin() {
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [deliveryFeeDollars, setDeliveryFeeDollars] = useState("5.00");
  const [defaultMarkup, setDefaultMarkup] = useState("10");
  const [asapEnabled, setAsapEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingExternal, setFetchingExternal] = useState(false);
  const [externalPrices, setExternalPrices] = useState<ExternalPrice[]>([]);
  const [externalMessage, setExternalMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit form for individual fuel types
  const [editFuel, setEditFuel] = useState<string | null>(null);
  const [editBase, setEditBase] = useState("");
  const [editMarkup, setEditMarkup] = useState("");

  // DEF pricing
  const [defPrice2_5, setDefPrice2_5] = useState("30.00");
  const [defPrice5, setDefPrice5] = useState("55.00");
  const [savingDef, setSavingDef] = useState(false);

  const loadData = useCallback(async () => {
    const [priceRes, settingsRes] = await Promise.all([
      fetch("/api/fuel-prices"),
      fetch("/api/admin/settings"),
    ]);

    const priceData = await priceRes.json();
    const settingsData = await settingsRes.json();

    setPrices(priceData.prices || []);
    setDeliveryFeeDollars((settingsData.deliveryFeeCents / 100).toFixed(2));
    setDefaultMarkup(String(settingsData.defaultMarkupPercent));
    setAsapEnabled(settingsData.asapEnabled !== false);
    setDefPrice2_5((settingsData.defPriceCents2_5 / 100).toFixed(2));
    setDefPrice5((settingsData.defPriceCents5 / 100).toFixed(2));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function fetchExternalPrices() {
    setFetchingExternal(true);
    setExternalMessage("");
    setError("");

    try {
      const res = await fetch("/api/cron/update-fuel-prices");
      const data = await res.json();

      if (data.success) {
        setExternalMessage(
          `Prices updated from QuikTrip #883 (Basswood & I-35) at ${new Date(data.updatedAt).toLocaleString()}`
        );
        setExternalPrices(
          (data.prices || []).map((p: { fuelType: string; priceDollars: number; priceCents: number }) => ({
            fuelType: p.fuelType,
            label: FUEL_TYPE_LABELS[p.fuelType as FuelType] || p.fuelType,
            pricePerGallon: p.priceDollars,
            priceCents: p.priceCents,
            period: "Live",
          }))
        );
        await loadData();
        setSuccess("Fuel prices updated from local QT!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to fetch prices");
      }
    } catch {
      setError("Failed to fetch external prices");
    }

    setFetchingExternal(false);
  }

  async function applyExternalPrices() {
    setSaving(true);
    setError("");

    const markup = parseFloat(defaultMarkup) || 10;

    for (const ext of externalPrices) {
      await fetch("/api/fuel-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fuelType: ext.fuelType,
          basePriceCents: ext.priceCents,
          markupPercent: markup,
        }),
      });
    }

    setExternalPrices([]);
    setSuccess("Prices updated from market data!");
    await loadData();
    setSaving(false);
    setTimeout(() => setSuccess(""), 3000);
  }

  async function savePrice(fuelType: string) {
    setSaving(true);
    setError("");

    const basePriceCents = Math.round(parseFloat(editBase) * 100);
    const markupPercent = parseFloat(editMarkup);

    if (isNaN(basePriceCents) || basePriceCents <= 0) {
      setError("Base price must be a positive number");
      setSaving(false);
      return;
    }
    if (isNaN(markupPercent) || markupPercent < 0) {
      setError("Markup must be 0 or greater");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/fuel-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fuelType, basePriceCents, markupPercent }),
    });

    if (res.ok) {
      setEditFuel(null);
      setSuccess("Price updated!");
      await loadData();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save price");
    }

    setSaving(false);
  }

  async function saveSettings() {
    setSaving(true);
    setError("");

    const feeCents = Math.round(parseFloat(deliveryFeeDollars) * 100);
    const markup = parseFloat(defaultMarkup);

    if (isNaN(feeCents) || feeCents < 0) {
      setError("Delivery fee must be 0 or greater");
      setSaving(false);
      return;
    }
    if (isNaN(markup) || markup < 0) {
      setError("Markup must be 0 or greater");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryFeeCents: feeCents,
        defaultMarkupPercent: markup,
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

  function startEdit(price: FuelPrice) {
    setEditFuel(price.fuelType);
    setEditBase((price.basePriceCents / 100).toFixed(2));
    setEditMarkup(String(price.markupPercent));
    setError("");
  }

  function startNew(fuelType: string) {
    setEditFuel(fuelType);
    setEditBase("");
    setEditMarkup(defaultMarkup);
    setError("");
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  const configuredTypes = new Set(prices.map((p) => p.fuelType));
  const missingTypes = FUEL_TYPES.filter((ft) => !configuredTypes.has(ft));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Fuel Pricing & Settings</h1>

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

      {/* Delivery Fee & Markup Settings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Delivery & Markup Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          These settings apply to all new orders.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Delivery Fee ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={deliveryFeeDollars}
              onChange={(e) => setDeliveryFeeDollars(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-400">
              Flat fee charged per delivery (e.g., 5.00 = $5.00)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Default Markup (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={defaultMarkup}
              onChange={(e) => setDefaultMarkup(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-400">
              Default markup applied on base gas price (e.g., 10 = +10%)
            </p>
          </div>
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

      {/* Fetch External Prices */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Live Local Prices — QuikTrip (Basswood & I-35)
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Prices auto-update daily at 5 AM from QuikTrip #883 via Google Places API. Click below to update now.
            </p>
          </div>
          <button
            onClick={fetchExternalPrices}
            disabled={fetchingExternal}
            className="self-start flex-shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {fetchingExternal ? "Updating..." : "Update Now"}
          </button>
        </div>

        {externalMessage && (
          <p className="mt-3 text-sm text-green-600 font-medium">{externalMessage}</p>
        )}

        {externalPrices.length > 0 && (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Fuel Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Market Price
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      With {defaultMarkup}% Markup
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {externalPrices.map((p) => (
                    <tr key={p.fuelType}>
                      <td className="px-4 py-3 text-sm font-medium">{p.label}</td>
                      <td className="px-4 py-3 text-sm">
                        ${p.pricePerGallon.toFixed(2)}/gal
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-red-600">
                        ${(p.pricePerGallon * (1 + parseFloat(defaultMarkup) / 100)).toFixed(2)}/gal
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={applyExternalPrices}
                disabled={saving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Applying..." : "Apply These Prices"}
              </button>
              <button
                onClick={() => setExternalPrices([])}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current Prices Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Current Fuel Prices</h2>
        <p className="mt-1 text-sm text-slate-500">
          Click &quot;Edit&quot; to manually override any price. Customer price = base price + markup %.
        </p>

        {prices.length === 0 && missingTypes.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No prices configured yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {prices.map((p) => (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
                {editFuel === p.fuelType ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {FUEL_TYPE_LABELS[p.fuelType as FuelType] || p.fuelType}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Base Price</label>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-sm text-slate-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editBase}
                            onChange={(e) => setEditBase(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Markup</label>
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={editMarkup}
                            onChange={(e) => setEditMarkup(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                          />
                          <span className="text-sm text-slate-400">%</span>
                        </div>
                      </div>
                    </div>
                    {editBase && editMarkup && (
                      <p className="text-sm font-medium text-red-600">
                        Customer: ${(parseFloat(editBase) * (1 + parseFloat(editMarkup) / 100)).toFixed(2)}/gal
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => savePrice(p.fuelType)}
                        disabled={saving}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditFuel(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {FUEL_TYPE_LABELS[p.fuelType as FuelType] || p.fuelType}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Base: ${(p.basePriceCents / 100).toFixed(2)} &middot; Markup: {p.markupPercent}% &middot; Updated: {new Date(p.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-red-600">
                        ${(p.effectivePriceCents / 100).toFixed(2)}/gal
                      </span>
                      <button
                        onClick={() => startEdit(p)}
                        className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Missing fuel types — allow adding */}
            {missingTypes.map((ft) => (
              <div key={ft} className="rounded-xl border border-dashed border-gray-200 bg-slate-50 p-4">
                {editFuel === ft ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {FUEL_TYPE_LABELS[ft]}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Base Price</label>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-sm text-slate-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editBase}
                            onChange={(e) => setEditBase(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Markup</label>
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={editMarkup}
                            onChange={(e) => setEditMarkup(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                          />
                          <span className="text-sm text-slate-400">%</span>
                        </div>
                      </div>
                    </div>
                    {editBase && editMarkup && (
                      <p className="text-sm font-medium text-red-600">
                        Customer: ${(parseFloat(editBase) * (1 + parseFloat(editMarkup) / 100)).toFixed(2)}/gal
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => savePrice(ft)}
                        disabled={saving}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditFuel(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-400">
                      {FUEL_TYPE_LABELS[ft]} — Not set
                    </p>
                    <button
                      onClick={() => startNew(ft)}
                      className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                      + Set Price
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DEF Fluid Pricing */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">DEF Fluid Pricing</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manually set DEF (Diesel Exhaust Fluid) prices. These are flat prices, not per-gallon.
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
            <strong>Base Price</strong> — your cost per gallon (set manually or fetched from market data)
          </li>
          <li>
            <strong>Markup %</strong> — percentage added on top of base price (e.g., 10% on $3.00 = $3.30 customer price)
          </li>
          <li>
            <strong>Delivery Fee</strong> — flat fee added to every order (shown separately to customers)
          </li>
          <li>
            <strong>Customer Total</strong> = (Customer Price x Gallons) + Delivery Fee
          </li>
        </ul>
      </div>
    </div>
  );
}
