import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { listRfqs, nextRfqNumber } from "@/lib/rfq-service";
import { prisma } from "@/lib/prisma";
import { deriveDeadline } from "@/lib/delay-engine";
import { logActivity } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const sp = req.nextUrl.searchParams;
    const result = await listRfqs(user, {
      status: sp.get("status") || undefined,
      pendingWith: sp.get("pendingWith") || undefined,
      partner: sp.get("partner") || undefined,
      customer: sp.get("customer") || undefined,
      service: sp.get("service") || undefined,
      search: sp.get("search") || undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 25,
    });
    return ok(result);
  });
}

const createSchema = z.object({
  title: z.string().min(1),
  partnerName: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  services: z.array(z.string()).optional(),
  capacity: z.string().optional().nullable(),
  bandwidth: z.string().optional().nullable(),
  locations: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  opportunityNo: z.string().optional().nullable(),
  protection: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  expectedProposalDate: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, "SALES"); // only Sales create manually
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid RFQ payload", 422);
    const d = parsed.data;

    const epd = d.expectedProposalDate ? new Date(d.expectedProposalDate) : null;
    const rfqNumber = await nextRfqNumber(user.organizationId);

    const rfq = await prisma.rfq.create({
      data: {
        organizationId: user.organizationId,
        rfqNumber,
        title: d.title,
        partnerName: d.partnerName ?? null,
        customerName: d.customerName ?? null,
        services: d.services ?? [],
        capacity: d.capacity ?? null,
        bandwidth: d.bandwidth ?? null,
        locations: d.locations ?? [],
        countries: d.countries ?? [],
        opportunityNo: d.opportunityNo ?? null,
        protection: d.protection ?? null,
        remarks: d.remarks ?? null,
        priority: d.priority ?? "MEDIUM",
        expectedProposalDate: epd,
        deadline: deriveDeadline(epd),
        pendingWith: "SALES",
        status: "NEW",
      },
    });

    await prisma.delayHistory.create({
      data: { rfqId: rfq.id, pendingWith: "SALES", startedAt: new Date() },
    });
    await logActivity(rfq.id, "CREATED", "RFQ created manually", user.id);

    return ok({ rfq }, { status: 201 });
  });
}
