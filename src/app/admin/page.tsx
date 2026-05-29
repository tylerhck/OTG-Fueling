"use client";

import { useEffect, useState, useRef } from "react";

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  todayOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  cancellationRate: number;
  totalRevenueCents: number;
  totalCustomers: number;
  totalSubscribers: number;
  totalGallons: number;
  pageViewsTotal: number;
  uniqueVisitorsTotal: number;
  heatMapPoints: { lat: number; lng: number }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!stats?.heatMapPoints?.length || !mapRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    // Load Google Maps script
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCmQiUHADayXtjP5wPIX0MdYnrPRdAI7QA&libraries=visualization`;
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);

    function initMap() {
      if (!mapRef.current || !stats?.heatMapPoints?.length) return;
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 32.87, lng: -97.32 }, // Fort Worth area
        zoom: 11,
        mapTypeId: "roadmap",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
        ],
      });
      mapInstanceRef.current = map;

      const heatmapData = stats.heatMapPoints.map(
        (p) => new google.maps.LatLng(p.lat, p.lng)
      );

      new google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map,
        radius: 30,
        opacity: 0.7,
      });
    }
  }, [stats]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Overview of On The Go Fueling operations.
      </p>

      {stats ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                label: "Total Orders",
                value: stats.totalOrders,
                sub: `${stats.pendingOrders} pending · ${stats.todayOrders} today`,
                color: "bg-blue-50 text-blue-700",
              },
              {
                label: "Completed Orders",
                value: stats.completedOrders,
                sub: "Successfully delivered",
                color: "bg-green-50 text-green-700",
              },
              {
                label: "Total Subscribers",
                value: stats.totalSubscribers,
                sub: "Active subscriptions",
                color: "bg-indigo-50 text-indigo-700",
              },
              {
                label: "Cancellation Rate",
                value: `${stats.cancellationRate}%`,
                sub: `${stats.cancelledOrders} cancelled out of ${stats.totalOrders} orders`,
                color: stats.cancellationRate > 20 ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700",
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

          {/* Delivery Heat Map */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Delivery Heat Map</h2>
            <p className="mt-1 text-sm text-gray-500">
              Shows where deliveries are concentrated based on order pin locations.
            </p>
            {stats.heatMapPoints.length > 0 ? (
              <div
                ref={mapRef}
                className="mt-4 h-96 w-full rounded-xl border border-gray-200 overflow-hidden"
              />
            ) : (
              <div className="mt-4 flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300">
                <p className="text-sm text-gray-400">No delivery location data yet.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="mt-6 text-gray-500">Loading stats...</p>
      )}
    </div>
  );
}
