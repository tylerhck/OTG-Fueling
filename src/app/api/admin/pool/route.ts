import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const POOL_KEY = "pool_tally";

interface Player {
  name: string;
  wins: number;
}

async function getPlayers(): Promise<Player[]> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: POOL_KEY },
  });
  if (!setting) return [];
  try {
    return JSON.parse(setting.value) as Player[];
  } catch {
    return [];
  }
}

async function savePlayers(players: Player[]) {
  await prisma.siteSetting.upsert({
    where: { key: POOL_KEY },
    update: { value: JSON.stringify(players) },
    create: { key: POOL_KEY, value: JSON.stringify(players) },
  });
}

export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const players = await getPlayers();
    return NextResponse.json({ players });
  } catch (error) {
    console.error("Pool GET error:", error);
    return NextResponse.json({ error: "Failed to fetch scores" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { action, name, amount } = body;

    let players = await getPlayers();

    if (action === "add") {
      const player = players.find((p) => p.name === name);
      if (player) {
        player.wins = Math.max(0, player.wins + (amount || 1));
      }
      await savePlayers(players);
    } else if (action === "addPlayer") {
      if (!name?.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      if (players.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
        return NextResponse.json({ error: "Player already exists" }, { status: 400 });
      }
      players.push({ name: name.trim(), wins: 0 });
      await savePlayers(players);
    } else if (action === "removePlayer") {
      players = players.filter((p) => p.name !== name);
      await savePlayers(players);
    } else if (action === "reset") {
      players = players.map((p) => ({ ...p, wins: 0 }));
      await savePlayers(players);
    }

    return NextResponse.json({ players });
  } catch (error) {
    console.error("Pool POST error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
