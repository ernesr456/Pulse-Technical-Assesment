import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function isValidSessionId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  );
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function isAuthorizedSession(
  request: Request,
  id: string,
): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  return token ? isAuthorizedToken(id, token) : false;
}

export async function isAuthorizedToken(
  id: string,
  token: string,
): Promise<boolean> {
  if (!token || token.length > 128) return false;

  const presence = await prisma.presence.findUnique({
    where: { id },
    select: { tokenHash: true },
  });
  if (!presence) return false;

  const storedHash = Buffer.from(presence.tokenHash, "hex");
  const suppliedHash = Buffer.from(hashSessionToken(token), "hex");
  return (
    storedHash.length === suppliedHash.length &&
    timingSafeEqual(storedHash, suppliedHash)
  );
}
