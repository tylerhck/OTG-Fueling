"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  nickname?: string;
}

interface Address {
  id: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  label?: string;
}

interface RecurringOrder {
  id: string;
  vehicleId: string | null;
  addressId: string;
  fuelType: string;
  isFillUp: boolean;
  gallons: number | null;
  dayOfWeek: string;
  preferredTime: string;
  windowFrom: string | null;
  windowTo: string | null;
  isActive: boolean;
  notes: string | null;
  lastOrderDate: string | null;
  vehicle: Vehicle | null;
  address: Address | null;
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export default function RecurringOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: "",
    addressId: "",
    fuelType: "REGULAR_87",
    isFillUp: true,
    gallons: 15,
    dayOfWeek: "MONDAY",
    windowFrom: "08:00",
    windowTo: "17:00",
    notes: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  async function fetchData() {
    try {
      const [ordersRes, vehiclesRes, addressesRes, profileRes] = await Promise.all([
        fetch("/api/recurring-orders"),
        fetch("/api/vehicles"),
        fetch("/api/addresses"),
        fetch("/api/profile"),
      ]);
      const orders = await ordersRes.json();
      const vehs = await vehiclesRes.json();
      const addrs = await addressesRes.json();
      const profileData = await profileRes.json();

      setRecurringOrders(Array.isArray(orders) ? orders : []);
      setVehicles(Array.isArray(vehs) ? vehs : []);
      setAddresses(Array.isArray(addrs) ? addrs : []);
      setPhone(profileData.phone || null);

      // Set defaults
      if (vehs.length > 0) setFormData((f) => ({ ...f, vehicleId: vehs[0].id }));
      if (addrs.length > 0) setFormData((f) => ({ ...f, addressId: addrs[0].id }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/recurring-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          gallons: formData.isFillUp ? undefined : formData.gallons,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create recurring order");
        return;
      }
      setRecurringOrders((prev) => [data, ...prev]);
      setShowForm(false);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const res = await fetch("/api/recurring-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRecurringOrders((prev) =>
          prev.map((o) => (o.id === id ? updated : o))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this recurring order?")) return;
    try {
      const res = await fetch(`/api/recurring-orders?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecurringOrders((prev) => prev.filter((o) => o.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
              ← Back to Profile
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Recurring Fill-Ups</h1>
            <p className="text-sm text-gray-600 mt-1">
              Set it and forget it — we&apos;ll automatically create your order every week.
            </p>
          </div>
          {vehicles.length > 0 && addresses.length > 0 && phone && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              {showForm ? "Cancel" : "+ New Recurring"}
            </button>
          )}
        </div>

        {/* Missing requirements banner */}
        {(vehicles.length === 0 || addresses.length === 0 || !phone) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-amber-900">Complete your profile first</h3>
            <p className="text-sm text-amber-700 mt-1">
              Before setting up a recurring fill-up, you need to add the following:
            </p>
            <ul className="mt-3 space-y-2">
              {!phone && (
                <li className="flex items-center gap-2 text-sm text-amber-800">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-amber-700 text-xs font-bold">!</span>
                  <span>Phone number — <Link href="/profile" className="underline font-medium hover:text-amber-900">Edit profile</Link></span>
                </li>
              )}
              {vehicles.length === 0 && (
                <li className="flex items-center gap-2 text-sm text-amber-800">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-amber-700 text-xs font-bold">!</span>
                  <span>At least one vehicle — <Link href="/profile/vehicles" className="underline font-medium hover:text-amber-900">Add vehicle</Link></span>
                </li>
              )}
              {addresses.length === 0 && (
                <li className="flex items-center gap-2 text-sm text-amber-800">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-amber-700 text-xs font-bold">!</span>
                  <span>At least one delivery address — <Link href="/profile/addresses" className="underline font-medium hover:text-amber-900">Add address</Link></span>
                </li>
              )}
            </ul>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 mb-6 space-y-4">
            <h3 className="font-semibold text-lg">Set Up Recurring Fill-Up</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
              <select
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Select a vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nickname || `${v.year} ${v.make} ${v.model}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <select
                value={formData.addressId}
                onChange={(e) => setFormData({ ...formData, addressId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Select an address</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ? `${a.label} — ` : ""}{a.street}, {a.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
              <select
                value={formData.dayOfWeek}
                onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{DAY_LABELS[d]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What hours will your vehicle be at this location?</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <select
                    value={formData.windowFrom}
                    onChange={(e) => setFormData({ ...formData, windowFrom: e.target.value, windowTo: e.target.value >= formData.windowTo ? "" : formData.windowTo })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 25 }, (_, i) => {
                      const h = Math.floor(i / 2) + 8;
                      const m = (i % 2) * 30;
                      if (h > 19 || (h === 19 && m > 30)) return null;
                      const val = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                      const ampm = h >= 12 ? "PM" : "AM";
                      const label = `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
                      return <option key={val} value={val}>{label}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <select
                    value={formData.windowTo}
                    onChange={(e) => setFormData({ ...formData, windowTo: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select end</option>
                    {Array.from({ length: 25 }, (_, i) => {
                      const h = Math.floor(i / 2) + 8;
                      const m = (i % 2) * 30;
                      if (h > 20 || (h === 20 && m > 0)) return null;
                      const val = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                      if (val <= formData.windowFrom) return null;
                      const ampm = h >= 12 ? "PM" : "AM";
                      const label = `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
                      return <option key={val} value={val}>{label}</option>;
                    })}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
              <select
                value={formData.fuelType}
                onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="REGULAR_87">Regular 87</option>
                <option value="PREMIUM_93">Premium 93</option>
                <option value="DIESEL">Diesel</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isFillUp"
                checked={formData.isFillUp}
                onChange={(e) => setFormData({ ...formData, isFillUp: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="isFillUp" className="text-sm text-gray-700">Fill up completely (recommended)</label>
            </div>

            {!formData.isFillUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gallons</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  step="0.5"
                  value={formData.gallons}
                  onChange={(e) => setFormData({ ...formData, gallons: parseFloat(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., Park in driveway"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>How it works:</strong> Every {DAY_LABELS[formData.dayOfWeek]}, we&apos;ll deliver
              during your availability window ({(() => {
                const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`; };
                return `${fmt(formData.windowFrom)} \u2013 ${fmt(formData.windowTo || "20:00")}`;
              })()}). We&apos;ll pre-authorize $1 on your card, then charge the actual fuel cost after fill-up.
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Setting up..." : "Set Up Recurring Fill-Up"}
            </button>
          </form>
        )}

        {/* List of recurring orders */}
        {recurringOrders.length === 0 && !showForm ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <div className="text-4xl mb-3">⛽</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No recurring fill-ups yet</h3>
            <p className="text-gray-600 text-sm mb-4">
              Set up a weekly fill-up and never worry about running low again.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              Set Up Your First Recurring Fill-Up
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {recurringOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow-sm border p-5 ${!order.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        Every {DAY_LABELS[order.dayOfWeek]}
                      </span>
                      <span className="text-sm text-gray-500">
                        {order.windowFrom && order.windowTo
                          ? (() => { const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`; }; return `${fmt(order.windowFrom)} \u2013 ${fmt(order.windowTo)}`; })()
                          : `at ${order.preferredTime}`}
                      </span>
                      {order.isActive ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Paused</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {order.vehicle
                        ? `${order.vehicle.nickname || `${order.vehicle.year} ${order.vehicle.make} ${order.vehicle.model}`}`
                        : "No vehicle"}
                      {" • "}
                      {order.isFillUp ? "Fill up" : `${order.gallons} gal`}
                      {" • "}
                      {order.fuelType.replace("_", " ")}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      📍 {order.address?.street}, {order.address?.city}
                    </p>
                    {order.lastOrderDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last order: {new Date(order.lastOrderDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(order.id, order.isActive)}
                      className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50"
                    >
                      {order.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
