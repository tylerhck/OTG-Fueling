"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FUEL_TYPE_LABELS } from "@/types";

export default function GuestOrderPage() {
  const router = useRouter();
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(1500);
  const [asapEnabled, setAsapEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showRecurringPrompt, setShowRecurringPrompt] = useState(true);

  const [form, setForm] = useState({
    // Contact
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    // Vehicle
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: new Date().getFullYear(),
    vehicleColor: "",
    // Address
    street: "",
    city: "",
    state: "TX",
    zip: "",
    // Order
    fuelType: "REGULAR_87",
    dollarAmount: 40,
    isFillUp: false,
    deliveryType: "asap" as "asap" | "scheduled",
    scheduledDate: "",
    availableFrom: "",
    availableTo: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/fuel-prices")
      .then((r) => r.json())
      .then((data) => {
        if (data.deliveryFeeCents !== undefined) {
          setDeliveryFeeCents(data.deliveryFeeCents);
        }
        if (data.asapEnabled !== undefined) {
          setAsapEnabled(data.asapEnabled);
          if (data.asapEnabled === false) {
            setForm((prev) => ({ ...prev, deliveryType: "scheduled" }));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Dollar amount pre-auth model
  const fuelCost = form.isFillUp ? 0 : form.dollarAmount;
  const deliveryFee = deliveryFeeCents / 100;
  const total = fuelCost + deliveryFee;

  function updateForm(updates: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guest: true,
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: form.guestPhone || undefined,
        vehicleMake: form.vehicleMake,
        vehicleModel: form.vehicleModel,
        vehicleYear: form.vehicleYear,
        vehicleColor: form.vehicleColor,
        street: form.street,
        city: form.city,
        state: form.state,
        zip: form.zip,
        fuelType: form.fuelType,
        prefundedCents: form.isFillUp ? undefined : Math.round(form.dollarAmount * 100),
        isFillUp: form.isFillUp,
        scheduledAt:
          form.deliveryType === "scheduled" && form.scheduledDate && form.availableFrom
            ? (() => { const [h, m] = form.availableFrom.split(":").map(Number); const dt = new Date(form.scheduledDate + "T00:00:00"); dt.setHours(h, m, 0, 0); return dt.toISOString(); })()
            : undefined,
        availableFrom:
          form.deliveryType === "scheduled" && form.availableFrom
            ? form.availableFrom
            : undefined,
        availableTo:
          form.deliveryType === "scheduled" && form.availableTo
            ? form.availableTo
            : undefined,
        notes: form.notes || undefined,
      }),
    });

    if (!orderRes.ok) {
      const data = await orderRes.json();
      setError(data.error || "Failed to create order");
      setSubmitting(false);
      return;
    }

    const order = await orderRes.json();

    // Create Stripe payment intent — all orders are pre-auth (manual capture)
    const intentAmount = form.isFillUp ? 100 : order.totalCents;

    const intentRes = await fetch("/api/stripe/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: intentAmount,
        orderId: order.id,
        isFillUp: form.isFillUp,
      }),
    });

    if (!intentRes.ok) {
      setError("Failed to initiate payment. Please try again.");
      setSubmitting(false);
      return;
    }

    const { clientSecret } = await intentRes.json();

    router.push(
      `/order/payment?secret=${encodeURIComponent(clientSecret)}&orderId=${order.id}&total=${intentAmount}${form.isFillUp ? "&fillup=1" : ""}`
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Recurring order prompt for guests */}
      {showRecurringPrompt && (
        <div className="mb-8 rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Want to never worry about fuel again?</h2>
            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
              Sign up, set a recurring delivery day, and we&apos;ll top off your tank every week automatically. No scheduling, no gas stations.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/signup"
                className="w-full sm:w-auto inline-block rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-red-400 hover:to-red-500 transition-all text-center"
              >
                Sign Up &amp; Set Recurring
              </a>
              <button
                type="button"
                onClick={() => setShowRecurringPrompt(false)}
                className="w-full sm:w-auto rounded-xl border border-slate-300 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all"
              >
                No Thanks, Just a One-Time Order
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Recurring deliveries include a $35/mo subscription with free weekly delivery.
            </p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-slate-900">Order Fuel as Guest</h1>
      <p className="mt-1 text-sm text-slate-500">
        No account needed. Fill in your details below.
      </p>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Contact Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Contact Information</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                value={form.guestName}
                onChange={(e) => updateForm({ guestName: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email *</label>
              <input
                type="email"
                required
                value={form.guestEmail}
                onChange={(e) => updateForm({ guestEmail: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="tel"
                value={form.guestPhone}
                onChange={(e) => updateForm({ guestPhone: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="(817) 555-0123"
              />
            </div>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Vehicle Information</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Make *</label>
              <input
                type="text"
                required
                value={form.vehicleMake}
                onChange={(e) => updateForm({ vehicleMake: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="Toyota"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Model *</label>
              <input
                type="text"
                required
                value={form.vehicleModel}
                onChange={(e) => updateForm({ vehicleModel: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="Camry"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Year *</label>
              <input
                type="number"
                required
                min={1900}
                max={2030}
                value={form.vehicleYear}
                onChange={(e) => updateForm({ vehicleYear: parseInt(e.target.value) || 2024 })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Color *</label>
              <input
                type="text"
                required
                value={form.vehicleColor}
                onChange={(e) => updateForm({ vehicleColor: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="Silver"
              />
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Address</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Street Address *</label>
              <input
                type="text"
                required
                value={form.street}
                onChange={(e) => updateForm({ street: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">City *</label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => updateForm({ city: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="Fort Worth"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">State *</label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => updateForm({ state: e.target.value.toUpperCase() })}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">ZIP *</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={form.zip}
                  onChange={(e) => updateForm({ zip: e.target.value })}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                  placeholder="76102"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fuel Type & Dollar Amount */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Fuel Details</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Fuel Type</label>
              <select
                value={form.fuelType}
                onChange={(e) => updateForm({ fuelType: e.target.value })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              >
                {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Dollar Amount</label>
              {form.isFillUp ? (
                <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-400 italic">Fill up — charged after delivery</span>
                </div>
              ) : (
                <div className="mt-1.5 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    step={5}
                    value={form.dollarAmount}
                    onChange={(e) => updateForm({ dollarAmount: parseFloat(e.target.value) || 0 })}
                    className="block w-full rounded-xl border border-slate-300 pl-8 pr-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Fill Up Tank</p>
              <p className="text-xs text-slate-400">We place a $1 hold to verify your card, then charge only for what we pump plus the delivery fee.</p>
            </div>
            <button
              type="button"
              onClick={() => updateForm({ isFillUp: !form.isFillUp })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isFillUp ? "bg-red-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isFillUp ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          {/* Fuel price disclaimer */}
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-700">
              <strong>Note:</strong> Fuel prices fluctuate daily. The number of gallons you receive will be based on the market price at the time of delivery. You will only be charged for the actual fuel delivered.
            </p>
          </div>
        </div>

        {/* Delivery Time */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Time</h2>
          <div className="mt-3 flex gap-4">
            {asapEnabled && (
              <button
                type="button"
                onClick={() => updateForm({ deliveryType: "asap" })}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                  form.deliveryType === "asap"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                ASAP
              </button>
            )}
            <button
              type="button"
              onClick={() => updateForm({ deliveryType: "scheduled" })}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                form.deliveryType === "scheduled"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              Schedule
            </button>
          </div>

          {!asapEnabled && (
            <p className="mt-2 text-xs text-amber-600">ASAP delivery is currently unavailable. Please schedule a time.</p>
          )}

          {form.deliveryType === "scheduled" && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select a Date</label>
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => updateForm({ scheduledDate: e.target.value, availableFrom: "", availableTo: "" })}
                  min={new Date().toISOString().slice(0, 10)}
                  className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                />
              </div>
              {form.scheduledDate && (() => {
                // If scheduled date is today, filter out times less than 1 hour from now
                const now = new Date();
                const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                const isToday = form.scheduledDate === todayLocal;
                const minMins = isToday ? now.getHours() * 60 + now.getMinutes() + 60 : 0;

                const timeOptions: { value: string; label: string }[] = [];
                for (let t = 480; t <= 1200; t += 30) {
                  if (isToday && t < minMins) continue; // skip times less than 1 hour from now
                  const h = Math.floor(t / 60);
                  const m = t % 60;
                  const val = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                  const ampm = h >= 12 ? "PM" : "AM";
                  const hour = h % 12 || 12;
                  timeOptions.push({ value: val, label: `${hour}:${m.toString().padStart(2, "0")} ${ampm}` });
                }
                const fromIdx = timeOptions.findIndex((o) => o.value === form.availableFrom);
                const toOptions = form.availableFrom ? timeOptions.filter((_, i) => i > fromIdx) : [];
                return (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">What hours will your vehicle be at this location?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">From</label>
                        <select
                          value={form.availableFrom}
                          onChange={(e) => updateForm({ availableFrom: e.target.value, availableTo: "" })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                        >
                          <option value="">Select start</option>
                          {timeOptions.slice(0, -1).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">To</label>
                        <select
                          value={form.availableTo}
                          onChange={(e) => updateForm({ availableTo: e.target.value })}
                          disabled={!form.availableFrom}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
                        >
                          <option value="">Select end</option>
                          {toOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {form.scheduledDate && form.availableFrom && form.availableTo && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
                  <p>Scheduled: {new Date(form.scheduledDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Vehicle available: {(() => {
                    const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`; };
                    return `${fmt(form.availableFrom)} \u2013 ${fmt(form.availableTo)}`;
                  })()}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Notes <span className="text-sm text-slate-400 font-normal">(optional)</span>
          </h2>
          <textarea
            value={form.notes}
            onChange={(e) => updateForm({ notes: e.target.value })}
            rows={3}
            maxLength={500}
            placeholder="Any special instructions (e.g., gate code, business name or apt name, parked in the back lot)"
            className="mt-3 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          />
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
          <div className="mt-3 space-y-2 text-sm">
            {form.isFillUp ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">{FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} — Fill Up</span>
                  <span className="font-medium text-slate-400 italic">charged after delivery</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Delivery Fee</span>
                  <span className="font-medium text-slate-900">${deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="font-semibold text-slate-900">Card Hold</span>
                  <span className="text-lg font-bold text-slate-900">$1.00</span>
                </div>
                <p className="text-xs text-slate-400">A $1.00 hold is placed to verify your card. After delivery, you will be charged for the actual fuel pumped + ${deliveryFee.toFixed(2)} delivery fee.</p>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">{FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} — ${form.dollarAmount.toFixed(2)} pre-charge</span>
                  <span className="font-medium text-slate-900">${form.dollarAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Delivery Fee</span>
                  <span className="font-medium text-slate-900">${deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="font-semibold text-slate-900">Total Hold</span>
                  <span className="text-lg font-bold text-slate-900">${total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-slate-400">This amount is held on your card. If your tank fills before reaching ${form.dollarAmount.toFixed(2)}, you are only charged for the actual fuel delivered.</p>
              </>
            )}
          </div>
        </div>

        {/* Terms of Service */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="agreeTerms"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <label htmlFor="agreeTerms" className="text-sm text-slate-600">
            I agree to the{" "}
            <a href="/terms" target="_blank" className="text-red-600 hover:text-red-500 font-medium underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" className="text-red-600 hover:text-red-500 font-medium underline">
              Privacy Policy
            </a>
          </label>
        </div>

        {/* Vehicle accessibility notice */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs text-amber-800">
            <strong>Vehicle accessibility:</strong> Please make sure your vehicle is readily available and gas cap unlocked so that we may access it. Any non-accessible vehicles or no-shows can result in a service charge.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !agreedToTerms}
          className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Processing..."
            : form.isFillUp
            ? "Place Order — $1.00 Hold"
            : `Place Order — $${total.toFixed(2)} Pre-charge`}
        </button>

        <p className="text-center text-xs text-slate-400">
          Want to save your details for next time?{" "}
          <a href="/signup" className="text-red-600 hover:text-red-500 font-medium">
            Create an account
          </a>
        </p>
      </form>
    </div>
  );
}
