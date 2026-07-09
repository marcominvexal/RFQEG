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
    services: z.array(z.string()).optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    accountManager: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    preferredSupplier: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid partner patch payload", 422);

    const before = await prisma.partner.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!before) return fail("Partner not found", 404);

    const partner = await prisma.partner.update({ where: { id }, data: parsed.data });
    await audit({ actorId: user.id, entity: "Partner", entityId: id, action: "UPDATE", before, after: partner, req });
    return ok({ partner });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const { id } = await params;
    const before = await prisma.partner.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!before) return fail("Partner not found", 404);

    await prisma.partner.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ actorId: user.id, entity: "Partner", entityId: id, action: "DELETE", req });
    return ok({ ok: true });
  });
}
