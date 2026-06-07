"use client";

import { useState, useEffect, useMemo } from "react";

interface WalkUpOrder {
  id: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestVehicle: string | null;
  fuelType: string | null;
  gallons: number | null;
  totalCents: number;
  deliveryFeeCents: number;
  pricePerGallonCents: number | null;
  status: string;
  createdAt: string;
  notes: string | null;
}

interface FuelPrices {
  REGULAR_87: number;
  PREMIUM_93: number;
  DIESEL: number;
}

export default function WalkUpPage() {
  const [orders, setOrders] = useState<WalkUpOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [prices, setPrices] = useState<FuelPrices | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [fuelType, setFuelType] = useState("REGULAR_87");
  const [gallons, setGallons] = useState("");
  const [pricePerGallon, setPricePerGallon] = useState("");
  const [serviceFee, setServiceFee] = useState("15.00");
  const [notes, setNotes] = useState("");

  // Fetch walk-up orders
  async function fetchOrders() {
    try {
      const res = await fetch("/api/admin/walk-up");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch walk-up orders:", err);
    } finally {
      setLoading(false);
    }
  }

  // Fetch fuel prices
  async function fetchPrices() {
    try {
      const res = await fetch("/api/fuel-prices");
      if (res.ok) {
        const data = await res.json();
        const p: FuelPrices = { REGULAR_87: 0, PREMIUM_93: 0, DIESEL: 0 };
        if (Array.isArray(data)) {
          data.forEach((fp: { fuelType: string; effectivePriceCents: number }) => {
            if (fp.fuelType === "REGULAR_87") p.REGULAR_87 = fp.effectivePriceCents / 100;
            if (fp.fuelType === "PREMIUM_93") p.PREMIUM_93 = fp.effectivePriceCents / 100;
            if (fp.fuelType === "DIESEL") p.DIESEL = fp.effectivePriceCents / 100;
          });
        }
        setPrices(p);
        // Set default price
        setPricePerGallon(p.REGULAR_87.toFixed(2));
      }
    } catch (err) {
      console.error("Failed to fetch prices:", err);
    }
  }

  useEffect(() => {
    fetchOrders();
    fetchPrices();
  }, []);

  // Auto-update price when fuel type changes
  useEffect(() => {
    if (prices) {
      const price = prices[fuelType as keyof FuelPrices] || 0;
      setPricePerGallon(price.toFixed(2));
    }
  }, [fuelType, prices]);

  // Calculate total
  const fuelCost = (parseFloat(gallons) || 0) * (parseFloat(pricePerGallon) || 0);
  const total = fuelCost + (parseFloat(serviceFee) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ text: "Email is required for the receipt", type: "error" });
      return;
    }
    if (!gallons || parseFloat(gallons) <= 0) {
      setMessage({ text: "Enter gallons delivered", type: "error" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/walk-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Walk-Up Customer",
          email: email.trim(),
          phone: phone.trim(),
          vehicle: vehicle.trim(),
          fuelType,
          gallons: parseFloat(gallons),
          pricePerGallon: parseFloat(pricePerGallon),
          serviceFeeDollars: parseFloat(serviceFee) || 0,
          notes: notes.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ text: `Order completed! Receipt sent to ${email}`, type: "success" });
        // Reset form
        setName("");
        setEmail("");
        setPhone("");
        setVehicle("");
        setGallons("");
        setNotes("");
        setServiceFee("15.00");
        setShowForm(false);
        fetchOrders();
      } else {
        const err = await res.json();
        setMessage({ text: err.error || "Failed to create order", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const fuelLabel = (ft: string | null) => {
    if (ft === "REGULAR_87") return "Regular 87";
    if (ft === "PREMIUM_93") return "Premium 93";
    if (ft === "DIESEL") return "Diesel";
    return ft || "—";
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Walk-Up Orders</h1>
          <p className="mt-1 text-sm text-gray-500">On-the-spot fuel service — no subscription needed</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
        >
          {showForm ? "Cancel" : "+ New Order"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm font-medium ${
          message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* New Order Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Walk-Up Order</h2>

          {/* Customer Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="For itemized receipt"
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
              <input
                type="text"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="e.g. 2022 Ford F-150 (White) - ABC1234"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Fuel Details */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Fuel Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="REGULAR_87">Regular 87</option>
                  <option value="PREMIUM_93">Premium 93</option>
                  <option value="DIESEL">Diesel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gallons</label>
                <input
                  type="number"
                  step="0.01"
                  value={gallons}
                  onChange={(e) => setGallons(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price/Gal ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricePerGallon}
                  onChange={(e) => setPricePerGallon(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Fee ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                  placeholder="15.00"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* Total & Submit */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
            <div>
              <p className="text-sm text-gray-500">
                Fuel: <span className="font-medium text-gray-900">${fuelCost.toFixed(2)}</span>
                {" + "}
                Service: <span className="font-medium text-gray-900">${(parseFloat(serviceFee) || 0).toFixed(2)}</span>
              </p>
              <p className="text-xl font-bold text-gray-900">
                Total: ${total.toFixed(2)}
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Creating..." : "Complete Order"}
            </button>
          </div>
        </form>
      )}

      {/* Order History */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Walk-Up Orders</h2>
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No walk-up orders yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Customer</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Fuel</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Gallons</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Total</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{order.guestName || "—"}</p>
                        <p className="text-xs text-gray-500">{order.guestEmail || ""}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fuelLabel(order.fuelType)}</td>
                      <td className="px-4 py-3 text-gray-700">{order.gallons?.toFixed(2) || "—"}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">${(order.totalCents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
