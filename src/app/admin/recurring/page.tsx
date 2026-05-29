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

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

export default function AdminRecurringPage() {
  const [orders, setOrders] = useState<RecurringOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/recurring-orders")
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

      {orders.length === 0 ? (
        <p className="text-gray-500">No recurring orders set up yet.</p>
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
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
