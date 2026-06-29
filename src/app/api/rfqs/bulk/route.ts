import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { updateRfq } from "@/lib/rfq-service";
import { audit } from "@/lib/audit";

const schema = z.object({
  ids: z.array(z.string()).min(1),
  patch: z.object({
    status: z.string().optional(),
    pendingWith: z.string().optional(),
    assignedToId: z.string().optional().nullable(),
    priority: z.string().optional(),
  }),
});

/** Bulk update / bulk assignment. Reuses the audited single-RFQ service per id. */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid bulk payload", 422);

    const { ids, patch } = parsed.data;
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        await updateRfq(user, id, { ...patch });
        results.push({ id, ok: true });
      } catch (e: any) {
        results.push({ id, ok: false, error: e.message });
      }
    }
    await audit({ actorId: user.id, entity: "Rfq", entityId: "bulk", action: "BULK_UPDATE", after: { ids, patch }, req });
    return ok({ results, updated: results.filter((r) => r.ok).length });
  });
}
