"use client";
import { useEffect, useState } from "react";

interface RecurringOrder {
  id: string;
  userId: string;
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
  user: { name: string; email: string };
  vehicle: { make: string; model: string; year: number; nickname?: string } | null;
  address: { street: string; city: string; state: string; zip: string } | null;
}

const DAYS_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const DAY_FULL_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export default function AdminRecurringPage() {
  const [orders, setOrders] = useState<RecurringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDay, setFilterDay] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, customerName: string) => {
    if (!confirm(`Delete recurring order for ${customerName}? This removes it completely.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/recurring-orders?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.filter((o) => o.id !== id));
      } else {
        alert(data.error || "Failed to delete");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    fetch("/api/admin/recurring-orders")
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Compute tally — only count active recurring orders
  const activeOrders = orders.filter((o) => o.isActive);
  const tally: Record<string, number> = {};
  DAYS_ORDER.forEach((day) => {
    tally[day] = activeOrders.filter((o) => o.dayOfWeek === day).length;
  });
  const maxCount = Math.max(...Object.values(tally), 1);
  const totalActive = activeOrders.length;

  // Filtered list
  const displayedOrders = filterDay
    ? orders.filter((o) => o.dayOfWeek === filterDay)
    : orders;

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Recurring Orders</h1>
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Recurring Orders</h1>
      <p className="text-sm text-gray-500 mb-6">
        All customer recurring fill-up schedules. The cron job runs daily and creates orders for matching days.
      </p>

      {/* Weekly Tally */}
      <div className="mb-8 bg-white border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Weekly Tally</h2>
          <span className="text-sm text-gray-500">{totalActive} active recurring orders</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Click a day to filter the table below. Use this to balance new subscriber assignments across the week.
        </p>
        <div className="grid grid-cols-7 gap-3">
          {DAYS_ORDER.map((day) => {
            const count = tally[day];
            const barHeight = maxCount > 0 ? Math.max((count / maxCount) * 100, 8) : 8;
            const isSelected = filterDay === day;
            const isLightest = count === Math.min(...Object.values(tally)) && count < maxCount;
            const isHeaviest = count === maxCount && count > 0;

            return (
              <button
                key={day}
                onClick={() => setFilterDay(isSelected ? null : day)}
                className={`flex flex-col items-center rounded-lg p-3 transition-all ${
                  isSelected
                    ? "bg-red-50 border-2 border-red-400 shadow-sm"
                    : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                <span className="text-xs font-medium text-gray-600 mb-2">{DAY_LABELS[day]}</span>
                <div className="w-full h-24 flex items-end justify-center">
                  <div
                    className={`w-8 rounded-t-md transition-all ${
                      isHeaviest
                        ? "bg-red-400"
                        : isLightest
                        ? "bg-green-400"
                        : "bg-blue-400"
                    }`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span className={`mt-2 text-lg font-bold ${
                  isHeaviest ? "text-red-600" : isLightest ? "text-green-600" : "text-gray-900"
                }`}>
                  {count}
                </span>
                {isLightest && count < maxCount && (
                  <span className="text-[10px] text-green-600 font-medium mt-0.5">Lightest</span>
                )}
                {isHeaviest && (
                  <span className="text-[10px] text-red-600 font-medium mt-0.5">Heaviest</span>
                )}
              </button>
            );
          })}
        </div>
        {/* Recommendation */}
        {totalActive > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Suggestion:</span> Assign new subscribers to{" "}
              <span className="font-bold">
                {DAY_FULL_LABELS[DAYS_ORDER.reduce((lightest, day) => tally[day] < tally[lightest] ? day : lightest, DAYS_ORDER[0])]}
              </span>{" "}
              ({Math.min(...Object.values(tally))} orders) to balance the workload.
            </p>
          </div>
        )}
      </div>

      {/* Filter indicator */}
      {filterDay && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-700">
            Showing <span className="font-semibold">{DAY_FULL_LABELS[filterDay]}</span> orders only
          </span>
          <button
            onClick={() => setFilterDay(null)}
            className="text-xs text-red-600 hover:text-red-800 underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Orders Table */}
      {displayedOrders.length === 0 ? (
        <p className="text-gray-500">
          {filterDay ? `No recurring orders on ${DAY_FULL_LABELS[filterDay]}.` : "No recurring orders set up yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayedOrders.map((order) => (
                <tr key={order.id} className={!order.isActive ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{order.user.name}</p>
                    <p className="text-xs text-gray-500">{order.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {order.vehicle
                      ? `${order.vehicle.year} ${order.vehicle.make} ${order.vehicle.model}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{DAY_LABELS[order.dayOfWeek]}</td>
                  <td className="px-4 py-3 text-sm">{order.windowFrom && order.windowTo ? (() => { const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`; }; return `${fmt(order.windowFrom)} \u2013 ${fmt(order.windowTo)}`; })() : order.preferredTime}</td>
                  <td className="px-4 py-3 text-sm">
                    {order.isFillUp ? "Fill up" : `${order.gallons} gal`}
                    <br />
                    <span className="text-xs text-gray-500">{order.fuelType.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {order.address ? `${order.address.street}, ${order.address.city}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {order.isActive ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Paused</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {order.lastOrderDate
                      ? new Date(order.lastOrderDate).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(order.id, order.user.name)}
                      disabled={deleting === order.id}
                      className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded-full font-medium disabled:opacity-50"
                    >
                      {deleting === order.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
