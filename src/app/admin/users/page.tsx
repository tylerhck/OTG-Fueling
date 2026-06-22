"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  phone: string | null;
  createdAt: string;
  deletedAt: string | null;
  adminNotes: string | null;
  _count: { orders: number };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  function fetchUsers() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setDeleteTarget(null);
        setReason("");
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch {
      alert("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  const activeUsers = users.filter((u) => !u.deletedAt);
  const deletedUsers = users.filter((u) => u.deletedAt);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Users</h1>
      <p className="mt-1 text-sm text-gray-500">
        {activeUsers.length} active user{activeUsers.length !== 1 ? "s" : ""}
        {deletedUsers.length > 0 && ` · ${deletedUsers.length} deleted`}.
      </p>

      {/* Mobile cards */}
      <div className="mt-6 space-y-3 md:hidden">
        {activeUsers.map((u) => (
          <div key={u.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{u.name || "—"}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  u.role === "ADMIN"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {u.role}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{u.email}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span>{u._count.orders} order{u._count.orders !== 1 ? "s" : ""}</span>
              <span>&middot;</span>
              <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
            {u.role !== "ADMIN" && (
              <button
                onClick={() => setDeleteTarget(u)}
                className="mt-3 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Delete User
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Role</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Orders</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Joined</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {activeUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-sm font-medium">{u.name || "—"}</td>
                <td className="px-4 py-3 text-sm">{u.email}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{u._count.orders}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  {u.role !== "ADMIN" && (
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      Delete User
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Deleted users section */}
      {deletedUsers.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-700">Deleted Users</h2>
          <div className="mt-3 space-y-2">
            {deletedUsers.map((u) => (
              <div key={u.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-800">
                    {u.name || "[Deleted User]"}
                  </span>
                  <span className="text-xs text-red-600">
                    Deleted {u.deletedAt ? new Date(u.deletedAt).toLocaleDateString() : ""}
                  </span>
                </div>
                {u.adminNotes && (
                  <p className="mt-1 text-xs text-red-700 whitespace-pre-wrap">{u.adminNotes}</p>
                )}
                <p className="mt-1 text-xs text-red-600">{u._count.orders} order{u._count.orders !== 1 ? "s" : ""} on record</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Delete User</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete <strong>{deleteTarget.name || deleteTarget.email}</strong>?
            </p>
            <p className="mt-1 text-xs text-gray-500">
              This will cancel their Stripe subscription, cancel all pending orders, and remove their login credentials. Order history will be preserved.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Reason for deletion (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Card never goes through, requested removal, etc."
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-red-500 focus:ring-red-500"
                rows={3}
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setReason(""); }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
