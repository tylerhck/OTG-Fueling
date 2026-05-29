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
  const mapInitialized = useRef(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!stats?.heatMapPoints?.length || !mapRef.current) return;
    if (mapInitialized.current) return;

    // Load Leaflet CSS
    const existingCss = document.querySelector('link[href*="leaflet"]');
    if (!existingCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    const existingScript = document.querySelector('script[src*="leaflet"]');
    if (existingScript) {
      initMap();
    } else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        // Load leaflet.heat plugin for heat map
        const heatScript = document.createElement("script");
        heatScript.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
        heatScript.async = true;
        heatScript.onload = initMap;
        document.head.appendChild(heatScript);
      };
      document.head.appendChild(script);
    }

    function initMap() {
      if (!mapRef.current || !stats?.heatMapPoints?.length || mapInitialized.current) return;
      mapInitialized.current = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;
      if (!L) return;

      const map = L.map(mapRef.current).setView([32.87, -97.32], 11);

      // Free OpenStreetMap tiles - no API key needed
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add heat map layer
      const heatData = stats.heatMapPoints.map((p) => [p.lat, p.lng, 1]);
      L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1.0: "red" },
      }).addTo(map);

      // Also add individual markers for each delivery
      stats.heatMapPoints.forEach((p) => {
        L.circleMarker([p.lat, p.lng], {
          radius: 6,
          fillColor: "#E53935",
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map);
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
