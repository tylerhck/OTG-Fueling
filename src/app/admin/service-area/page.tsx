"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ServiceAreaMap = dynamic(() => import("@/components/ServiceAreaMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[700px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
    </div>
  ),
});

const ServiceAreaPolygonMap = dynamic(() => import("@/components/ServiceAreaPolygonMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[700px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
    </div>
  ),
});

interface ServiceArea {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  polygon: [number, number][] | null;
  isActive: boolean;
}

type AreaMode = "circle" | "polygon";

export default function ServiceAreaAdmin() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [mode, setMode] = useState<AreaMode>("polygon");
  const [form, setForm] = useState({
    name: "",
    locationQuery: "",
    centerLat: 32.7555,
    centerLng: -97.3308,
    radiusMiles: 15,
  });
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [resolvedLocation, setResolvedLocation] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");

  async function loadAreas() {
    const r = await fetch("/api/service-area");
    const data = await r.json();
    setAreas(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadAreas();
  }, []);

  async function handleLookup() {
    if (!form.locationQuery.trim()) return;
    setGeocoding(true);
    setError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.locationQuery)}&format=json&limit=1&countrycodes=us`,
        { headers: { "User-Agent": "OTGFueling/1.0" } }
      );
      const data = await res.json();
      if (!data || data.length === 0) {
        setError("Location not found. Try a different city name or address.");
        setGeocoding(false);
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      setForm((prev) => ({ ...prev, centerLat: lat, centerLng: lng }));
      setResolvedLocation(data[0].display_name);
    } catch {
      setError("Failed to look up location. Please try again.");
    }
    setGeocoding(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "polygon" && polygonPoints.length < 3) {
      setError("A polygon requires at least 3 points. Click the map to add points.");
      setLoading(false);
      return;
    }

    let centerLat = form.centerLat;
    let centerLng = form.centerLng;
    let radiusMiles = form.radiusMiles;

    if (mode === "polygon" && polygonPoints.length >= 3) {
      const sumLat = polygonPoints.reduce((s, p) => s + p[0], 0);
      const sumLng = polygonPoints.reduce((s, p) => s + p[1], 0);
      centerLat = sumLat / polygonPoints.length;
      centerLng = sumLng / polygonPoints.length;
      const maxDist = polygonPoints.reduce((max, p) => {
        const d = Math.sqrt(
          Math.pow((p[0] - centerLat) * 69, 2) +
          Math.pow((p[1] - centerLng) * 69 * Math.cos(centerLat * Math.PI / 180), 2)
        );
        return Math.max(max, d);
      }, 0);
      radiusMiles = Math.ceil(maxDist) || 10;
    }

    const body: Record<string, unknown> = {
      name: form.name,
      centerLat,
      centerLng,
      radiusMiles,
      polygon: mode === "polygon" ? polygonPoints : null,
    };

    const res = editingId
      ? await fetch("/api/service-area", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...body }),
        })
      : await fetch("/api/service-area", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    if (res.ok) {
      resetForm();
      await loadAreas();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save service area");
    }
    setLoading(false);
  }

  function resetForm() {
    setForm({ name: "", locationQuery: "", centerLat: 32.7555, centerLng: -97.3308, radiusMiles: 15 });
    setPolygonPoints([]);
    setResolvedLocation("");
    setEditingId(null);
    setMode("polygon");
  }

  function startEdit(area: ServiceArea) {
    setEditingId(area.id);
    setForm({ name: area.name, locationQuery: "", centerLat: area.centerLat, centerLng: area.centerLng, radiusMiles: area.radiusMiles });
    if (area.polygon && Array.isArray(area.polygon) && area.polygon.length >= 3) {
      setMode("polygon");
      setPolygonPoints(area.polygon);
    } else {
      setMode("circle");
      setPolygonPoints([]);
    }
    setResolvedLocation("");
  }

  async function handleDelete(area: ServiceArea) {
    if (!confirm(`Delete "${area.name}"? This will deactivate the area.`)) return;
    setError("");
    const res = await fetch(`/api/service-area?id=${area.id}`, { method: "DELETE" });
    if (res.ok) {
      await loadAreas();
      if (editingId === area.id) resetForm();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to delete service area");
    }
  }

  function handleMapClick(lat: number, lng: number) {
    setForm((prev) => ({ ...prev, centerLat: lat, centerLng: lng }));
    setResolvedLocation("");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Service Area Management</h1>
      <p className="mt-1 text-sm text-slate-500">
        Define where you deliver. Draw a polygon boundary or use a circle radius.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            {editingId ? "Edit Service Area" : "Add Service Area"}
          </h2>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Area Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              placeholder="e.g. Fort Worth Metro"
            />
          </div>

          {/* Mode toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Area Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("polygon")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  mode === "polygon" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Polygon (Draw)
              </button>
              <button
                type="button"
                onClick={() => setMode("circle")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  mode === "circle" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Circle (Radius)
              </button>
            </div>
          </div>

          {mode === "circle" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">Center Location</label>
                <p className="mt-0.5 text-xs text-slate-400">Search a city/address, or click the map</p>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={form.locationQuery}
                    onChange={(e) => setForm({ ...form, locationQuery: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLookup(); } }}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                    placeholder="Fort Worth, TX"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={geocoding || !form.locationQuery.trim()}
                    className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    {geocoding ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : "Search"}
                  </button>
                </div>
                {resolvedLocation && (
                  <p className="mt-2 text-xs text-green-700">✓ {resolvedLocation}</p>
                )}
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 font-mono">
                  {form.centerLat.toFixed(4)}, {form.centerLng.toFixed(4)}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Radius</label>
                  <span className="text-sm font-semibold text-red-600">{form.radiusMiles} miles</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  step={1}
                  value={form.radiusMiles}
                  onChange={(e) => setForm({ ...form, radiusMiles: parseInt(e.target.value) })}
                  className="mt-2 w-full accent-red-500"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>1 mi</span><span>25 mi</span><span>50 mi</span>
                </div>
              </div>
            </>
          )}

          {mode === "polygon" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Polygon Points ({polygonPoints.length})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPolygonPoints((prev) => prev.slice(0, -1))}
                    disabled={polygonPoints.length === 0}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPolygonPoints([])}
                    disabled={polygonPoints.length === 0}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Click on the map to place boundary points. Minimum 3 points required.
                {polygonPoints.length > 0 && polygonPoints.length < 3 && (
                  <span className="text-amber-600 font-medium"> ({3 - polygonPoints.length} more needed)</span>
                )}
              </p>
              {polygonPoints.length >= 3 && (
                <p className="mt-1 text-xs text-green-600 font-medium">
                  ✓ Polygon ready ({polygonPoints.length} points)
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 disabled:opacity-50 transition-all"
            >
              {loading ? "Saving..." : editingId ? "Update Area" : "Create Area"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Map preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Map Preview</h2>
            <p className="text-xs text-slate-400">
              {mode === "polygon" ? "Click to add boundary points" : "Click map to move center"}
            </p>
          </div>
          {mode === "circle" ? (
            <ServiceAreaMap
              centerLat={form.centerLat}
              centerLng={form.centerLng}
              radiusMiles={form.radiusMiles}
              onCenterChange={handleMapClick}
              existingAreas={areas}
              editingAreaId={editingId}
            />
          ) : (
            <ServiceAreaPolygonMap
              polygon={polygonPoints}
              onPolygonChange={setPolygonPoints}
              centerLat={form.centerLat}
              centerLng={form.centerLng}
              existingAreas={areas}
              editingAreaId={editingId}
            />
          )}
        </div>
      </div>

      {/* Existing areas */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Current Service Areas</h2>
        {areas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No service areas configured yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {areas.map((area) => (
              <div
                key={area.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{area.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {area.polygon && Array.isArray(area.polygon) && area.polygon.length >= 3 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-red-500"></span>
                        Polygon ({area.polygon.length} points)
                      </span>
                    ) : (
                      <span>{area.radiusMiles} mile radius</span>
                    )}
                    {" · "}
                    <span className="font-mono text-xs">
                      {area.centerLat.toFixed(4)}, {area.centerLng.toFixed(4)}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2 self-start">
                  <button
                    onClick={() => startEdit(area)}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(area)}
                    className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
