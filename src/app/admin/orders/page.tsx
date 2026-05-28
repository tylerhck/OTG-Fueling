"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getDeliveryWindow, formatCentralTime } from "@/lib/deliveryWindow";

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS"];
const HISTORY_STATUSES = ["COMPLETED", "CANCELLED"];

const STATUS_COLORS: Record<string, string> = {
  AWAITING_PAYMENT: "bg-slate-100 text-slate-500",
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const STATUS_PRIORITY: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  IN_PROGRESS: 2,
};

interface Order {
  id: string;
  status: string;
  fuelType: string;
  gallons: number;
  totalCents: number;
  authAmountCents: number | null;
  isFillUp: boolean;
  deliveryType: string;
  scheduledAt: string | null;
  etaMinutes: number | null;
  createdAt: string;
  notes: string | null;
  subscriptionDelivery: boolean;
  user: { name: string; email: string };
  address: { street: string; city: string };
}

type Tab = "active" | "history";

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [etaInput, setEtaInput] = useState<Record<string, string>>({});
  const [showEta, setShowEta] = useState<string | null>(null);
  const [captureGallons, setCaptureGallons] = useState<Record<string, string>>({});
  const [showCapture, setShowCapture] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<Record<string, string>>({});

  async function loadOrders() {
    const r = await fetch("/api/orders");
    const data = await r.json();
    setOrders(Array.isArray(data) ? data : []);
  }

  async function deleteOrder(orderId: string) {
    if (!confirm("Permanently delete this order? This cannot be undone.")) return;
    setUpdating(orderId);
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    if (res.ok) {
      await loadOrders();
    }
    setUpdating(null);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  // Reset status filter when switching tabs
  useEffect(() => {
    setStatusFilter("ALL");
  }, [tab]);

  async function capturePayment(orderId: string) {
    const gallons = parseFloat(captureGallons[orderId] || "");
    if (isNaN(gallons) || gallons <= 0) {
      setCaptureError({ ...captureError, [orderId]: "Enter a valid gallon amount" });
      return;
    }
    setUpdating(orderId);
    setCaptureError({ ...captureError, [orderId]: "" });
    const res = await fetch(`/api/admin/orders/${orderId}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gallons }),
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

  async function updateStatus(orderId: string, newStatus: string, eta?: number | null) {
    setUpdating(orderId);
    const body: Record<string, unknown> = { status: newStatus };
    if (eta !== undefined) body.etaMinutes = eta;
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await loadOrders();
      setShowEta(null);
    }
    setUpdating(null);
  }

  function handleConfirmWithEta(orderId: string) {
    const mins = etaInput[orderId];
    const eta = mins ? parseInt(mins, 10) : null;
    updateStatus(orderId, "CONFIRMED", eta);
  }

  const activeOrders = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
    [orders]
  );
  const historyOrders = useMemo(
    () => orders.filter((o) => HISTORY_STATUSES.includes(o.status)),
    [orders]
  );
  const awaitingPaymentOrders = useMemo(
    () => orders.filter((o) => o.status === "AWAITING_PAYMENT"),
    [orders]
  );

  const tabStatuses = tab === "active" ? ACTIVE_STATUSES : HISTORY_STATUSES;
  const tabOrders = tab === "active" ? activeOrders : historyOrders;

  const filtered = useMemo(() => {
    let list = statusFilter === "ALL" ? tabOrders : tabOrders.filter((o) => o.status === statusFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.user?.name?.toLowerCase().includes(q) ||
          o.user?.email?.toLowerCase().includes(q) ||
          o.address?.street?.toLowerCase().includes(q) ||
          o.address?.city?.toLowerCase().includes(q)
      );
    }

    // Active orders sorted by urgency (PENDING first), history sorted newest first
    if (tab === "active") {
      list = [...list].sort(
        (a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99)
      );
    }

    return list;
  }, [tabOrders, statusFilter, search, tab]);

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
        <button
          onClick={() => setTab("active")}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "active"
              ? "text-red-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Active Orders
          {activeOrders.length > 0 && (
            <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              tab === "active" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
            }`}>
              {activeOrders.length}
            </span>
          )}
          {tab === "active" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "history"
              ? "text-red-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          History
          {historyOrders.length > 0 && (
            <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              tab === "history" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
            }`}>
              {historyOrders.length}
            </span>
          )}
          {tab === "history" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
          )}
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by name, email, address, or order ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {["ALL", ...tabStatuses].map((s) => {
            const count = tabOrders.filter((o) => o.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  statusFilter === s
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {s === "ALL" ? "All" : s.replace("_", " ")}
                {s !== "ALL" && <span className="ml-1">({count})</span>}
              </button>
            );
          })}
        </div>
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
                : "No order history yet."}
            </p>
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              className={`rounded-lg border p-4 ${
                order.status === "PENDING"
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
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {order.user?.name || order.user?.email} &middot;{" "}
                    {order.address?.street}, {order.address?.city}
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.isFillUp ? (
                      <span className="mr-1 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Fill Up</span>
                    ) : null}
                    {order.isFillUp ? `~${order.gallons} gal max` : `${order.gallons} gal`} {order.fuelType.replace("_", " ")} &middot;{" "}
                    {order.isFillUp
                      ? `Card auth: $1.00 · Est. max: $${((order.authAmountCents ?? order.totalCents) / 100).toFixed(2)}`
                      : `$${(order.totalCents / 100).toFixed(2)}`} &middot;{" "}
                    {order.deliveryType === "ASAP" ? "ASAP" : "Scheduled"} &middot;{" "}
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  {(() => {
                    // For recurring/subscription orders, show just the scheduled time (not a window)
                    if (order.subscriptionDelivery && order.scheduledAt) {
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
                </div>
                <div className="flex flex-wrap gap-2">
                  {order.status === "PENDING" && showEta !== order.id && (
                    <>
                      <button
                        onClick={() => setShowEta(order.id)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => updateStatus(order.id, "CANCELLED")}
                        disabled={updating === order.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteOrder(order.id)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {order.status === "PENDING" && showEta === order.id && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="ETA (min)"
                        value={etaInput[order.id] || ""}
                        onChange={(e) => setEtaInput({ ...etaInput, [order.id]: e.target.value })}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-red-500 focus:ring-red-500"
                      />
                      <button
                        onClick={() => handleConfirmWithEta(order.id)}
                        disabled={updating === order.id}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {updating === order.id ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setShowEta(null)}
                        className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {order.status === "CONFIRMED" && (
                    <button
                      onClick={() => updateStatus(order.id, "IN_PROGRESS")}
                      disabled={updating === order.id}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Start Delivery
                    </button>
                  )}
                  {order.status === "IN_PROGRESS" && !order.isFillUp && (
                    <button
                      onClick={() => updateStatus(order.id, "COMPLETED")}
                      disabled={updating === order.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Complete
                    </button>
                  )}
                  {order.status === "IN_PROGRESS" && order.isFillUp && showCapture !== order.id && (
                    <button
                      onClick={() => setShowCapture(order.id)}
                      disabled={updating === order.id}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      Enter Gallons &amp; Charge
                    </button>
                  )}
                  {order.status === "IN_PROGRESS" && order.isFillUp && showCapture === order.id && (
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            placeholder="Actual gal"
                            value={captureGallons[order.id] || ""}
                            onChange={(e) => setCaptureGallons({ ...captureGallons, [order.id]: e.target.value })}
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:ring-orange-500"
                          />
                          <button
                            onClick={() => capturePayment(order.id)}
                            disabled={updating === order.id}
                            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            {updating === order.id ? "..." : "Capture"}
                          </button>
                          <button
                            onClick={() => { setShowCapture(null); setCaptureError({ ...captureError, [order.id]: "" }); }}
                            className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            ✕
                          </button>
                        </div>
                        {captureError[order.id] && (
                          <p className="text-xs text-red-600">{captureError[order.id]}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Delete button - available on all orders */}
                  {(order.status === "AWAITING_PAYMENT" || order.status === "CANCELLED") && (
                    <button
                      onClick={() => deleteOrder(order.id)}
                      disabled={updating === order.id}
                      className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
