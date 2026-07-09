import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { getRfq, updateRfq } from "@/lib/rfq-service";
import { audit } from "@/lib/audit";
import { RFQ_STATUSES, PENDING_WITH, PRIORITIES } from "@/lib/constants";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;
    const rfq = await getRfq(user, id);
    if (!rfq) return fail("RFQ not found", 404);
    return ok({ rfq });
  });
}

// Mirrors SALES_ONLY_FIELDS + PRESALES_EDITABLE_FIELDS from rfq-service.ts.
// `.strict()` rejects any other key (organizationId, id, delay counters, etc.)
// before it ever reaches the service layer's role-based field authorization.
const patchSchema = z
  .object({
    partnerName: z.string().nullable().optional(),
    partnerId: z.string().nullable().optional(),
    customerName: z.string().nullable().optional(),
    customerId: z.string().nullable().optional(),
    expectedProposalDate: z.string().nullable().optional(),
    status: z.enum(RFQ_STATUSES).optional(),
    services: z.array(z.string()).optional(),
    capacity: z.string().nullable().optional(),
    bandwidth: z.string().nullable().optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignedToId: z.string().nullable().optional(),
    aiOfferEnabled: z.boolean().optional(),
    opportunityNo: z.string().nullable().optional(),
    protection: z.string().nullable().optional(),
    remarks: z.string().nullable().optional(),
    specialInstructions: z.string().nullable().optional(),
    title: z.string().optional(),
    countries: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    pendingWith: z.enum(PENDING_WITH).optional(),
    reasonForDelay: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid RFQ patch payload", 422);
    const before = await getRfq(user, id);
    const updated = await updateRfq(user, id, parsed.data);
    await audit({ actorId: user.id, entity: "Rfq", entityId: id, action: "UPDATE", before, after: updated, req });
    const rfq = await getRfq(user, id);
    return ok({ rfq });
  });
}
