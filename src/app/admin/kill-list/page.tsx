"use client";
import { useEffect, useState, useRef, useCallback } from "react";

interface CanvassPin {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string | null;
  notes: string | null;
  createdAt: string;
}

const COLOR_OPTIONS = [
  { value: "#E53935", label: "Red", desc: "Visited" },
  { value: "#43A047", label: "Green", desc: "Signed up" },
  { value: "#FB8C00", label: "Orange", desc: "Follow up" },
  { value: "#1E88E5", label: "Blue", desc: "Scheduled" },
  { value: "#8E24AA", label: "Purple", desc: "Commercial" },
  { value: "#6D4C41", label: "Brown", desc: "No interest" },
];

type Mode = "mark" | "erase" | "navigate";

export default function AdminKillListPage() {
  const [pins, setPins] = useState<CanvassPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState("#E53935");
  const [mode, setMode] = useState<Mode>("navigate");
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const selectedColorRef = useRef(selectedColor);
  const modeRef = useRef(mode);

  // Keep refs in sync
  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => {
    modeRef.current = mode;
    const map = mapInstanceRef.current;
    if (!map) return;
    // In mark mode, disable map dragging so clicks register as pins
    if (mode === "mark") {
      map.dragging.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
    }
  }, [mode]);

  // Fetch existing pins
  useEffect(() => {
    fetch("/api/admin/canvass-zones")
      .then((r) => r.json())
      .then((data) => setPins(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });

    loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js").then(() => {
      initMap();
    });
  }, []);

  // Re-render markers when pins change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    renderMarkers();
  }, [pins]);

  function initMap() {
    if (!mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [32.87, -97.32],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // Satellite view for seeing individual houses
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
      maxZoom: 20,
    }).addTo(map);

    // Add street labels on top of satellite
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      pane: "overlayPane",
    }).addTo(map);

    // Markers layer
    const markersLayer = L.featureGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Click handler — add pin when in mark mode
    map.on("click", async (e: any) => {
      if (modeRef.current === "mark") {
        await addPin(e.latlng.lat, e.latlng.lng);
      }
    });

    renderMarkers();
  }

  function renderMarkers() {
    const L = (window as any).L;
    if (!L || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    pins.forEach((pin) => {
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: 10,
        fillColor: pin.color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });

      marker.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        if (modeRef.current === "erase") {
          deletePin(pin.id);
        }
      });

      const colorOption = COLOR_OPTIONS.find((c) => c.value === pin.color);
      marker.bindTooltip(
        `${colorOption?.desc || "Marked"}${pin.label ? ` — ${pin.label}` : ""}`,
        { direction: "top", offset: [0, -8] }
      );

      markersLayerRef.current.addLayer(marker);
    });
  }

  async function addPin(lat: number, lng: number) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/canvass-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          color: selectedColorRef.current,
        }),
      });
      if (res.ok) {
        const newPin = await res.json();
        setPins((prev) => [newPin, ...prev]);
      }
    } catch (err) {
      console.error("Failed to add pin", err);
    } finally {
      setSaving(false);
    }
  }

  const deletePin = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/canvass-zones?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPins((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete pin", err);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    if (!confirm("Delete ALL pins? This cannot be undone.")) return;
    for (const pin of pins) {
      await fetch(`/api/admin/canvass-zones?id=${pin.id}`, { method: "DELETE" });
    }
    setPins([]);
  }, [pins]);

  // Stats
  const statsByColor = COLOR_OPTIONS.map((opt) => ({
    ...opt,
    count: pins.filter((p) => p.color === opt.value).length,
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Kill List</h1>
      <p className="text-sm text-gray-500 mb-6">
        Mark houses and businesses you&apos;ve visited. Use Navigate mode to move around the map, then switch to Mark mode to place pins.
      </p>

      {/* Mode Toggle */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setMode("navigate")}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              mode === "navigate"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            🗺️ Navigate
          </button>
          <button
            onClick={() => setMode("mark")}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              mode === "mark"
                ? "bg-red-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            📍 Mark
          </button>
          <button
            onClick={() => setMode("erase")}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              mode === "erase"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            🧹 Erase
          </button>
        </div>
        <span className="text-xs text-gray-500 italic">
          {mode === "navigate" && "Drag to move map, scroll to zoom. Switch to Mark to place pins."}
          {mode === "mark" && "Tap the map to drop a pin. Scroll to zoom. Switch to Navigate to move around."}
          {mode === "erase" && "Tap any marker to remove it."}
        </span>
        {saving && (
          <span className="text-xs text-orange-500 font-medium ml-2">Saving...</span>
        )}
      </div>

      {/* Color Picker (only in mark mode) */}
      {mode === "mark" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedColor(opt.value)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedColor === opt.value
                  ? "border-gray-900 shadow-sm scale-105"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: opt.value }}
              />
              {opt.desc}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full rounded-xl border-2 overflow-hidden"
        style={{
          height: "600px",
          cursor: mode === "mark" ? "crosshair" : mode === "erase" ? "not-allowed" : "grab",
          borderColor: mode === "mark" ? "#E53935" : mode === "erase" ? "#333" : "#e5e7eb",
        }}
      />

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-3">
        {statsByColor.map((stat) => (
          <div key={stat.value} className="bg-white border rounded-lg p-3 text-center">
            <span
              className="inline-block w-3 h-3 rounded-full mb-1"
              style={{ backgroundColor: stat.value }}
            />
            <p className="text-lg font-bold text-gray-900">{stat.count}</p>
            <p className="text-xs text-gray-500">{stat.desc}</p>
          </div>
        ))}
      </div>

      {/* Total & Clear */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">{pins.length}</span> total pins
        </p>
        {pins.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Clear all pins
          </button>
        )}
      </div>
    </div>
  );
}
