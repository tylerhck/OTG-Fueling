"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FUEL_TYPE_LABELS } from "@/types";

interface FuelPrice {
  fuelType: string;
  effectivePriceCents: number;
}

export default function GuestOrderPage() {
  const router = useRouter();
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(1500);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
    gallons: 10,
    deliveryType: "asap" as "asap" | "scheduled",
    scheduledAt: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/fuel-prices")
      .then((r) => r.json())
      .then((data) => {
        setPrices(data.prices || []);
        if (data.deliveryFeeCents !== undefined) {
          setDeliveryFeeCents(data.deliveryFeeCents);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selectedPrice = prices.find((p) => p.fuelType === form.fuelType);
  const pricePerGallon = selectedPrice ? selectedPrice.effectivePriceCents / 100 : 0;
  const fuelCost = pricePerGallon * form.gallons;
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
        gallons: form.gallons,
        scheduledAt:
          form.deliveryType === "scheduled" && form.scheduledAt
            ? new Date(form.scheduledAt).toISOString()
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

    // Create Stripe payment intent
    const intentRes = await fetch("/api/stripe/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: order.totalCents,
        orderId: order.id,
      }),
    });

    if (!intentRes.ok) {
      setError("Failed to initiate payment. Please try again.");
      setSubmitting(false);
      return;
    }

    const { clientSecret } = await intentRes.json();

    router.push(
      `/order/payment?secret=${encodeURIComponent(clientSecret)}&orderId=${order.id}&total=${order.totalCents}`
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

        {/* Fuel Type & Gallons */}
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
              <label className="block text-sm font-medium text-slate-700">Gallons</label>
              <input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={form.gallons}
                onChange={(e) => updateForm({ gallons: parseFloat(e.target.value) || 0 })}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              />
            </div>
          </div>
        </div>

        {/* Delivery Time */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Time</h2>
          <div className="mt-3 flex gap-4">
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

          {form.deliveryType === "scheduled" && (
            <div className="mt-3">
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => updateForm({ scheduledAt: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              />
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
            placeholder="Any special instructions (e.g., parked in the back lot)"
            className="mt-3 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          />
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">
                {FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} x {form.gallons} gal @ ${pricePerGallon.toFixed(2)}/gal
              </span>
              <span className="font-medium text-slate-900">${fuelCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Delivery Fee</span>
              <span className="font-medium text-slate-900">${deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="text-lg font-bold text-slate-900">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Processing..." : `Proceed to Payment — $${total.toFixed(2)}`}
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
