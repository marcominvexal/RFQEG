import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { getRfq, updateRfq } from "@/lib/rfq-service";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;
    const rfq = await getRfq(user, id);
    if (!rfq) return fail("RFQ not found", 404);
    return ok({ rfq });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;
    const patch = await req.json();
    const before = await getRfq(user, id);
    const updated = await updateRfq(user, id, patch);
    await audit({ actorId: user.id, entity: "Rfq", entityId: id, action: "UPDATE", before, after: updated, req });
    const rfq = await getRfq(user, id);
    return ok({ rfq });
  });
}
