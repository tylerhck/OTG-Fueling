"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BoatForm from "@/components/BoatForm";
import Link from "next/link";
import { FUEL_TYPE_LABELS } from "@/types";

interface Boat {
  id: string;
  nickname: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  registrationNumber: string;
  notes: string | null;
  fuelType: string;
  isDefault: boolean;
}

export default function BoatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBoat, setEditingBoat] = useState<Boat | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  const fetchBoats = useCallback(async () => {
    const res = await fetch("/api/boats");
    if (res.ok) {
      const data = await res.json();
      setBoats(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session?.user?.id) fetchBoats();
  }, [session, fetchBoats]);

  async function handleAdd(data: {
    nickname: string;
    make: string;
    model: string;
    year: number | "";
    color: string;
    registrationNumber: string;
    notes: string;
    fuelType: string;
    isDefault: boolean;
  }) {
    setFormLoading(true);
    const res = await fetch("/api/boats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        year: data.year === "" ? undefined : data.year,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      await fetchBoats();
    }
    setFormLoading(false);
  }

  async function handleEdit(data: {
    nickname: string;
    make: string;
    model: string;
    year: number | "";
    color: string;
    registrationNumber: string;
    notes: string;
    fuelType: string;
    isDefault: boolean;
  }) {
    if (!editingBoat) return;
    setFormLoading(true);
    const res = await fetch(`/api/boats/${editingBoat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        year: data.year === "" ? undefined : data.year,
      }),
    });
    if (res.ok) {
      setEditingBoat(null);
      await fetchBoats();
    }
    setFormLoading(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/boats/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteConfirm(null);
      await fetchBoats();
    }
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/boats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await fetchBoats();
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/profile" className="text-sm font-medium text-red-600 hover:text-red-500">
            &larr; Back to Profile
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">My Boats</h1>
          <p className="mt-1 text-sm text-slate-500">
            Save your boats for quick fuel ordering
          </p>
        </div>
        {!showForm && !editingBoat && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all"
          >
            + Add Boat
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Add New Boat</h2>
          <BoatForm
            onSubmit={handleAdd}
            onCancel={() => setShowForm(false)}
            loading={formLoading}
          />
        </div>
      )}

      {/* Edit Form */}
      {editingBoat && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Edit Boat</h2>
          <BoatForm
            initial={{
              nickname: editingBoat.nickname || "",
              make: editingBoat.make || "",
              model: editingBoat.model || "",
              year: editingBoat.year ?? "",
              color: editingBoat.color || "",
              registrationNumber: editingBoat.registrationNumber,
              notes: editingBoat.notes || "",
              fuelType: editingBoat.fuelType,
              isDefault: editingBoat.isDefault,
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditingBoat(null)}
            loading={formLoading}
          />
        </div>
      )}

      {/* Boat List */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {boats.map((boat) => {
          const displayName = boat.nickname ||
            [boat.year, boat.make, boat.model].filter(Boolean).join(" ") ||
            "Boat";
          return (
            <div key={boat.id}>
              <div className={`rounded-2xl border p-5 shadow-sm ${boat.isDefault ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{displayName}</p>
                      {boat.isDefault && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Default</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Reg: {boat.registrationNumber}</p>
                    {boat.color && <p className="text-xs text-slate-400">{boat.color}</p>}
                    <p className="mt-1 text-xs text-slate-400">{FUEL_TYPE_LABELS[boat.fuelType as keyof typeof FUEL_TYPE_LABELS]}</p>
                    {boat.notes && <p className="mt-1 text-xs text-slate-400 italic">{boat.notes}</p>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => { setShowForm(false); setEditingBoat(boat); }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Edit
                  </button>
                  {!boat.isDefault && (
                    <button
                      onClick={() => handleSetDefault(boat.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirm(boat.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {deleteConfirm === boat.id && (
                <div className="mt-2 rounded-lg bg-red-50 p-3">
                  <p className="text-sm text-red-700">Delete {displayName}?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleDelete(boat.id)}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-md bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {boats.length === 0 && !showForm && (
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 6h18M3 14h12m-6 4h6" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No boats yet</h3>
          <p className="mt-1 text-sm text-slate-500">Add a boat to speed up your fuel orders.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all"
          >
            + Add Your First Boat
          </button>
        </div>
      )}
    </div>
  );
}
