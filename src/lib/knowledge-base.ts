import { prisma } from "@/lib/prisma";

/**
 * Historical Learning knowledge base.
 *
 * When an RFQ reaches a terminal commercial outcome (WON/LOST) we snapshot it into
 * the `quotations` table so future AI recommendations can learn from real outcomes:
 * customer, partner, winning supplier, service, capacity, geography, final price,
 * lead time, margin, status and internal notes.
 */

const TERMINAL = new Set(["WON", "LOST"]);

export function isTerminalOutcome(status: string): boolean {
  return TERMINAL.has(status);
}

/** Idempotently capture a completed RFQ into the knowledge base. */
export async function captureCompletedRfq(rfqId: string): Promise<void> {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    include: { comments: { where: { type: "INTERNAL", deletedAt: null } } },
  });
  if (!rfq || !isTerminalOutcome(rfq.status)) return;

  const internalNotes = rfq.comments.map((c: { body: string }) => c.body).join("\n").slice(0, 4000) || rfq.remarks || null;

  const data = {
    organizationId: rfq.organizationId,
    rfqId: rfq.id,
    customerName: rfq.customerName,
    partnerName: rfq.partnerName,
    supplierName: rfq.partnerName, // winning supplier (partner acts as supplier here)
    service: rfq.services[0] ?? null,
    services: rfq.services,
    country: rfq.countries[0] ?? null,
    countries: rfq.countries,
    locations: rfq.locations,
    capacity: rfq.capacity,
    outcome: rfq.status,
    internalNotes,
  };

  // One knowledge record per RFQ — update if it already exists.
  const existing = await prisma.quotation.findFirst({ where: { rfqId: rfq.id } });
  if (existing) {
    await prisma.quotation.update({ where: { id: existing.id }, data });
  } else {
    await prisma.quotation.create({ data });
  }
}

export interface KbQuery {
  organizationId: string;
  services: string[];
  countries: string[];
  customerName?: string | null;
  excludeRfqId?: string;
}

/**
 * Search the knowledge base for records relevant to the current RFQ, ranked by
 * service / geography / customer overlap. Used to ground AI recommendations.
 */
export async function searchKnowledgeBase(q: KbQuery) {
  const [quotations, similarRfqs] = await Promise.all([
    prisma.quotation.findMany({
      where: {
        organizationId: q.organizationId,
        OR: [
          { services: { hasSome: q.services } },
          { service: { in: q.services } },
          { countries: { hasSome: q.countries } },
          ...(q.customerName ? [{ customerName: q.customerName }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.rfq.findMany({
      where: {
        organizationId: q.organizationId,
        ...(q.excludeRfqId ? { id: { not: q.excludeRfqId } } : {}),
        status: { in: ["WON", "LOST", "SUBMITTED"] },
        OR: [{ services: { hasSome: q.services } }, { countries: { hasSome: q.countries } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const score = (svc: string[], cty: string[], cust?: string | null) => {
    let s = 0;
    s += svc.filter((x) => q.services.includes(x)).length * 3;
    s += cty.filter((x) => q.countries.includes(x)).length * 2;
    if (cust && q.customerName && cust === q.customerName) s += 2;
    return s;
  };

  return {
    quotations: quotations
      .map((x) => ({ ...x, _score: score(x.services, x.countries, x.customerName) }))
      .sort((a, b) => b._score - a._score),
    similarRfqs: similarRfqs
      .map((x) => ({ ...x, _score: score(x.services, x.countries, x.customerName) }))
      .sort((a, b) => b._score - a._score),
    winningSuppliers: Array.from(
      new Set(quotations.filter((x) => x.outcome === "WON" && x.supplierName).map((x) => x.supplierName!))
    ),
  };
}
