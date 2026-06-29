import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return fail("Unauthorized", 401);
  return ok({ user });
}
