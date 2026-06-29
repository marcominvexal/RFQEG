import { SignJWT, jwtVerify } from "jose";
import type { AuthUser, Role } from "@/types";

// Edge-safe (jose only). No next/headers import here so this module can be
// used from middleware (Edge runtime) without bundling Node-only APIs.

export const TOKEN_COOKIE = "rfq_token";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not configured");
  return new TextEncoder().encode(s);
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || "8h")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
      organizationId: payload.organizationId as string,
    };
  } catch {
    return null;
  }
}
