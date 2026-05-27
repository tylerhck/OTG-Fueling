"use client";

import { useState, useEffect } from "react";
import { FUEL_TYPE_LABELS, FUEL_CAP_LABELS } from "@/types";

interface VehicleFormData {
  nickname: string;
  make: string;
  model: string;
  year: number;
  color: string;
  fuelCapSide: string;
  fuelType: string;
  isDefault: boolean;
}

interface VehicleFormProps {
  initial?: VehicleFormData;
  onSubmit: (data: VehicleFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const currentYear = new Date().getFullYear();

export default function VehicleForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: VehicleFormProps) {
  const [form, setForm] = useState<VehicleFormData>(
    initial || {
      nickname: "",
      make: "",
      model: "",
      year: currentYear,
      color: "",
      fuelCapSide: "UNKNOWN",
      fuelType: "REGULAR_87",
      isDefault: false,
    }
  );

  useEffect(() => {
    if (initial) setForm(initial);
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
          placeholder='e.g. "Daily Driver"'
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Make *</label>
          <input
            type="text"
            required
            value={form.make}
            onChange={(e) => update("make", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
            placeholder="Toyota"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Model *</label>
          <input
            type="text"
            required
            value={form.model}
            onChange={(e) => update("model", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
            placeholder="Camry"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Year *</label>
          <input
            type="number"
            required
            min={1900}
            max={currentYear + 1}
            value={form.year}
            onChange={(e) => update("year", parseInt(e.target.value) || currentYear)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Color *</label>
          <input
            type="text"
            required
            value={form.color}
            onChange={(e) => update("color", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
            placeholder="White"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Fuel Cap Side</label>
          <select
            value={form.fuelCapSide}
            onChange={(e) => update("fuelCapSide", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          >
            {Object.entries(FUEL_CAP_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Fuel Type</label>
          <select
            value={form.fuelType}
            onChange={(e) => update("fuelType", e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          >
            {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={form.isDefault}
          onChange={(e) => update("isDefault", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
        />
        <label htmlFor="isDefault" className="text-sm text-slate-700">
          Set as default vehicle
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 disabled:opacity-50 transition-all"
        >
          {loading ? "Saving..." : initial ? "Update Vehicle" : "Add Vehicle"}
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
