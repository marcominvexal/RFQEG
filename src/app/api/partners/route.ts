import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const partners = await prisma.partner.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      include: { contacts: true },
      orderBy: { name: "asc" },
    });
    return ok({ partners });
  });
}

const schema = z.object({
  name: z.string().min(1),
  country: z.string().optional().nullable(),
  services: z.array(z.string()).optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  accountManager: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  preferredSupplier: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid partner payload", 422);
    const data = parsed.data;
    const partner = await prisma.partner.upsert({
      where: { organizationId_name: { organizationId: user.organizationId, name: data.name } },
      update: { ...data, services: data.services ?? [], deletedAt: null },
      create: { organizationId: user.organizationId, ...data, services: data.services ?? [] },
    });
    await audit({ actorId: user.id, entity: "Partner", entityId: partner.id, action: "UPSERT", after: partner, req });
    return ok({ partner }, { status: 201 });
  });
}
