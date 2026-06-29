import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import type { AuthUser, Role } from "@/types";
import { TOKEN_COOKIE, signToken, verifyToken } from "@/lib/auth-token";

export { TOKEN_COOKIE, signToken, verifyToken };

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Read current user from cookie (server components / route handlers). */
export async function getCurrentUser(req?: NextRequest): Promise<AuthUser | null> {
  let token: string | undefined;
  if (req) {
    token = req.cookies.get(TOKEN_COOKIE)?.value;
  } else {
    const store = await cookies();
    token = store.get(TOKEN_COOKIE)?.value;
  }
  if (!token) return null;
  return verifyToken(token);
}

/** Throws if not authenticated; optionally enforces a role. */
export async function requireUser(req: NextRequest, role?: Role): Promise<AuthUser> {
  const user = await getCurrentUser(req);
  if (!user) throw new AuthError("Unauthorized", 401);
  if (role && user.role !== role) throw new AuthError("Forbidden", 403);
  return user;
}
