"use client";

import { useState, useEffect } from "react";
import { FUEL_TYPE_LABELS } from "@/types";

interface BoatFormData {
  nickname: string;
  make: string;
  model: string;
  year: number | "";
  color: string;
  registrationNumber: string;
  notes: string;
  fuelType: string;
  isDefault: boolean;
}

interface BoatFormProps {
  initial?: Partial<BoatFormData>;
  onSubmit: (data: BoatFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const currentYear = new Date().getFullYear();

export default function BoatForm({ initial, onSubmit, onCancel, loading }: BoatFormProps) {
  const [form, setForm] = useState<BoatFormData>({
    nickname: "",
    make: "",
    model: "",
    year: "",
    color: "",
    registrationNumber: "",
    notes: "",
    fuelType: "REGULAR_87",
    isDefault: false,
    ...initial,
  });

  useEffect(() => {
    if (initial) setForm((prev) => ({ ...prev, ...initial }));
  }, [initial]);

  function update(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Nickname <span className="text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={form.nickname}
          onChange={(e) => update("nickname", e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          placeholder='e.g. "Lake Boat"'
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Registration Number *
        </label>
        <input
          type="text"
          required
          value={form.registrationNumber}
          onChange={(e) => update("registrationNumber", e.target.value.toUpperCase())}
          className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          placeholder="e.g. TX1234AB"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Make <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={form.make}
            onChange={(e) => update("make", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
            placeholder="Yamaha"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Model <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => update("model", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
            placeholder="242X"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Year <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="number"
            min={1900}
            max={currentYear + 1}
            value={form.year}
            onChange={(e) => update("year", e.target.value === "" ? "" : parseInt(e.target.value) || "")}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
            placeholder={String(currentYear)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Color <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={form.color}
            onChange={(e) => update("color", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
            placeholder="White"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Fuel Type</label>
          <select
            value={form.fuelType}
            onChange={(e) => update("fuelType", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          >
            {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="e.g. fuel port on starboard side, keep engine off during fueling"
          className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefaultBoat"
          checked={form.isDefault}
          onChange={(e) => update("isDefault", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
        />
        <label htmlFor="isDefaultBoat" className="text-sm text-slate-700">
          Set as default boat
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 disabled:opacity-50 transition-all"
        >
          {loading ? "Saving..." : initial?.registrationNumber ? "Update Boat" : "Add Boat"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
