import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      include: { contacts: true },
      orderBy: { name: "asc" },
    });
    return ok({ suppliers });
  });
}

const schema = z.object({
  name: z.string().min(1),
  country: z.string().optional().nullable(),
  coverage: z.string().optional().nullable(),
  countries: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
  leadTimeDays: z.number().int().optional().nullable(),
  performanceScore: z.number().optional().nullable(),
  reliabilityScore: z.number().optional().nullable(),
  responseTimeHours: z.number().optional().nullable(),
  preferredContact: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid supplier payload", 422);
    const supplier = await prisma.supplier.create({
      data: { organizationId: user.organizationId, ...parsed.data, countries: parsed.data.countries ?? [], services: parsed.data.services ?? [] },
    });
    await audit({ actorId: user.id, entity: "Supplier", entityId: supplier.id, action: "CREATE", after: supplier, req });
    return ok({ supplier }, { status: 201 });
  });
}
