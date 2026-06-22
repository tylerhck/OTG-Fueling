"use client";

import { useEffect, useState, useRef } from "react";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  phone: string | null;
  createdAt: string;
  _count: { orders: number };
  isSubscriber: boolean;
  promoCode: string | null;
  deletedAt: string | null;
  adminNotes: string | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  function fetchUsers() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const activeUsers = users.filter((u) => !u.deletedAt);
  const deletedUsers = users.filter((u) => u.deletedAt);

  const filteredUsers = activeUsers.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.promoCode || "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const handleDoubleClick = (user: User) => {
    if (!user.isSubscriber) return;
    setEditingId(user.id);
    setEditValue(user.promoCode || "");
  };

  const handleSavePromo = async (userId: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, promoCode: editValue }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(users.map(u => u.id === userId ? { ...u, promoCode: data.promoCode } : u));
        setEditingId(null);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update");
      }
    } catch {
      alert("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, userId: string) => {
    if (e.key === "Enter") {
      handleSavePromo(userId);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (res.ok) {
        setDeleteTarget(null);
        setDeleteReason("");
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
  };

  const PromoCell = ({ user }: { user: User }) => {
    if (editingId === user.id) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSavePromo(user.id)}
          onKeyDown={(e) => handleKeyDown(e, user.id)}
          className="w-24 rounded border border-blue-400 px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="CODE"
        />
      );
    }

    return (
      <span
        onDoubleClick={() => handleDoubleClick(user)}
        className={`cursor-pointer select-none ${
          user.promoCode
            ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
            : "text-gray-400 text-xs"
        }`}
        title={user.isSubscriber ? "Double-click to edit" : ""}
      >
        {user.promoCode || "—"}
      </span>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Users</h1>
      <p className="mt-1 text-sm text-gray-500">
        {activeUsers.length} active user{activeUsers.length !== 1 ? "s" : ""}
        {deletedUsers.length > 0 && ` · ${deletedUsers.length} deleted`}.
      </p>

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, or promo code..."
          className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {/* Mobile view */}
      <div className="mt-4 space-y-3 md:hidden">
        {filteredUsers.map((u) => (
          <div key={u.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{u.name || "—"}</p>
              <div className="flex items-center gap-2">
                {u.isSubscriber && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Subscriber
                  </span>
                )}
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
            </div>
            <p className="mt-1 text-sm text-gray-600">{u.email}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              {u.isSubscriber && <PromoCell user={u} />}
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

      {/* Desktop view */}
      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Role</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Subscriber</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Promo Code</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Orders</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Joined</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((u) => (
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
                <td className="px-4 py-3 text-sm">
                  {u.isSubscriber ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">No</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <PromoCell user={u} />
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
                      Delete
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
              This will cancel their Stripe subscription, deactivate recurring orders, cancel all pending orders, and remove their login credentials. Order history will be preserved.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Reason for deletion (optional)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g., Card never goes through, requested removal, etc."
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-red-500 focus:ring-red-500"
                rows={3}
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteReason(""); }}
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
