"use client";

import { FUEL_TYPE_LABELS, FUEL_CAP_LABELS } from "@/types";

interface Vehicle {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  fuelCapSide: string;
  fuelType: string;
  isDefault: boolean;
}

interface VehicleCardProps {
  vehicle: Vehicle;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export default function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
  onSetDefault,
}: VehicleCardProps) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {vehicle.isDefault && (
        <span className="absolute right-4 top-4 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          Default
        </span>
      )}

      <div className="flex items-start gap-4">
        <div
          className="mt-1 h-10 w-10 flex-shrink-0 rounded-full border-2 border-slate-200"
          style={{ backgroundColor: vehicle.color.toLowerCase() }}
          title={vehicle.color}
        />

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">
            {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          </h3>
          {vehicle.nickname && (
            <p className="text-sm text-slate-600">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {FUEL_TYPE_LABELS[vehicle.fuelType as keyof typeof FUEL_TYPE_LABELS] || vehicle.fuelType}
            </span>
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              Cap: {FUEL_CAP_LABELS[vehicle.fuelCapSide as keyof typeof FUEL_CAP_LABELS] || vehicle.fuelCapSide}
            </span>
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">
              {vehicle.color}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onEdit(vehicle)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        >
          Edit
        </button>
        {!vehicle.isDefault && (
          <button
            onClick={() => onSetDefault(vehicle.id)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Set Default
          </button>
        )}
        <button
          onClick={() => onDelete(vehicle.id)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
