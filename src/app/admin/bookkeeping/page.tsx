"use client";

import { useState, useEffect } from "react";

interface BookkeepingData {
  totals: {
    fuelRevenue: number;
    serviceFeeRevenue: number;
    subscriptionRevenue: number;
    totalRevenue: number;
    totalGallons: number;
    totalOrders: number;
  };
  monthly: {
    month: string;
    fuelRevenue: number;
    serviceFeeRevenue: number;
    subscriptionRevenue: number;
    totalRevenue: number;
    gallons: number;
    orders: number;
  }[];
}

export default function BookkeepingPage() {
  const [data, setData] = useState<BookkeepingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "month" | "week" | "today">("all");

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookkeeping?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch bookkeeping data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [period]);

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookkeeping</h1>
          <p className="mt-1 text-sm text-gray-500">Revenue breakdown — fuel, service fees, subscriptions</p>
        </div>
        {/* Period filter */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["today", "week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {p === "all" ? "All Time" : p === "month" ? "This Month" : p === "week" ? "This Week" : "Today"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{fmt(data.totals.totalRevenue)}</p>
              <p className="mt-1 text-xs text-gray-400">{data.totals.totalOrders} orders</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Fuel Revenue</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{fmt(data.totals.fuelRevenue)}</p>
              <p className="mt-1 text-xs text-gray-400">{data.totals.totalGallons.toFixed(1)} gallons</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Service Fees</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{fmt(data.totals.serviceFeeRevenue)}</p>
              <p className="mt-1 text-xs text-gray-400">Per-order delivery fees</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Subscriptions</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{fmt(data.totals.subscriptionRevenue)}</p>
              <p className="mt-1 text-xs text-gray-400">Monthly recurring</p>
            </div>
          </div>

          {/* Monthly Breakdown Table */}
          {data.monthly.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h2>
              <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Month</th>
                        <th className="px-4 py-3 text-right font-medium text-blue-600">Fuel</th>
                        <th className="px-4 py-3 text-right font-medium text-green-600">Service Fees</th>
                        <th className="px-4 py-3 text-right font-medium text-purple-600">Subscriptions</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Total</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Gallons</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Orders</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.monthly.map((row) => (
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.month}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt(row.fuelRevenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt(row.serviceFeeRevenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt(row.subscriptionRevenue)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(row.totalRevenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{row.gallons.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{row.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-8 text-center text-gray-500">Failed to load data</div>
      )}
    </div>
  );
}
