import { prisma } from "@/lib/prisma";
import { computeLiveDelays, changePendingWith, deriveDeadline } from "@/lib/delay-engine";
import { logActivity } from "@/lib/audit";
import { captureCompletedRfq, isTerminalOutcome } from "@/lib/knowledge-base";
import { PRESALES_EDITABLE_FIELDS } from "@/lib/constants";
import type { AuthUser } from "@/types";

export interface RfqFilters {
  status?: string;
  pendingWith?: string;
  partner?: string;
  customer?: string;
  service?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** List RFQs (org-scoped) with live delay counters. */
export async function listRfqs(user: AuthUser, f: RfqFilters) {
  const where: any = {
    organizationId: user.organizationId,
    deletedAt: null,
    ...(f.status ? { status: f.status as any } : {}),
    ...(f.pendingWith ? { pendingWith: f.pendingWith as any } : {}),
    ...(f.partner ? { partnerName: { contains: f.partner, mode: "insensitive" } } : {}),
    ...(f.customer ? { customerName: { contains: f.customer, mode: "insensitive" } } : {}),
    ...(f.service ? { services: { has: f.service } } : {}),
    ...(f.search
      ? {
          OR: [
            { rfqNumber: { contains: f.search, mode: "insensitive" } },
            { title: { contains: f.search, mode: "insensitive" } },
            { partnerName: { contains: f.search, mode: "insensitive" } },
            { customerName: { contains: f.search, mode: "insensitive" } },
            { opportunityNo: { contains: f.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 25;

  const [rows, total] = await Promise.all([
    prisma.rfq.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rfq.count({ where }),
  ]);

  const items = await Promise.all(
    rows.map(async (r) => {
      const d = await computeLiveDelays(r);
      return {
        id: r.id,
        rfqNumber: r.rfqNumber,
        title: r.title,
        partnerName: r.partnerName,
        customerName: r.customerName,
        services: r.services,
        capacity: r.capacity,
        pendingWith: r.pendingWith,
        status: r.status,
        priority: r.priority,
        ...d,
        expectedProposalDate: r.expectedProposalDate?.toISOString() ?? null,
        deadline: r.deadline?.toISOString() ?? null,
        aiOfferEnabled: r.aiOfferEnabled,
      };
    })
  );

  return { items, total, page, pageSize };
}

export async function getRfq(user: AuthUser, id: string) {
  const r = await prisma.rfq.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      comments: { where: { deletedAt: null }, include: { author: true }, orderBy: { createdAt: "asc" } },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, include: { actor: true } },
      emailThreads: { orderBy: { internalDate: "asc" } },
      aiRecommendations: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      assignedTo: true,
    },
  });
  if (!r) return null;
  const delays = await computeLiveDelays(r);

  // Presales should not see INTERNAL comments authored privately? Spec: internal visible to Sales+Presales. Keep all.
  return { ...r, ...delays };
}

const SALES_ONLY = new Set([
  "partnerName", "partnerId", "customerName", "customerId", "expectedProposalDate",
  "status", "services", "capacity", "bandwidth", "priority", "assignedToId",
  "aiOfferEnabled", "opportunityNo", "protection", "remarks", "specialInstructions",
  "title", "countries", "locations",
]);

/**
 * Update an RFQ with role-based field authorization + full timeline logging.
 */
export async function updateRfq(
  user: AuthUser,
  id: string,
  patch: Record<string, any>
) {
  const existing = await prisma.rfq.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!existing) throw new Error("RFQ not found");

  // Authorize each field.
  for (const key of Object.keys(patch)) {
    if (user.role === "PRESALES") {
      if (!PRESALES_EDITABLE_FIELDS.includes(key as any)) {
        throw new Error(`Presales cannot edit field: ${key}`);
      }
    }
    // Deadline is never directly editable.
    if (key === "deadline") throw new Error("Deadline is derived and cannot be edited");
  }

  const data: Record<string, any> = {};
  const activities: { type: any; message: string }[] = [];

  // Handle pendingWith via the delay engine (don't set directly).
  if (patch.pendingWith && patch.pendingWith !== existing.pendingWith) {
    await changePendingWith(id, existing.pendingWith, patch.pendingWith);
    activities.push({
      type: "PENDING_WITH_CHANGED",
      message: `Pending With changed to ${patch.pendingWith}`,
    });
  }
  delete patch.pendingWith;

  // Status change → history.
  if (patch.status && patch.status !== existing.status) {
    if (user.role !== "SALES") throw new Error("Only Sales can change status");
    await prisma.statusHistory.create({
      data: { rfqId: id, fromStatus: existing.status, toStatus: patch.status, changedById: user.id },
    });
    activities.push({ type: "STATUS_CHANGED", message: `Status changed ${existing.status} → ${patch.status}` });
  }

  // Expected Proposal Date → recompute immutable deadline.
  if (patch.expectedProposalDate !== undefined) {
    const epd = patch.expectedProposalDate ? new Date(patch.expectedProposalDate) : null;
    data.expectedProposalDate = epd;
    data.deadline = deriveDeadline(epd);
    activities.push({ type: "FIELD_CHANGED", message: "Expected Proposal Date updated" });
  }

  // Remaining scalar/array fields.
  for (const [k, v] of Object.entries(patch)) {
    if (k === "status" || k === "expectedProposalDate") continue;
    if ((existing as any)[k] !== v) {
      data[k] = v;
      const label = k === "partnerName" ? "Partner" : k === "customerName" ? "Customer" : k;
      activities.push({ type: "FIELD_CHANGED", message: `${label} updated` });
    }
  }

  const updated = Object.keys(data).length
    ? await prisma.rfq.update({ where: { id }, data })
    : existing;

  for (const a of activities) await logActivity(id, a.type, a.message, user.id);

  // Historical learning: snapshot into knowledge base on terminal outcome.
  if (patch.status && isTerminalOutcome(patch.status)) {
    await captureCompletedRfq(id);
  }

  return updated;
}

export async function addComment(
  user: AuthUser,
  rfqId: string,
  type: "INTERNAL" | "SUPPLIER",
  body: string
) {
  const rfq = await prisma.rfq.findFirst({
    where: { id: rfqId, organizationId: user.organizationId },
  });
  if (!rfq) throw new Error("RFQ not found");
  const c = await prisma.comment.create({
    data: { rfqId, authorId: user.id, type, body },
    include: { author: true },
  });
  await logActivity(rfqId, "COMMENT_ADDED", `${type === "INTERNAL" ? "Internal" : "Supplier"} comment added`, user.id);
  return c;
}

/** Generate the next RFQ number for an org. */
export async function nextRfqNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.rfq.count({
    where: { organizationId, rfqNumber: { startsWith: `RFQ-${year}-` } },
  });
  return `RFQ-${year}-${String(count + 1).padStart(4, "0")}`;
}
