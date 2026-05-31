"use client";
import { useEffect, useState, useRef, useCallback } from "react";

interface CanvassZone {
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

type Mode = "navigate" | "draw" | "erase";

export default function AdminKillListPage() {
  const [zones, setZones] = useState<CanvassZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState("#E53935");
  const [mode, setMode] = useState<Mode>("navigate");
  const [saving, setSaving] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const zonesLayerRef = useRef<any>(null);
  const drawPreviewLayerRef = useRef<any>(null);
  const modeRef = useRef(mode);
  const selectedColorRef = useRef(selectedColor);
  const drawPointsRef = useRef(drawPoints);

  // Keep refs in sync
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { drawPointsRef.current = drawPoints; }, [drawPoints]);

  // Update map interaction based on mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (mode === "draw") {
      map.dragging.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
    }
  }, [mode]);

  // Fetch existing zones
  useEffect(() => {
    fetch("/api/admin/canvass-zones")
      .then((r) => r.json())
      .then((data) => setZones(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

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

  // Re-render zones when they change
  useEffect(() => {
    if (!mapInstanceRef.current || !zonesLayerRef.current) return;
    renderZones();
  }, [zones]);

  function initMap() {
    if (!mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [32.87, -97.32],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // Satellite view
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
      maxZoom: 20,
    }).addTo(map);

    // Street labels overlay
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      pane: "overlayPane",
    }).addTo(map);

    // Layer for saved zones
    const zonesLayer = L.featureGroup().addTo(map);
    zonesLayerRef.current = zonesLayer;

    // Layer for draw preview
    const drawPreviewLayer = L.featureGroup().addTo(map);
    drawPreviewLayerRef.current = drawPreviewLayer;

    // Click handler
    map.on("click", (e: any) => {
      if (modeRef.current === "draw") {
        const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
        const updated = [...drawPointsRef.current, newPoint];
        setDrawPoints(updated);
        updateDrawPreview(updated);
      }
    });

    renderZones();
  }

  function updateDrawPreview(points: [number, number][]) {
    const L = (window as any).L;
    if (!L || !drawPreviewLayerRef.current) return;

    drawPreviewLayerRef.current.clearLayers();

    // Draw dots at each point
    points.forEach((p, i) => {
      L.circleMarker(p, {
        radius: 6,
        fillColor: selectedColorRef.current,
        color: "#fff",
        weight: 2,
        fillOpacity: 1,
      }).addTo(drawPreviewLayerRef.current);
    });

    // Draw lines connecting points
    if (points.length >= 2) {
      L.polyline(points, {
        color: selectedColorRef.current,
        weight: 2,
        dashArray: "5,5",
      }).addTo(drawPreviewLayerRef.current);
    }

    // Show preview polygon if 3+ points
    if (points.length >= 3) {
      L.polygon(points, {
        color: selectedColorRef.current,
        fillColor: selectedColorRef.current,
        fillOpacity: 0.3,
        weight: 2,
        dashArray: "5,5",
      }).addTo(drawPreviewLayerRef.current);
    }
  }

  function renderZones() {
    const L = (window as any).L;
    if (!L || !zonesLayerRef.current) return;

    zonesLayerRef.current.clearLayers();

    zones.forEach((zone) => {
      // Zone stores polygon as JSON in the "notes" field hack — 
      // Actually we store polygon data differently now. Let me check the schema.
      // We're using the pin model but storing polygon coords as JSON string in notes
      // Actually let's parse: zone has lat/lng as center, and notes contains the polygon JSON
      let polygon: [number, number][] = [];
      try {
        if (zone.notes) {
          polygon = JSON.parse(zone.notes);
        }
      } catch {
        return; // Skip invalid zones
      }

      if (polygon.length < 3) return;

      const poly = L.polygon(polygon, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.35,
        weight: 2,
      });

      poly.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        if (modeRef.current === "erase") {
          deleteZone(zone.id);
        }
      });

      poly.bindTooltip(zone.label || "Canvassed area", {
        direction: "center",
      });

      zonesLayerRef.current.addLayer(poly);
    });
  }

  async function saveZone() {
    if (drawPoints.length < 3) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/canvass-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: drawPoints[0][0], // center-ish point
          lng: drawPoints[0][1],
          color: selectedColor,
          label: COLOR_OPTIONS.find((c) => c.value === selectedColor)?.desc || "Visited",
          notes: JSON.stringify(drawPoints), // Store polygon as JSON in notes
        }),
      });
      if (res.ok) {
        const newZone = await res.json();
        setZones((prev) => [newZone, ...prev]);
        // Clear drawing
        setDrawPoints([]);
        if (drawPreviewLayerRef.current) drawPreviewLayerRef.current.clearLayers();
      }
    } catch (err) {
      console.error("Failed to save zone", err);
    } finally {
      setSaving(false);
    }
  }

  const deleteZone = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/canvass-zones?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setZones((prev) => prev.filter((z) => z.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete zone", err);
    }
  }, []);

  const handleCancelDraw = useCallback(() => {
    setDrawPoints([]);
    if (drawPreviewLayerRef.current) drawPreviewLayerRef.current.clearLayers();
  }, []);

  const handleUndoPoint = useCallback(() => {
    const updated = drawPoints.slice(0, -1);
    setDrawPoints(updated);
    updateDrawPreview(updated);
  }, [drawPoints]);

  const handleClearAll = useCallback(async () => {
    if (!confirm("Delete ALL zones? This cannot be undone.")) return;
    for (const zone of zones) {
      await fetch(`/api/admin/canvass-zones?id=${zone.id}`, { method: "DELETE" });
    }
    setZones([]);
  }, [zones]);

  // Stats
  const statsByColor = COLOR_OPTIONS.map((opt) => ({
    ...opt,
    count: zones.filter((z) => z.color === opt.value).length,
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Kill List</h1>
      <p className="text-sm text-gray-500 mb-6">
        Color in neighborhoods you&apos;ve canvassed. Switch to Draw mode, tap corners to outline an area, then save it.
      </p>

      {/* Mode Toggle */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
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
            onClick={() => setMode("draw")}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              mode === "draw"
                ? "bg-red-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            ✏️ Draw
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
          {mode === "navigate" && "Drag to move, scroll to zoom. Switch to Draw to color areas."}
          {mode === "draw" && "Tap corners to outline the area you walked. Tap at least 3 points, then hit Save."}
          {mode === "erase" && "Tap any colored area to remove it."}
        </span>
      </div>

      {/* Color Picker (in draw mode) */}
      {mode === "draw" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
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

      {/* Drawing controls */}
      {mode === "draw" && drawPoints.length > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm text-red-800 font-medium">
            {drawPoints.length} point{drawPoints.length !== 1 ? "s" : ""} placed
          </span>
          {drawPoints.length >= 3 && (
            <button
              onClick={saveZone}
              disabled={saving}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Area"}
            </button>
          )}
          <button
            onClick={handleUndoPoint}
            className="px-3 py-1.5 bg-white text-gray-700 text-xs font-medium rounded-lg border hover:bg-gray-50"
          >
            Undo Last Point
          </button>
          <button
            onClick={handleCancelDraw}
            className="px-3 py-1.5 bg-white text-gray-700 text-xs font-medium rounded-lg border hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full rounded-xl border-2 overflow-hidden"
        style={{
          height: "600px",
          cursor: mode === "draw" ? "crosshair" : mode === "erase" ? "not-allowed" : "grab",
          borderColor: mode === "draw" ? "#E53935" : mode === "erase" ? "#333" : "#e5e7eb",
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
          <span className="font-semibold">{zones.length}</span> total areas
        </p>
        {zones.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Clear all areas
          </button>
        )}
      </div>

      {/* Saved zones list */}
      {zones.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Saved Areas</h3>
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between bg-white border rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                <span className="text-sm text-gray-900">{zone.label || "Unnamed"}</span>
                <span className="text-xs text-gray-400">{new Date(zone.createdAt).toLocaleDateString()}</span>
              </div>
              <button
                onClick={() => deleteZone(zone.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
