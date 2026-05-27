"use client";

import { useEffect, useState } from "react";

const DAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
] as const;

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

interface ServiceAreaOption {
  id: string;
  name: string;
}

interface SlotOverride {
  id: string;
  slotStart: string;
  isClosed: boolean;
  capacityOverride: number | null;
}

interface Schedule {
  id: string;
  dayOfWeek: string;
  serviceAreaId: string;
  serviceArea: { id: string; name: string };
  description: string | null;
  startTime: string;
  endTime: string;
  isActive: boolean;
  slotMinutes: number;
  capacityPerSlot: number;
  slotOverrides: SlotOverride[];
}

function generateSlotStarts(startTime: string, endTime: string, slotMinutes: number): string[] {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const slots: string[] = [];
  for (let t = startMins; t < endMins; t += slotMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
  return slots;
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function AdminSchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState<string | null>(null); // schedule id with open slot panel
  const [form, setForm] = useState({
    dayOfWeek: "MONDAY" as string,
    serviceAreaId: "",
    description: "",
    startTime: "08:00",
    endTime: "17:00",
    slotMinutes: 15,
    capacityPerSlot: 1,
  });

  async function load() {
    const [schedRes, areasRes] = await Promise.all([
      fetch("/api/admin/service-schedules"),
      fetch("/api/service-area"),
    ]);
    const [schedData, areasData] = await Promise.all([
      schedRes.json(),
      areasRes.json(),
    ]);
    setSchedules(schedData);
    setServiceAreas(Array.isArray(areasData) ? areasData : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({
      dayOfWeek: "MONDAY",
      serviceAreaId: serviceAreas[0]?.id || "",
      description: "",
      startTime: "08:00",
      endTime: "17:00",
      slotMinutes: 15,
      capacityPerSlot: 1,
    });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(s: Schedule) {
    setForm({
      dayOfWeek: s.dayOfWeek,
      serviceAreaId: s.serviceAreaId,
      description: s.description || "",
      startTime: s.startTime,
      endTime: s.endTime,
      slotMinutes: s.slotMinutes,
      capacityPerSlot: s.capacityPerSlot,
    });
    setEditingId(s.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      await fetch(`/api/admin/service-schedules/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/admin/service-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }

    setSaving(false);
    resetForm();
    load();
  }

  async function toggleActive(s: Schedule) {
    await fetch(`/api/admin/service-schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule entry?")) return;
    await fetch(`/api/admin/service-schedules/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleSlotClosed(scheduleId: string, slotStart: string, currentlyClosed: boolean) {
    if (currentlyClosed) {
      // Re-open: delete the override
      await fetch(
        `/api/admin/service-schedules/${scheduleId}/overrides/${encodeURIComponent(slotStart)}`,
        { method: "DELETE" }
      );
    } else {
      // Close the slot
      await fetch(`/api/admin/service-schedules/${scheduleId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotStart, isClosed: true }),
      });
    }
    load();
  }

  async function updateSlotCapacity(scheduleId: string, slotStart: string, capacity: number | null) {
    await fetch(`/api/admin/service-schedules/${scheduleId}/overrides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotStart, isClosed: false, capacityOverride: capacity }),
    });
    load();
  }

  // Group schedules by day
  const grouped = DAYS.map((day) => ({
    day,
    label: DAY_LABELS[day],
    items: schedules.filter((s) => s.dayOfWeek === day),
  }));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">
            Assign service areas to days of the week. Each schedule generates 15-minute time slots. Active schedules are shown on the website.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="self-start rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
        >
          + Add Schedule
        </button>
      </div>

      {serviceAreas.length === 0 && !loading && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No service areas found. <a href="/admin/service-area" className="font-semibold underline">Add a service area</a> first to create schedules.
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? "Edit Schedule" : "New Schedule Entry"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Day of Week</label>
              <select
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{DAY_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Service Area</label>
              <select
                required
                value={form.serviceAreaId}
                onChange={(e) => setForm({ ...form, serviceAreaId: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              >
                <option value="">Select a service area…</option>
                {serviceAreas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slot Duration (minutes)</label>
              <select
                value={form.slotMinutes}
                onChange={(e) => setForm({ ...form, slotMinutes: parseInt(e.target.value) })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              >
                <option value={15}>15 min (4/hour)</option>
                <option value={30}>30 min (2/hour)</option>
                <option value={60}>60 min (1/hour)</option>
                <option value={120}>120 min (1 per 2 hours)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Capacity per Slot (orders)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.capacityPerSlot}
                onChange={(e) => setForm({ ...form, capacityPerSlot: parseInt(e.target.value) || 1 })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Residential areas near TCU campus"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !form.serviceAreaId}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Schedule Grid */}
      {loading ? (
        <p className="mt-8 text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="mt-8 space-y-6">
          {grouped.map(({ day, label, items }) => (
            <div key={day}>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">
                {label}
              </h3>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No service scheduled</p>
              ) : (
                <div className="space-y-2">
                  {items.map((s) => {
                    const overrideMap = new Map(s.slotOverrides.map((o) => [o.slotStart, o]));
                    const allSlots = generateSlotStarts(s.startTime, s.endTime, s.slotMinutes);
                    const isSlotPanelOpen = expandedSlots === s.id;

                    return (
                      <div
                        key={s.id}
                        className={`rounded-lg border ${
                          s.isActive ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
                        }`}
                      >
                        {/* Schedule header row */}
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{s.serviceArea.name}</p>
                              <p className="text-xs text-gray-500">
                                {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                                <span className="ml-2 text-gray-400">· {s.slotMinutes}min slots · {s.capacityPerSlot}/slot</span>
                                {s.description && <span className="ml-2 text-gray-400">· {s.description}</span>}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setExpandedSlots(isSlotPanelOpen ? null : s.id)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                              {isSlotPanelOpen ? "Hide Slots" : "Manage Slots"}
                            </button>
                            <button
                              onClick={() => toggleActive(s)}
                              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                s.isActive
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {s.isActive ? "Active" : "Inactive"}
                            </button>
                            <button
                              onClick={() => startEdit(s)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Slot management panel */}
                        {isSlotPanelOpen && (
                          <div className="border-t border-gray-100 p-4">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                              Time Slots — click to close/open, edit capacity overrides
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {allSlots.map((slotStart) => {
                                const override = overrideMap.get(slotStart);
                                const isClosed = override?.isClosed ?? false;
                                const capOverride = override?.capacityOverride;

                                return (
                                  <div key={slotStart} className="flex flex-col items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleSlotClosed(s.id, slotStart, isClosed)}
                                      title={isClosed ? "Click to open slot" : "Click to close slot"}
                                      className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                                        isClosed
                                          ? "border-red-200 bg-red-50 text-red-600 line-through"
                                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      }`}
                                    >
                                      {fmtTime(slotStart)}
                                    </button>
                                    {!isClosed && (
                                      <input
                                        type="number"
                                        min={1}
                                        max={99}
                                        placeholder={String(s.capacityPerSlot)}
                                        value={capOverride ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value === "" ? null : parseInt(e.target.value);
                                          updateSlotCapacity(s.id, slotStart, val);
                                        }}
                                        title="Capacity override for this slot"
                                        className="w-12 rounded border border-gray-200 px-1 py-0.5 text-center text-xs text-gray-600 focus:border-red-400 focus:outline-none"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="mt-3 text-xs text-gray-400">
                              Green = open. Red/strikethrough = closed. The number below each slot overrides the default capacity ({s.capacityPerSlot}).
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
