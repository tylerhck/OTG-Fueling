"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ServiceAreaMap = dynamic(() => import("@/components/ServiceAreaMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[350px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
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
  isActive: boolean;
}

export default function ServiceAreaAdmin() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [form, setForm] = useState({
    name: "",
    locationQuery: "",
    centerLat: 32.7555,
    centerLng: -97.3308,
    radiusMiles: 15,
  });
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
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          form.locationQuery
        )}&format=json&limit=1&countrycodes=us`,
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

    const body = {
      name: form.name,
      centerLat: form.centerLat,
      centerLng: form.centerLng,
      radiusMiles: form.radiusMiles,
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
    setForm({
      name: "",
      locationQuery: "",
      centerLat: 32.7555,
      centerLng: -97.3308,
      radiusMiles: 15,
    });
    setResolvedLocation("");
    setEditingId(null);
  }

  function startEdit(area: ServiceArea) {
    setEditingId(area.id);
    setForm({
      name: area.name,
      locationQuery: "",
      centerLat: area.centerLat,
      centerLng: area.centerLng,
      radiusMiles: area.radiusMiles,
    });
    setResolvedLocation("");
  }

  async function handleDelete(area: ServiceArea) {
    if (
      !confirm(
        `Delete "${area.name}"? This will deactivate the area. If it has active schedules you must deactivate those first.`
      )
    )
      return;

    setError("");
    const res = await fetch(`/api/service-area?id=${area.id}`, {
      method: "DELETE",
    });

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
        Define where you deliver. Search for a city or click the map to set the center.
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

          {/* Location search */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Center Location</label>
            <p className="mt-0.5 text-xs text-slate-400">
              Search a city/address, or click the map to place the center point
            </p>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={form.locationQuery}
                onChange={(e) => setForm({ ...form, locationQuery: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLookup();
                  }
                }}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="Fort Worth, TX"
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={geocoding || !form.locationQuery.trim()}
                className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {geocoding ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  "Search"
                )}
              </button>
            </div>
            {resolvedLocation && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-green-700">
                <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {resolvedLocation}
              </p>
            )}
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 font-mono">
              {form.centerLat.toFixed(4)}, {form.centerLng.toFixed(4)}
            </p>
          </div>

          {/* Radius slider */}
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
              <span>1 mi</span>
              <span>25 mi</span>
              <span>50 mi</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 disabled:opacity-50 transition-all"
            >
              {loading ? "Saving..." : editingId ? "Update Area" : "Create Area"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Map preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Map Preview</h2>
            <p className="text-xs text-slate-400">Click map to move center</p>
          </div>
          <ServiceAreaMap
            centerLat={form.centerLat}
            centerLng={form.centerLng}
            radiusMiles={form.radiusMiles}
            onCenterChange={handleMapClick}
          />
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
                    {area.radiusMiles} mile radius &middot;{" "}
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
