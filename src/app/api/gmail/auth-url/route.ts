import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { buildAuthUrl } from "@/lib/gmail";

/** Sales obtains the one-time OAuth consent URL to mint a refresh token. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, "SALES");
    return ok({ url: buildAuthUrl() });
  });
}
