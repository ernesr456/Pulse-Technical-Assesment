import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedToken, isValidSessionId } from "@/lib/session-auth";
import { readJsonBody } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id }. Removes the presence row and any pending
// signals to/from this user. Called via navigator.sendBeacon on tab close, so
// the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  const parsed = await readJsonBody(request, 2048);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.status === 413 ? "body too large" : "invalid body" },
      { status: parsed.status },
    );
  }
  const body = parsed.value;

  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    !isValidSessionId(body.id) ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const { id, token } = body;
  if (!(await isAuthorizedToken(id, token))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const presence = await prisma.presence.findUnique({
    where: { id },
    select: { connectedTo: true },
  });
  const peerId = presence?.connectedTo;
  if (peerId) {
    await prisma.presence.updateMany({
      where: { id: peerId, connectedTo: id },
      data: { busy: false, connectedTo: null },
    });
  }

  // Independent cleanup deletes — no atomicity needed (and interactive
  // transactions are unreliable over a PgBouncer pooler).
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: id }, { fromId: id }] },
  });
  if (peerId) {
    await prisma.signal.create({
      data: { fromId: id, toId: peerId, type: "end" },
    });
  }
  await prisma.presence.deleteMany({ where: { id } });

  return Response.json({ ok: true });
}
