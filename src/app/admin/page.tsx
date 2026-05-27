"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  todayOrders: number;
  totalRevenueCents: number;
  totalCustomers: number;
  totalGallons: number;
  pageViewsTotal: number;
  uniqueVisitorsTotal: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Overview of On The Go Fueling operations.
      </p>

      {stats ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              label: "Total Orders",
              value: stats.totalOrders,
              sub: `${stats.pendingOrders} pending · ${stats.todayOrders} today`,
              color: "bg-blue-50 text-blue-700",
            },
            {
              label: "Total Revenue",
              value: `$${(stats.totalRevenueCents / 100).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}`,
              sub: "Confirmed + in progress + completed",
              color: "bg-purple-50 text-purple-700",
            },
            {
              label: "Total Customers",
              value: stats.totalCustomers,
              sub: "Registered accounts",
              color: "bg-emerald-50 text-emerald-700",
            },
            {
              label: "Total Gallons Delivered",
              value: `${stats.totalGallons.toLocaleString("en-US", { maximumFractionDigits: 1 })} gal`,
              sub: "Across all completed orders",
              color: "bg-orange-50 text-orange-700",
            },
            {
              label: "Website Visitors",
              value: stats.uniqueVisitorsTotal.toLocaleString(),
              sub: `${stats.pageViewsTotal.toLocaleString()} total page views`,
              color: "bg-sky-50 text-sky-700",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl p-6 ${stat.color}`}
            >
              <p className="text-sm font-medium opacity-80">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              {stat.sub && (
                <p className="mt-1 text-xs opacity-60">{stat.sub}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-gray-500">Loading stats...</p>
      )}
    </div>
  );
}
