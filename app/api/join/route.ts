import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { hashSessionToken, isValidSessionId } from "@/lib/session-auth";
import { readJsonBody } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { id, lat, lng } (raw coords).
// Applies a 1–3 km privacy offset and creates a transient presence row. Raw
// coordinates and the issued bearer token are never stored.
export async function POST(request: NextRequest) {
  const parsed = await readJsonBody(request, 2048);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.status === 413 ? "body too large" : "invalid body" },
      { status: parsed.status },
    );
  }
  const body = parsed.value;

  const { id, lat, lng } = (body ?? {}) as Record<string, unknown>;

  if (!isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const offset = applyPrivacyOffset(lat as number, lng as number);
  const token = randomBytes(32).toString("base64url");

  try {
    await prisma.presence.create({
      data: {
        id,
        tokenHash: hashSessionToken(token),
        lat: offset.lat,
        lng: offset.lng,
        busy: false,
        lastSeen: new Date(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json({ error: "session already exists" }, { status: 409 });
    }
    throw error;
  }

  return Response.json({ ok: true, token });
}
