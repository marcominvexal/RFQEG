import { NextRequest } from "next/server";
import { runSeed } from "../../../../../prisma/seed";
import { ensureDatabaseReady, getCollection } from "@/lib/jsondb";
import { handle, ok, fail } from "@/lib/api";

/**
 * One-time database seed for Vercel (no filesystem).
 * POST /api/setup/seed  with header:  x-setup-secret: <SETUP_SECRET>
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const secret = process.env.SETUP_SECRET;
    if (!secret) return fail("SETUP_SECRET not configured", 503);
    if (req.headers.get("x-setup-secret") !== secret) return fail("Unauthorized", 401);

    await ensureDatabaseReady();
    const users = getCollection("user");
    if (users.length > 0) {
      return ok({ message: "Database already seeded", users: users.length });
    }

    process.env.SEED_API_INVOCATION = "1";
    await runSeed();
    return ok({
      message: "Seed complete",
      logins: {
        sales: "sales@invexal.com / sales123",
        presales: "presales@invexal.com / presales123",
      },
    });
  });
}
