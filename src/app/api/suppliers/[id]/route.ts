import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

const patchSchema = z
  .object({
    name: z.string().optional(),
    country: z.string().nullable().optional(),
    footprint: z.string().nullable().optional(),
    coverage: z.string().nullable().optional(),
    countries: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
    leadTimeDays: z.number().nullable().optional(),
    performanceScore: z.number().nullable().optional(),
    reliabilityScore: z.number().nullable().optional(),
    responseTimeHours: z.number().nullable().optional(),
    preferredContact: z.string().nullable().optional(),
    historicalPricing: z.any().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid supplier patch payload", 422);

    const before = await prisma.supplier.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!before) return fail("Supplier not found", 404);

    const supplier = await prisma.supplier.update({ where: { id }, data: parsed.data });
    await audit({ actorId: user.id, entity: "Supplier", entityId: id, action: "UPDATE", before, after: supplier, req });
    return ok({ supplier });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const { id } = await params;
    const before = await prisma.supplier.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!before) return fail("Supplier not found", 404);

    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ actorId: user.id, entity: "Supplier", entityId: id, action: "DELETE", req });
    return ok({ ok: true });
  });
}
