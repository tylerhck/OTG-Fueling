"use client";

import { useState, useEffect, useCallback } from "react";

interface Player {
  name: string;
  wins: number;
}

export default function PoolTallyPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pool");
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players || []);
      }
    } catch (err) {
      console.error("Failed to fetch pool scores:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const updateScore = async (name: string, amount: number) => {
    try {
      const res = await fetch("/api/admin/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name, amount }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players || []);
      }
    } catch {
      setMessage("Failed to update score");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/admin/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addPlayer", name: newName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players || []);
        setNewName("");
      } else {
        const err = await res.json();
        setMessage(err.error || "Failed to add player");
        setTimeout(() => setMessage(null), 2000);
      }
    } catch {
      setMessage("Network error");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const removePlayer = async (name: string) => {
    if (!confirm(`Remove ${name} from the tally?`)) return;
    try {
      const res = await fetch("/api/admin/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removePlayer", name }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players || []);
      }
    } catch {
      setMessage("Failed to remove player");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const resetAll = async () => {
    if (!confirm("Reset all scores to 0?")) return;
    try {
      const res = await fetch("/api/admin/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players || []);
      }
    } catch {
      setMessage("Failed to reset");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  // Sort by wins descending
  const sorted = [...players].sort((a, b) => b.wins - a.wins);
  const leader = sorted.length > 0 ? sorted[0].wins : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎱 Pool Table Tally</h1>
          <p className="mt-1 text-sm text-gray-500">Track wins. Talk trash. No excuses.</p>
        </div>
        {players.length > 0 && (
          <button
            onClick={resetAll}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Reset Scores
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {message}
        </div>
      )}

      {/* Scoreboard */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full text-center text-gray-500 py-12">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-12">
            No players yet. Add someone below to start tracking wins.
          </div>
        ) : (
          sorted.map((player, idx) => (
            <div
              key={player.name}
              className={`relative rounded-xl border p-6 shadow-sm transition-all ${
                idx === 0 && player.wins > 0
                  ? "border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 ring-2 ring-yellow-200"
                  : "border-gray-100 bg-white hover:shadow-md"
              }`}
            >
              {/* Crown for leader */}
              {idx === 0 && player.wins > 0 && (
                <div className="absolute -top-3 -right-2 text-2xl">👑</div>
              )}

              {/* Remove button */}
              <button
                onClick={() => removePlayer(player.name)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-xs"
                title="Remove player"
              >
                ✕
              </button>

              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{player.name}</p>
                <p className={`text-5xl font-black mt-2 ${
                  idx === 0 && player.wins > 0 ? "text-yellow-600" : "text-gray-800"
                }`}>
                  {player.wins}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {player.wins === 1 ? "win" : "wins"}
                </p>
              </div>

              {/* +1 / +2 buttons */}
              <div className="mt-4 flex gap-2 justify-center">
                <button
                  onClick={() => updateScore(player.name, 1)}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500 active:scale-95 transition-all"
                >
                  +1
                </button>
                <button
                  onClick={() => updateScore(player.name, 2)}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 active:scale-95 transition-all"
                >
                  +2
                </button>
                <button
                  onClick={() => updateScore(player.name, -1)}
                  className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-300 active:scale-95 transition-all"
                >
                  −1
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Player */}
      <form onSubmit={addPlayer} className="mt-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Add Player</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Player name"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </form>

      {/* Fun stats */}
      {sorted.length >= 2 && leader > 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 p-4 text-center">
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">{sorted[0].name}</span> is leading with{" "}
            <span className="font-bold">{sorted[0].wins}</span> wins
            {sorted[1].wins > 0 && (
              <span>
                {" "}— <span className="font-medium">{sorted[0].wins - sorted[1].wins}</span> ahead of{" "}
                <span className="font-medium">{sorted[1].name}</span>
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
