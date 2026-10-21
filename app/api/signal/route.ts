import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SignalType } from "@/lib/types";
import { isAuthorizedSession, isValidSessionId } from "@/lib/session-auth";
import { STALE_MS } from "@/lib/presence";
import { readJsonBody } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 64 * 1024; // SDP/ICE are small; cap to be safe.

// POST /api/signal — body { fromId, toId, type, payload? }
// Drops one message into the recipient's mailbox. Also manages the `busy`
// flag so a user can only be in one connection at a time.
export async function POST(request: NextRequest) {
  const parsed = await readJsonBody(request, MAX_PAYLOAD + 4096);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.status === 413 ? "body too large" : "invalid body" },
      { status: parsed.status },
    );
  }
  const body = parsed.value;

  const { fromId, toId, type, payload } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (
    !isValidSessionId(fromId) ||
    !isValidSessionId(toId) ||
    fromId === toId
  ) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  if (
    payload !== undefined &&
    payload !== null &&
    (typeof payload !== "string" || payload.length > MAX_PAYLOAD)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const signalType = type as SignalType;
  const payloadStr = typeof payload === "string" ? payload : null;
  if (["offer", "answer", "ice"].includes(signalType)) {
    if (!payloadStr) {
      return Response.json({ error: "payload required" }, { status: 400 });
    }
    try {
      JSON.parse(payloadStr);
    } catch {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }
  }

  if (!(await isAuthorizedSession(request, fromId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const onlineCutoff = new Date(Date.now() - STALE_MS);
  const [source, target] = await Promise.all([
    prisma.presence.findUnique({
      where: { id: fromId },
      select: { busy: true, connectedTo: true, lastSeen: true },
    }),
    prisma.presence.findUnique({
      where: { id: toId },
      select: { busy: true, connectedTo: true, lastSeen: true },
    }),
  ]);
  if (!source || source.lastSeen < onlineCutoff) {
    return Response.json({ error: "sender offline" }, { status: 404 });
  }
  if (!target || target.lastSeen < onlineCutoff) {
    return Response.json({ error: "recipient offline" }, { status: 404 });
  }

  // Enforce "one active connection at a time": if the target is already busy,
  // auto-decline the request instead of delivering it.
  if (signalType === "request") {
    if (source.busy) {
      return Response.json({ error: "sender already connected" }, { status: 409 });
    }
    if (target.busy) {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }
    const existingRequest = await prisma.signal.findFirst({
      where: { fromId, toId, type: "request" },
      select: { id: true },
    });
    if (existingRequest) {
      return Response.json({ error: "request already pending" }, { status: 409 });
    }
  }

  if (signalType === "accept" || signalType === "decline") {
    const pendingRequest = await prisma.signal.findFirst({
      where: {
        fromId: toId,
        toId: fromId,
        type: "request",
      },
      select: { id: true },
    });
    if (!pendingRequest) {
      return Response.json({ error: "no pending request" }, { status: 409 });
    }
  }

  // Accept only if both sessions are still free and roll back the first flag
  // if the other user accepted a different request at the same time.
  if (signalType === "accept") {
    const initiatorReserved = await prisma.presence.updateMany({
      where: { id: fromId, busy: false, lastSeen: { gte: onlineCutoff } },
      data: { busy: true, connectedTo: toId },
    });
    const recipientReserved = initiatorReserved.count === 1
      ? await prisma.presence.updateMany({
          where: { id: toId, busy: false, lastSeen: { gte: onlineCutoff } },
          data: { busy: true, connectedTo: fromId },
        })
      : { count: 0 };
    if (initiatorReserved.count !== 1 || recipientReserved.count !== 1) {
      if (initiatorReserved.count === 1) {
        await prisma.presence.updateMany({
          where: { id: fromId, connectedTo: toId },
          data: { busy: false, connectedTo: null },
        });
      }
      await sendDecline(fromId, toId);
      return Response.json({ ok: true, autoDeclined: true });
    }
  } else if (signalType === "decline") {
    await prisma.signal.deleteMany({
      where: { fromId: toId, toId: fromId, type: "request" },
    });
  }

  if (signalType === "offer" || signalType === "answer" || signalType === "ice") {
    if (
      !source.busy ||
      !target.busy ||
      source.connectedTo !== toId ||
      target.connectedTo !== fromId
    ) {
      return Response.json({ error: "no active connection" }, { status: 409 });
    }
  }

  if (signalType === "end" && source.busy) {
    if (source.connectedTo !== toId || target.connectedTo !== fromId) {
      return Response.json({ error: "not connected to recipient" }, { status: 409 });
    }
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] }, connectedTo: { not: null } },
      data: { busy: false, connectedTo: null },
    });
  } else if (signalType === "end" && target.busy) {
    return Response.json({ error: "not connected to recipient" }, { status: 409 });
  } else if (signalType === "end") {
    await prisma.signal.deleteMany({
      where: { fromId, toId, type: "request" },
    });
  }

  try {
    await prisma.signal.create({
      data: { fromId, toId, type: signalType, payload: payloadStr },
    });
  } catch (error) {
    if (signalType === "accept") {
      await prisma.presence.updateMany({
        where: {
          id: { in: [fromId, toId] },
          connectedTo: { in: [fromId, toId] },
        },
        data: { busy: false, connectedTo: null },
      });
    }
    throw error;
  }
  if (signalType === "accept") {
    await prisma.signal.deleteMany({
      where: { fromId: toId, toId: fromId, type: "request" },
    });
  }

  return Response.json({ ok: true });
}

// Helper: deliver an auto-decline from `target` back to `initiator`.
async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: { fromId: targetId, toId: initiatorId, type: "decline", payload: null },
  });
}
