import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";
import { handle, fail } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const json = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) return fail("Invalid credentials payload", 422);

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || user.deletedAt) return fail("Invalid email or password", 401);

    const okPass = await bcrypt.compare(password, user.passwordHash);
    if (!okPass) return fail("Invalid email or password", 401);

    const authUser = {
      id: user.id, email: user.email, name: user.name,
      role: user.role, organizationId: user.organizationId,
    };
    const token = await signToken(authUser);
    await audit({ actorId: user.id, entity: "User", entityId: user.id, action: "LOGIN", req });

    const res = NextResponse.json({ user: authUser });
    res.cookies.set(TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  });
}
