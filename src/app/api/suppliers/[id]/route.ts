import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const { id } = await params;
    const patch = await req.json();
    const before = await prisma.supplier.findFirst({ where: { id, organizationId: user.organizationId } });
    const supplier = await prisma.supplier.update({ where: { id }, data: patch });
    await audit({ actorId: user.id, entity: "Supplier", entityId: id, action: "UPDATE", before, after: supplier, req });
    return ok({ supplier });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const { id } = await params;
    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ actorId: user.id, entity: "Supplier", entityId: id, action: "DELETE", req });
    return ok({ ok: true });
  });
}
