import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import type { PollResponse } from "@/lib/types";
import { isAuthorizedSession, isValidSessionId } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/poll?id= — the single endpoint that drives the live map.
// It (1) heartbeats the caller, (2) reaps stale presence + orphan signals,
// (3) returns the filtered online peers, and (4) drains this user's mailbox.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id");

  if (!isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!(await isAuthorizedSession(request, id))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  // 1) Heartbeat only the authenticated caller.
  const heartbeat = await prisma.presence.updateMany({
    where: { id },
    data: { lastSeen: new Date(now) },
  });
  if (heartbeat.count === 0) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  // 2) Remove stale sessions, their signals, and any now-orphaned connections.
  await prisma.$executeRaw`
    WITH stale AS (
      DELETE FROM "Presence"
      WHERE "lastSeen" < ${staleCutoff}
      RETURNING id, "connectedTo"
    ),
    notified AS (
      INSERT INTO "Signal" ("id", "fromId", "toId", "type", "payload")
      SELECT gen_random_uuid()::text, stale.id, stale."connectedTo", 'end', NULL
      FROM stale
      WHERE stale."connectedTo" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM "Presence" AS peer
          WHERE peer.id = stale."connectedTo"
            AND peer."lastSeen" >= ${staleCutoff}
        )
      RETURNING id
    ),
    orphaned AS (
      DELETE FROM "Signal"
      WHERE "toId" IN (SELECT id FROM stale)
         OR "fromId" IN (SELECT id FROM stale)
      RETURNING id
    )
    UPDATE "Presence" AS current
    SET busy = false, "connectedTo" = NULL
    WHERE current."connectedTo" IN (SELECT id FROM stale)
  `;
  await prisma.signal.deleteMany({ where: { createdAt: { lt: signalCutoff } } });

  // 3) Online peers, excluding self.
  const peers = await prisma.presence.findMany({
    where: {
      id: { not: id },
      lastSeen: { gte: staleCutoff },
    },
    select: { id: true, lat: true, lng: true, busy: true },
  });

  // 4) Drain this user's mailbox: read, then delete exactly what we read so a
  // concurrently-inserted signal is never lost.
  const inbox = await prisma.signal.findMany({
    where: { toId: id },
    orderBy: { createdAt: "asc" },
  });
  if (inbox.length > 0) {
    await prisma.signal.deleteMany({
      where: {
        id: { in: inbox.filter((s) => s.type !== "request").map((s) => s.id) },
      },
    });
  }

  const response: PollResponse = {
    peers: peers.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      busy: p.busy,
    })),
    signals: inbox.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      toId: s.toId,
      type: s.type as PollResponse["signals"][number]["type"],
      payload: s.payload,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return Response.json(response);
}
