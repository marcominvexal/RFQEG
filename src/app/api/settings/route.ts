import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** GET: dropdown config (services, partners) + settings. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const [services, partners, customers, settings] = await Promise.all([
      prisma.service.findMany({ where: { organizationId: user.organizationId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.partner.findMany({ where: { organizationId: user.organizationId, deletedAt: null }, orderBy: { name: "asc" } }),
      prisma.customer.findMany({ where: { organizationId: user.organizationId, deletedAt: null }, orderBy: { name: "asc" } }),
      prisma.setting.findMany({ where: { organizationId: user.organizationId } }),
    ]);
    return ok({
      services: services.map((s) => s.name),
      partners: partners.map((p) => p.name),
      customers: customers.map((c) => c.name),
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    });
  });
}

const addSchema = z.object({
  kind: z.enum(["service", "partner", "customer"]),
  name: z.string().min(1),
});

/** POST: Sales adds a new dropdown value. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const parsed = addSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid payload", 422);
    const { kind, name } = parsed.data;
    const org = user.organizationId;

    if (kind === "service")
      await prisma.service.upsert({
        where: { organizationId_name: { organizationId: org, name } },
        update: { isActive: true }, create: { organizationId: org, name },
      });
    if (kind === "partner")
      await prisma.partner.upsert({
        where: { organizationId_name: { organizationId: org, name } },
        update: { deletedAt: null }, create: { organizationId: org, name },
      });
    if (kind === "customer")
      await prisma.customer.upsert({
        where: { organizationId_name: { organizationId: org, name } },
        update: { deletedAt: null }, create: { organizationId: org, name },
      });

    return ok({ ok: true });
  });
}

const configSchema = z.object({ key: z.string().min(1), value: z.any() });

/** PATCH: Sales updates a configuration setting (company name, AI toggle, etc.). */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const parsed = configSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid setting", 422);
    const { key, value } = parsed.data;
    await prisma.setting.upsert({
      where: { organizationId_key: { organizationId: user.organizationId, key } },
      update: { value },
      create: { organizationId: user.organizationId, key, value },
    });
    return ok({ ok: true });
  });
}
