"use client";

import { useEffect, useState } from "react";

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
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleEditPromo = (user: User) => {
    setEditingId(user.id);
    setEditValue(user.promoCode || "");
  };

  const handleSavePromo = async (userId: string) => {
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Users</h1>
      <p className="mt-1 text-sm text-gray-500">
        {users.length} registered user{users.length !== 1 ? "s" : ""}.
      </p>

      {/* Mobile view */}
      <div className="mt-6 space-y-3 md:hidden">
        {users.map((u) => (
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
              {u.isSubscriber && (
                <div className="flex items-center gap-1">
                  {editingId === u.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                        placeholder="Code"
                      />
                      <button onClick={() => handleSavePromo(u.id)} disabled={saving} className="text-green-600 font-medium">
                        {saving ? "..." : "Save"}
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <>
                      {u.promoCode ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {u.promoCode}
                        </span>
                      ) : (
                        <span className="text-gray-400">No code</span>
                      )}
                      <button onClick={() => handleEditPromo(u)} className="text-blue-600 text-xs font-medium ml-1">
                        Edit
                      </button>
                    </>
                  )}
                </div>
              )}
              <span>{u._count.orders} order{u._count.orders !== 1 ? "s" : ""}</span>
              <span>&middot;</span>
              <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((u) => (
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
                  {editingId === u.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="PROMO"
                      />
                      <button
                        onClick={() => handleSavePromo(u.id)}
                        disabled={saving}
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        {saving ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {u.promoCode ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {u.promoCode}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                      {u.isSubscriber && (
                        <button
                          onClick={() => handleEditPromo(u)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{u._count.orders}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
