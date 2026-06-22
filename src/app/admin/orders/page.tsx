"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getDeliveryWindow, formatCentralTime } from "@/lib/deliveryWindow";

// Format "HH:MM" (24h) to "h:MM AM/PM" for display
function fmtTime12(t: string): string {
  const [hr, mn] = t.split(":").map(Number);
  if (isNaN(hr) || isNaN(mn)) return t; // fallback if already formatted
  const ampm = hr >= 12 ? "PM" : "AM";
  const hour = hr % 12 || 12;
  return `${hour}:${mn.toString().padStart(2, "0")} ${ampm}`;
}

const STATUS_COLORS: Record<string, string> = {
  AWAITING_PAYMENT: "bg-slate-100 text-slate-500",
  PENDING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  UNRESOLVED: "bg-orange-100 text-orange-800",
};

interface Order {
  id: string;
  status: string;
  fuelType: string;
  gallons: number;
  totalCents: number;
  authAmountCents: number | null;
  deliveryFeeCents: number;
  isFillUp: boolean;
  deliveryType?: string;
  scheduledAt: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  etaMinutes: number | null;
  createdAt: string;
  notes: string | null;
  subscriptionDelivery: boolean;
  pinLat: number | null;
  pinLng: number | null;
  user: { name: string; email: string; phone: string | null };
  address: { street: string; city: string; state: string; zip: string };
  vehicle: { make: string; model: string; year: number; color: string; nickname: string | null; licensePlate?: string | null; fuelCapSide?: string } | null;
  guestVehicle: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  items: { kind: string; fuelType: string; gallons: number | null; isFillUp?: boolean; vehicle: { make: string; model: string; year: number; nickname: string | null; color?: string | null; licensePlate?: string | null; fuelCapSide?: string | null } | null; boat: { nickname: string | null; make: string | null; model: string | null; registrationNumber: string | null } | null }[];
}

type Tab = "active" | "pending" | "unresolved" | "history";

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [captureGallons, setCaptureGallons] = useState<Record<string, string>>({});
  const [capturePricePerGallon, setCapturePricePerGallon] = useState<Record<string, string>>({});
  const [captureServiceFee, setCaptureServiceFee] = useState<Record<string, string>>({});
  const [showCapture, setShowCapture] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<Record<string, string>>({});
  const [capturePhotos, setCapturePhotos] = useState<Record<string, string[]>>({});

  async function loadOrders() {
    const r = await fetch("/api/orders");
    const data = await r.json();
    setOrders(Array.isArray(data) ? data : []);
  }

  async function cancelOrder(orderId: string) {
    if (!confirm("Cancel this order and release any Stripe hold?")) return;
    setUpdating(orderId);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.ok) {
      await loadOrders();
    }
    setUpdating(null);
  }

  async function deleteOrder(orderId: string) {
    if (!confirm("Permanently delete this order? This cannot be undone.")) return;
    setUpdating(orderId);
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    if (res.ok) {
      await loadOrders();
    } else {
      alert("Failed to delete order");
    }
    setUpdating(null);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function capturePayment(orderId: string) {
    const gallons = parseFloat(captureGallons[orderId] || "0");
    const pricePerGallon = parseFloat(capturePricePerGallon[orderId] || "0");
    const serviceFee = parseFloat(captureServiceFee[orderId] ?? "");

    if (isNaN(serviceFee) || serviceFee < 0) {
      setCaptureError({ ...captureError, [orderId]: "Enter a valid service fee" });
      return;
    }

    // Allow 0 gallons (no-show charge), but if gallons > 0 need valid price
    if (gallons > 0 && (isNaN(pricePerGallon) || pricePerGallon <= 0)) {
      setCaptureError({ ...captureError, [orderId]: "Enter a valid price per gallon" });
      return;
    }

    if (gallons === 0 && serviceFee === 0) {
      setCaptureError({ ...captureError, [orderId]: "Must charge at least the service fee or fuel" });
      return;
    }

    setUpdating(orderId);
    setCaptureError({ ...captureError, [orderId]: "" });
    const res = await fetch(`/api/admin/orders/${orderId}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gallons: gallons || 0, pricePerGallon: pricePerGallon || 0, serviceFeeDollars: serviceFee, meterPhotos: capturePhotos[orderId] || [] }),
    });
    if (res.ok) {
      setShowCapture(null);
      await loadOrders();
    } else {
      const data = await res.json();
      setCaptureError({ ...captureError, [orderId]: data.error || "Capture failed" });
    }
    setUpdating(null);
  }

  // Pre-fill service fee when opening capture form
  function openCapture(orderId: string, deliveryFeeCents: number) {
    setShowCapture(orderId);
    if (!captureServiceFee[orderId]) {
      setCaptureServiceFee({ ...captureServiceFee, [orderId]: (deliveryFeeCents / 100).toFixed(2) });
    }
  }

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadOrders();
      } else {
        const err = await res.text();
        console.error("Status update failed:", res.status, err);
        alert(`Failed to update status: ${err}`);
      }
    } catch (e: unknown) {
      console.error("Status update error:", e);
      alert(`Error updating status: ${e instanceof Error ? e.message : e}`);
    }
    setUpdating(null);
  }

  // Tab groups
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === "ACTIVE" || o.status === "IN_PROGRESS"),
    [orders]
  );
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "PENDING"),
    [orders]
  );
  const historyOrders = useMemo(
    () => orders.filter((o) => o.status === "COMPLETED" || o.status === "CANCELLED"),
    [orders]
  );
  const unresolvedOrders = useMemo(
    () => orders.filter((o) => o.status === "UNRESOLVED"),
    [orders]
  );
  const awaitingPaymentOrders = useMemo(
    () => orders.filter((o) => o.status === "AWAITING_PAYMENT"),
    [orders]
  );

  const tabOrders = tab === "active" ? activeOrders : tab === "pending" ? pendingOrders : tab === "unresolved" ? unresolvedOrders : historyOrders;

  const filtered = useMemo(() => {
    let list = tabOrders;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.user?.name?.toLowerCase().includes(q) ||
          o.user?.email?.toLowerCase().includes(q) ||
          o.guestName?.toLowerCase().includes(q) ||
          o.guestEmail?.toLowerCase().includes(q) ||
          o.guestVehicle?.toLowerCase().includes(q) ||
          o.address?.street?.toLowerCase().includes(q) ||
          o.address?.city?.toLowerCase().includes(q) ||
          (o.vehicle && `${o.vehicle.year} ${o.vehicle.make} ${o.vehicle.model}`.toLowerCase().includes(q))
      );
    }

    // Active tab: ASAP orders first (priority), then ACTIVE before IN_PROGRESS
    if (tab === "active") {
      list = [...list].sort((a, b) => {
        const aIsAsap = !a.scheduledAt ? 1 : 0;
        const bIsAsap = !b.scheduledAt ? 1 : 0;
        // ASAP orders always on top
        if (aIsAsap !== bIsAsap) return bIsAsap - aIsAsap;
        // Then ACTIVE before IN_PROGRESS
        if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
        if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
        return 0;
      });
    }

    return list;
  }, [tabOrders, search, tab]);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
        <button
          onClick={loadOrders}
          className="self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Unpaid / abandoned sessions info strip */}
      {awaitingPaymentOrders.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
          <span className="font-medium text-slate-600">{awaitingPaymentOrders.length}</span> order{awaitingPaymentOrders.length !== 1 ? "s" : ""} awaiting payment (not yet charged — payment page not completed).
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex border-b border-gray-200">
        {([
          { key: "active" as Tab, label: "Active", orders: activeOrders },
          { key: "pending" as Tab, label: "Pending", orders: pendingOrders },
          { key: "unresolved" as Tab, label: "Unresolved", orders: unresolvedOrders },
          { key: "history" as Tab, label: "History", orders: historyOrders },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "text-red-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.orders.length > 0 && (
              <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                tab === t.key ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
              }`}>
                {t.orders.length}
              </span>
            )}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search by name, email, address, or order ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:max-w-xs"
        />
      </div>

      {/* Orders List */}
      <div className="mt-6 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
            <p className="text-sm text-gray-500">
              {search.trim()
                ? "No orders match your search."
                : tab === "active"
                ? "No active orders — you're all caught up!"
                : tab === "pending"
                ? "No pending orders."
                : tab === "unresolved"
                ? "No unresolved orders."
                : "No order history yet."}
            </p>
          </div>
        ) : (
          filtered.map((order) => {
            const isAsap = !order.scheduledAt && (order.status === "ACTIVE" || order.status === "IN_PROGRESS");
            return (
            <div
              key={order.id}
              className={`rounded-lg border p-4 transition-shadow ${
                isAsap
                  ? "border-red-400 bg-red-50 ring-2 ring-red-400 asap-pulse"
                  : order.status === "ACTIVE"
                  ? "border-green-200 bg-green-50/50"
                  : order.status === "IN_PROGRESS"
                  ? "border-indigo-200 bg-indigo-50/50"
                  : order.status === "PENDING"
                  ? "border-yellow-200 bg-yellow-50/50"
                  : ""
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium text-red-600 hover:underline"
                    >
                      #{order.id.slice(0, 8)}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[order.status] || "bg-gray-100"
                      }`}
                    >
                      {order.status.replace("_", " ")}
                    </span>
                    {isAsap && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white animate-pulse">
                        ⚡ ASAP
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {order.user?.name || order.user?.email || order.guestName || order.guestEmail || "Guest"}
                    {(order.user?.phone || order.guestPhone) && (
                      <>
                        {" "}&middot;{" "}
                        <a href={`tel:${order.user?.phone || order.guestPhone}`} className="text-blue-600 hover:underline">
                          📞 {order.user?.phone || order.guestPhone}
                        </a>
                      </>
                    )}
                    {" "}&middot;{" "}
                    {order.address?.street}, {order.address?.city}
                    {" "}
                    <a
                      href={order.pinLat && order.pinLng
                        ? `https://maps.apple.com/?ll=${order.pinLat},${order.pinLng}&q=Delivery`
                        : `https://maps.apple.com/?q=${encodeURIComponent(`${order.address?.street}, ${order.address?.city}, ${order.address?.state || ''} ${order.address?.zip || ''}`)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-200"
                    >
                      📍 Navigate
                    </a>
                  </p>
                  {/* Vehicle / Boat info — show ALL vehicles from order items */}
                  {(() => {
                    const vehicleItems = order.items?.filter(i => i.vehicle && (i.kind === "PRIMARY_VEHICLE" || i.kind === "SECOND_VEHICLE")) || [];
                    if (vehicleItems.length > 1) {
                      // Multiple vehicles — show each one clearly labeled
                      return (
                        <div className="mt-1 rounded-md border border-blue-200 bg-blue-50 p-2">
                          <p className="text-xs font-bold text-blue-800 mb-1">🚗 {vehicleItems.length} VEHICLES ON THIS ORDER:</p>
                          {vehicleItems.map((item, idx) => (
                            <p key={idx} className="text-xs text-gray-800 font-medium ml-2">
                              <span className="font-bold text-blue-700">Vehicle {idx + 1}:</span>{" "}
                              {item.vehicle?.year} {item.vehicle?.make} {item.vehicle?.model}
                              {item.vehicle?.color ? ` (${item.vehicle.color})` : ""}
                              {item.vehicle?.licensePlate ? ` · ${item.vehicle.licensePlate}` : ""}
                              {item.vehicle?.fuelCapSide && item.vehicle.fuelCapSide !== "UNKNOWN" ? ` · Cap: ${item.vehicle.fuelCapSide.replace("_", " ").toLowerCase()}` : ""}
                              {" — "}
                              <span className="font-bold text-red-700">{item.fuelType?.replace("_", " ") || "Unknown fuel"}</span>
                              {item.isFillUp ? " (Fill Up)" : item.gallons ? ` (${item.gallons} gal)` : ""}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    if (vehicleItems.length === 1) {
                      // Single vehicle from items — show with fuel type from item
                      const item = vehicleItems[0];
                      return (
                        <p className="mt-0.5 text-xs text-gray-700 font-medium">
                          🚗 {item.vehicle?.year} {item.vehicle?.make} {item.vehicle?.model}
                          {item.vehicle?.color ? ` (${item.vehicle.color})` : ""}
                          {item.vehicle?.licensePlate ? ` · ${item.vehicle.licensePlate}` : ""}
                          {item.vehicle?.fuelCapSide && item.vehicle.fuelCapSide !== "UNKNOWN" ? ` · Cap: ${item.vehicle.fuelCapSide.replace("_", " ").toLowerCase()}` : ""}
                          {" — "}{item.fuelType?.replace("_", " ") || ""}
                        </p>
                      );
                    }
                    // Fallback to order.vehicle (legacy orders without items)
                    if (order.vehicle) {
                      return (
                        <p className="mt-0.5 text-xs text-gray-700 font-medium">
                          🚗 {order.vehicle.year} {order.vehicle.make} {order.vehicle.model}{order.vehicle.color ? ` (${order.vehicle.color})` : ""}{order.vehicle.licensePlate ? ` · ${order.vehicle.licensePlate}` : ""}{order.vehicle.fuelCapSide && order.vehicle.fuelCapSide !== "UNKNOWN" ? ` · Cap: ${order.vehicle.fuelCapSide.replace("_", " ").toLowerCase()}` : ""}
                        </p>
                      );
                    }
                    if (order.guestVehicle) {
                      return (
                        <p className="mt-0.5 text-xs text-gray-700 font-medium">
                          🚗 {order.guestVehicle}
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {order.items?.some(i => i.boat) && (
                    <p className="mt-0.5 text-xs text-gray-700 font-medium">
                      ⛵ {order.items.filter(i => i.boat).map(i => `${i.boat?.make || ""} ${i.boat?.model || ""} ${i.boat?.registrationNumber ? `(${i.boat.registrationNumber})` : ""}`).join(", ")}
                    </p>
                  )}
                  {order.items?.some(i => i.kind === "DEF_ADDON" || i.kind === "DEF_ONLY") && (
                    <p className="mt-0.5 text-xs font-semibold text-purple-700">
                      🧴 DEF Fluid — {order.items.filter(i => i.kind === "DEF_ADDON" || i.kind === "DEF_ONLY").map(i => `${i.gallons || "?"} gal`).join(", ")}
                    </p>
                  )}
                  <p className="text-sm text-gray-500">
                    {order.isFillUp ? (
                      <span className="mr-1 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Fill Up</span>
                    ) : null}
                    {order.fuelType.replace("_", " ")} &middot;{" "}
                    {order.isFillUp
                      ? `$40 hold + $${(order.deliveryFeeCents / 100).toFixed(2)} service fee on completion`
                      : `$${((order.totalCents - order.deliveryFeeCents) / 100).toFixed(2)} fuel + $${(order.deliveryFeeCents / 100).toFixed(2)} fee = $${(order.totalCents / 100).toFixed(2)}`
                    } &middot;{" "}
                    {!order.scheduledAt ? "ASAP" : "Scheduled"} &middot;{" "}
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  {(() => {
                    if (order.availableFrom && order.availableTo) {
                      return (
                        <p className="mt-0.5 text-xs font-medium text-blue-700">
                          {order.notes?.includes("[Recurring") ? "🔁 Recurring — " : order.scheduledAt ? "📅 Scheduled — " : ""}Available: {fmtTime12(order.availableFrom)} – {fmtTime12(order.availableTo)}
                          {order.scheduledAt && ` · ${new Date(order.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" })}`}
                        </p>
                      );
                    }
                    if (order.notes?.includes("[Recurring") && order.scheduledAt) {
                      const timeStr = formatCentralTime(order.scheduledAt);
                      return (
                        <p className="mt-0.5 text-xs font-medium text-blue-700">
                          🔁 Recurring — Scheduled: {timeStr}
                        </p>
                      );
                    }
                    const window = getDeliveryWindow(order.scheduledAt, order.etaMinutes, 120);
                    if (!window) return null;
                    return (
                      <p className="mt-0.5 text-xs font-medium text-blue-700">
                        Vehicle at location: {window}
                      </p>
                    );
                  })()}
                  {order.notes && (
                    <p className="mt-1 text-xs text-gray-500 italic">Note: {order.notes}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* ACTIVE orders: Start Delivery, Cancel */}
                  {order.status === "ACTIVE" && (
                    <>
                      <button
                        onClick={() => updateStatus(order.id, "IN_PROGRESS")}
                        disabled={updating === order.id}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Start Delivery
                      </button>
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {/* IN_PROGRESS: ALL orders require gallons + price entry at completion */}
                  {order.status === "IN_PROGRESS" && showCapture !== order.id && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openCapture(order.id, order.deliveryFeeCents)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        Enter Gallons &amp; Complete
                      </button>
                      <button
                        onClick={() => updateStatus(order.id, "UNRESOLVED")}
                        disabled={updating === order.id}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        Move to Unresolved
                      </button>
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {order.status === "IN_PROGRESS" && showCapture === order.id && (
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="Gallons"
                            value={captureGallons[order.id] || ""}
                            onChange={(e) => setCaptureGallons({ ...captureGallons, [order.id]: e.target.value })}
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:ring-orange-500"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="$/gal"
                            value={capturePricePerGallon[order.id] || ""}
                            onChange={(e) => setCapturePricePerGallon({ ...capturePricePerGallon, [order.id]: e.target.value })}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:ring-orange-500"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Fee $"
                            value={captureServiceFee[order.id] || ""}
                            onChange={(e) => setCaptureServiceFee({ ...captureServiceFee, [order.id]: e.target.value })}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:ring-orange-500"
                          />
                        </div>
                        {/* Photo upload (up to 3) */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500 hover:border-orange-400 hover:text-orange-600">
                            📷 Add Photo {(capturePhotos[order.id]?.length || 0)}/3
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={(capturePhotos[order.id]?.length || 0) >= 3}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const img = new Image();
                                  img.onload = () => {
                                    const canvas = document.createElement("canvas");
                                    const maxW = 800;
                                    const scale = Math.min(1, maxW / img.width);
                                    canvas.width = img.width * scale;
                                    canvas.height = img.height * scale;
                                    const ctx = canvas.getContext("2d");
                                    if (ctx) {
                                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                      const compressed = canvas.toDataURL("image/jpeg", 0.7);
                                      setCapturePhotos((prev) => ({
                                        ...prev,
                                        [order.id]: [...(prev[order.id] || []), compressed].slice(0, 3),
                                      }));
                                    }
                                  };
                                  img.src = ev.target?.result as string;
                                };
                                reader.readAsDataURL(file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {(capturePhotos[order.id] || []).map((photo, idx) => (
                            <div key={idx} className="relative">
                              <img src={photo} alt={`Photo ${idx + 1}`} className="h-10 w-10 rounded object-cover border border-slate-200" />
                              <button
                                type="button"
                                onClick={() => setCapturePhotos((prev) => ({ ...prev, [order.id]: prev[order.id].filter((_, i) => i !== idx) }))}
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
                              >×</button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => capturePayment(order.id)}
                            disabled={updating === order.id}
                            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            {updating === order.id ? "..." : "Charge"}
                          </button>
                          <button
                            onClick={() => { setShowCapture(null); setCaptureError({ ...captureError, [order.id]: "" }); }}
                            className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            ✕
                          </button>
                        </div>
                        {(() => {
                          const g = parseFloat(captureGallons[order.id] || "0");
                          const p = parseFloat(capturePricePerGallon[order.id] || "0");
                          const f = parseFloat(captureServiceFee[order.id] || "0");
                          const fuelTotal = g * p;
                          const grandTotal = fuelTotal + f;
                          if (grandTotal > 0) {
                            return (
                              <p className="text-xs text-slate-600 font-medium">
                                {fuelTotal > 0 ? `$${fuelTotal.toFixed(2)} fuel` : "No fuel"} + ${f.toFixed(2)} service fee = <span className="text-orange-600 font-bold">${grandTotal.toFixed(2)} total charge</span>
                              </p>
                            );
                          }
                          return null;
                        })()}
                        {captureError[order.id] && (
                          <p className="text-xs text-red-600">{captureError[order.id]}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PENDING orders: Cancel */}
                  {order.status === "PENDING" && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      disabled={updating === order.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}

                  {/* UNRESOLVED orders: Capture, Move back to Active, Cancel */}
                  {order.status === "UNRESOLVED" && showCapture !== order.id && (
                    <>
                      <button
                        onClick={() => openCapture(order.id, order.deliveryFeeCents)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        Enter Gallons & Charge
                      </button>
                      <button
                        onClick={() => updateStatus(order.id, "ACTIVE")}
                        disabled={updating === order.id}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Move to Active
                      </button>
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {order.status === "UNRESOLVED" && showCapture === order.id && (
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="Gallons"
                            value={captureGallons[order.id] || ""}
                            onChange={(e) => setCaptureGallons({ ...captureGallons, [order.id]: e.target.value })}
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:ring-orange-500"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="$/gal"
                            value={capturePricePerGallon[order.id] || ""}
                            onChange={(e) => setCapturePricePerGallon({ ...capturePricePerGallon, [order.id]: e.target.value })}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:ring-orange-500"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Fee $"
                            value={captureServiceFee[order.id] || ""}
                            onChange={(e) => setCaptureServiceFee({ ...captureServiceFee, [order.id]: e.target.value })}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:ring-orange-500"
                          />
                        </div>
                        {/* Photo upload (up to 3) */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500 hover:border-orange-400 hover:text-orange-600">
                            📷 Add Photo {(capturePhotos[order.id]?.length || 0)}/3
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={(capturePhotos[order.id]?.length || 0) >= 3}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const img = new Image();
                                  img.onload = () => {
                                    const canvas = document.createElement("canvas");
                                    const maxW = 800;
                                    const scale = Math.min(1, maxW / img.width);
                                    canvas.width = img.width * scale;
                                    canvas.height = img.height * scale;
                                    const ctx = canvas.getContext("2d");
                                    if (ctx) {
                                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                      const compressed = canvas.toDataURL("image/jpeg", 0.7);
                                      setCapturePhotos((prev) => ({
                                        ...prev,
                                        [order.id]: [...(prev[order.id] || []), compressed].slice(0, 3),
                                      }));
                                    }
                                  };
                                  img.src = ev.target?.result as string;
                                };
                                reader.readAsDataURL(file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {(capturePhotos[order.id] || []).map((photo, idx) => (
                            <div key={idx} className="relative">
                              <img src={photo} alt={`Photo ${idx + 1}`} className="h-10 w-10 rounded object-cover border border-slate-200" />
                              <button
                                type="button"
                                onClick={() => setCapturePhotos((prev) => ({ ...prev, [order.id]: prev[order.id].filter((_, i) => i !== idx) }))}
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
                              >×</button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => capturePayment(order.id)}
                            disabled={updating === order.id}
                            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            {updating === order.id ? "..." : "Charge"}
                          </button>
                          <button
                            onClick={() => { setShowCapture(null); setCaptureError({ ...captureError, [order.id]: "" }); }}
                            className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            ✕
                          </button>
                        </div>
                        {(() => {
                          const g = parseFloat(captureGallons[order.id] || "0");
                          const p = parseFloat(capturePricePerGallon[order.id] || "0");
                          const f = parseFloat(captureServiceFee[order.id] || "0");
                          const fuelTotal = g * p;
                          const grandTotal = fuelTotal + f;
                          if (grandTotal > 0) {
                            return (
                              <p className="text-xs text-slate-600 font-medium">
                                {fuelTotal > 0 ? `$${fuelTotal.toFixed(2)} fuel` : "No fuel"} + ${f.toFixed(2)} service fee = <span className="text-orange-600 font-bold">${grandTotal.toFixed(2)} total charge</span>
                              </p>
                            );
                          }
                          return null;
                        })()}
                        {captureError[order.id] && (
                          <p className="text-xs text-red-600">{captureError[order.id]}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Awaiting Payment: Cancel */}
                  {order.status === "AWAITING_PAYMENT" && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      disabled={updating === order.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                  {/* Delete button for completed/cancelled/unresolved orders */}
                  {(order.status === "COMPLETED" || order.status === "CANCELLED") && (
                    <button
                      onClick={() => deleteOrder(order.id)}
                      disabled={updating === order.id}
                      className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* ASAP pulse animation */}
      <style jsx>{`
        @keyframes asapPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            box-shadow: 0 0 20px 6px rgba(239, 68, 68, 0.4);
          }
        }
        .asap-pulse {
          animation: asapPulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
