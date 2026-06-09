"use client";

import { useState, useEffect, useCallback } from "react";

interface SessionInfo {
  id: string;
  ipAddress: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
}

interface UserSessions {
  userId: string;
  name: string;
  email: string;
  sessions: SessionInfo[];
}

export default function SecurityPage() {
  const [userSessions, setUserSessions] = useState<UserSessions[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sessions");
      if (res.ok) {
        const data = await res.json();
        setUserSessions(data.users || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSessions().finally(() => setLoading(false));
    // Refresh every 30 seconds
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  async function killSession(sessionId: string) {
    if (!confirm("Kill this session? The user will be logged out from that location.")) return;
    await fetch(`/api/admin/sessions/${sessionId}`, { method: "DELETE" });
    fetchSessions();
  }

  function formatLocation(city: string | null, region: string | null, country: string | null) {
    const parts = [city, region, country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Unknown location";
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function parseDevice(ua: string | null) {
    if (!ua) return "Unknown device";
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("Mac")) return "Mac";
    if (ua.includes("Windows")) return "Windows PC";
    if (ua.includes("Linux")) return "Linux";
    return "Browser";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Active Sessions</h1>
      <p className="text-sm text-gray-500 mb-6">
        See where each admin is currently logged in. If you see a location you don&apos;t recognize, kill that session and change your password immediately.
      </p>

      {userSessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No active sessions found.</p>
          <p className="text-xs mt-1">Sessions will appear here after the next login.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {userSessions.map((user) => (
            <div key={user.userId} className="border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 text-lg mb-1">{user.name}</h3>
              <p className="text-xs text-gray-500 mb-3">{user.email}</p>

              {user.sessions.length > 1 && (
                <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">
                    ⚠️ {user.sessions.length} active sessions — check if all locations are yours
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {user.sessions.map((s) => {
                  const location = formatLocation(s.city, s.region, s.country);
                  const isForeign = s.country && s.country !== "United States";
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isForeign ? "bg-red-50 border border-red-200" : "bg-gray-50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isForeign ? "text-red-700" : "text-slate-800"}`}>
                            📍 {location}
                          </span>
                          {isForeign && (
                            <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
                              FOREIGN
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {parseDevice(s.userAgent)} • IP: {s.ipAddress || "unknown"} • Logged in {formatDate(s.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => killSession(s.id)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Kill
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
