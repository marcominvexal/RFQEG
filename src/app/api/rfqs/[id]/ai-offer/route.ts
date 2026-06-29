import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateBudgetaryOffer, geminiConfigured } from "@/lib/gemini";
import { searchKnowledgeBase } from "@/lib/knowledge-base";
import { logActivity } from "@/lib/audit";

/**
 * Ask AI for a Budgetary Offer.
 * Button is dormant unless: aiOfferEnabled OR within AI_OFFER_ACTIVATION_HOURS of deadline.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;

    const rfq = await prisma.rfq.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      include: {
        comments: true, emailThreads: true, activities: { take: 30, orderBy: { createdAt: "desc" } },
        attachments: true,
      },
    });
    if (!rfq) return fail("RFQ not found", 404);

    // Activation gate
    const hours = Number(process.env.AI_OFFER_ACTIVATION_HOURS || 24);
    const withinWindow =
      rfq.deadline ? rfq.deadline.getTime() - Date.now() <= hours * 3600000 : false;
    if (!rfq.aiOfferEnabled && !withinWindow) {
      return fail("AI Budgetary Offer is not active for this RFQ yet", 409);
    }

    if (!geminiConfigured()) {
      return fail("Gemini API key not configured (set GEMINI_API_KEY)", 503);
    }

    // Knowledge base (historical learning) is searched BEFORE generating.
    const kb = await searchKnowledgeBase({
      organizationId: user.organizationId,
      services: rfq.services,
      countries: rfq.countries,
      customerName: rfq.customerName,
      excludeRfqId: id,
    });

    const [suppliers, partners] = await Promise.all([
      prisma.supplier.findMany({ where: { organizationId: user.organizationId, deletedAt: null }, take: 80, include: { contacts: true } }),
      prisma.partner.findMany({ where: { organizationId: user.organizationId, deletedAt: null }, take: 80, include: { contacts: true } }),
    ]);

    const context = JSON.stringify(
      {
        rfq: {
          title: rfq.title, customer: rfq.customerName, partner: rfq.partnerName,
          services: rfq.services, capacity: rfq.capacity, bandwidth: rfq.bandwidth,
          locations: rfq.locations, countries: rfq.countries, opportunityNo: rfq.opportunityNo,
          protection: rfq.protection, remarks: rfq.remarks, specialInstructions: rfq.specialInstructions,
          expectedProposalDate: rfq.expectedProposalDate, deadline: rfq.deadline,
        },
        internalComments: rfq.comments.filter((c: { type: string }) => c.type === "INTERNAL").map((c: { body: string }) => c.body),
        supplierComments: rfq.comments.filter((c: { type: string }) => c.type === "SUPPLIER").map((c: { body: string }) => c.body),
        emailThread: rfq.emailThreads.map((e: { subject: string | null; fromAddr: string | null; internalDate: Date | null; body: string | null }) => ({ subject: e.subject, from: e.fromAddr, at: e.internalDate, body: e.body })),
        timeline: rfq.activities.map((a: { message: string }) => a.message),
        attachments: rfq.attachments.map((a: { fileName: string; extractedText: string | null }) => ({ name: a.fileName, text: a.extractedText })),
        knowledgeBase: {
          similarHistoricalRfqs: kb.similarRfqs.map((s) => ({
            services: s.services, countries: s.countries, capacity: s.capacity,
            customer: s.customerName, partner: s.partnerName, status: s.status,
          })),
          historicalQuotations: kb.quotations.map((q) => ({
            service: q.service, services: q.services, supplier: q.supplierName,
            customer: q.customerName, countries: q.countries, capacity: q.capacity,
            finalPrice: q.finalPrice, currency: q.currency, leadTimeDays: q.leadTimeDays,
            outcome: q.outcome,
          })),
          previousWinningSuppliers: kb.winningSuppliers,
        },
        // Internal directories — the ONLY allowed source for suggested contacts.
        partnerDirectory: partners.map((p) => ({
          name: p.name, country: p.country, services: p.services, accountManager: p.accountManager,
          email: p.email, phone: p.phone, preferredSupplier: p.preferredSupplier,
          contacts: p.contacts.map((c: { name: string; role: string | null; email: string | null; phone: string | null }) => ({ name: c.name, role: c.role, email: c.email, phone: c.phone })),
        })),
        supplierDirectory: suppliers.map((s) => ({
          name: s.name, coverage: s.coverage, countries: s.countries, services: s.services,
          leadTimeDays: s.leadTimeDays, reliabilityScore: s.reliabilityScore,
          performanceScore: s.performanceScore, preferredContact: s.preferredContact,
          contacts: s.contacts.map((c: { name: string; role: string | null; email: string | null }) => ({ name: c.name, role: c.role, email: c.email })),
        })),
      },
      null,
      2
    ).slice(0, 60000);

    const offer = await generateBudgetaryOffer(context, id, user.id);
    if (!offer) return fail("AI did not return a recommendation", 502);

    const rec = await prisma.aiRecommendation.create({
      data: {
        rfqId: id, kind: "BUDGETARY_OFFER",
        payload: offer as any, confidence: offer.confidenceScore / 100,
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      },
    });
    await logActivity(id, "AI_RECOMMENDATION", "AI Budgetary Recommendation generated", user.id);

    return ok({ recommendation: rec });
  });
}
