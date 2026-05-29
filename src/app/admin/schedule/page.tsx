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

// Generate 30-min increment time options from 05:00 to 22:00
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 5; h <= 22; h++) {
    options.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 22) options.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
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
}

interface ServiceAreaOption {
  id: string;
  name: string;
}

export default function AdminSchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const [schedRes, areasRes] = await Promise.all([
      fetch("/api/admin/service-schedules"),
      fetch("/api/service-area"),
    ]);
    const [schedData, areasData] = await Promise.all([
      schedRes.json(),
      areasRes.json(),
    ]);
    setSchedules(Array.isArray(schedData) ? schedData : []);
    setServiceAreas(Array.isArray(areasData) ? areasData : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Get schedule for a specific day (first one found)
  function getScheduleForDay(day: string): Schedule | undefined {
    return schedules.find((s) => s.dayOfWeek === day);
  }

  // Toggle a day open/closed
  async function toggleDay(day: string) {
    const existing = getScheduleForDay(day);
    setSaving(day);

    if (existing) {
      // Toggle isActive
      await fetch(`/api/admin/service-schedules/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !existing.isActive }),
      });
    } else {
      // Create a new schedule for this day with defaults
      const areaId = serviceAreas[0]?.id;
      if (!areaId) { setSaving(null); return; }
      await fetch("/api/admin/service-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: day,
          serviceAreaId: areaId,
          startTime: "08:00",
          endTime: "20:00",
          isActive: true,
          slotMinutes: 30,
          capacityPerSlot: 99,
        }),
      });
    }
    await load();
    setSaving(null);
  }

  // Update start or end time for a day
  async function updateTime(day: string, field: "startTime" | "endTime", value: string) {
    const existing = getScheduleForDay(day);
    if (!existing) return;
    setSaving(day);
    await fetch(`/api/admin/service-schedules/${existing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await load();
    setSaving(null);
  }

  if (loading) {
    return <p className="text-gray-400 text-sm mt-8">Loading schedule...</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Service Schedule</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set which days you&apos;re available and the hours customers can schedule within. Customers pick a date and an availability window (from/to) within these hours.
        </p>
      </div>

      {serviceAreas.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-6">
          No service areas found. <a href="/admin/service-area" className="font-semibold underline">Add a service area</a> first.
        </div>
      )}

      <div className="space-y-3">
        {DAYS.map((day) => {
          const schedule = getScheduleForDay(day);
          const isOpen = schedule?.isActive ?? false;
          const isSaving = saving === day;

          return (
            <div
              key={day}
              className={`rounded-xl border p-4 transition-colors ${
                isOpen ? "border-emerald-200 bg-white" : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Day name + toggle */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <button
                    onClick={() => toggleDay(day)}
                    disabled={isSaving || serviceAreas.length === 0}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isOpen ? "bg-emerald-500" : "bg-gray-300"
                    } ${isSaving ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isOpen ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-semibold ${isOpen ? "text-gray-900" : "text-gray-400"}`}>
                    {DAY_LABELS[day]}
                  </span>
                </div>

                {/* Time selectors (only when open) */}
                {isOpen && schedule ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={schedule.startTime}
                      onChange={(e) => updateTime(day, "startTime", e.target.value)}
                      disabled={isSaving}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-red-500 focus:ring-red-500"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{fmtTime(t)}</option>
                      ))}
                    </select>
                    <span className="text-gray-400 text-sm">to</span>
                    <select
                      value={schedule.endTime}
                      onChange={(e) => updateTime(day, "endTime", e.target.value)}
                      disabled={isSaving}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-red-500 focus:ring-red-500"
                    >
                      {TIME_OPTIONS.filter((t) => t > schedule.startTime).map((t) => (
                        <option key={t} value={t}>{fmtTime(t)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 italic">Closed</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>How it works:</strong> When a day is open, customers can schedule orders on that day. They pick an availability window (e.g. 8:00 AM – 5:00 PM) within the hours you set above. This tells you when their vehicle will be at the location so you can deliver anytime within that window.
      </div>
    </div>
  );
}
