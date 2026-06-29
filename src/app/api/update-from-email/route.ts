import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { fetchUnreadSolutionRequestsAny, markEmailAsRead, emailConfigured } from "@/lib/email-provider";
import { extractRfqFromEmail } from "@/lib/gemini";
import { nextRfqNumber } from "@/lib/rfq-service";
import { logActivity } from "@/lib/audit";

/**
 * Manual-only Gmail import (button "Update From Email").
 * - Searches UNREAD messages containing "Solution Request" (subject OR body).
 * - Each becomes a new RFQ, fields extracted by Gemini.
 * - Marks the message READ on success so it is not re-imported.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    if (!emailConfigured()) {
      return fail("Email import not configured (set IMAP_* or GMAIL_* env vars)", 503);
    }

    const messages = await fetchUnreadSolutionRequestsAny();
    const created: string[] = [];
    const skipped: string[] = [];

    for (const msg of messages) {
      // Avoid duplicates if a previous import already linked this message.
      const exists = await prisma.rfq.findUnique({ where: { gmailMessageId: msg.id } });
      if (exists) {
        skipped.push(msg.id);
        await markEmailAsRead(msg.id).catch(() => {});
        continue;
      }

      const extracted = await extractRfqFromEmail(msg.subject, msg.body);
      const rfqNumber = await nextRfqNumber(user.organizationId);

      const rfq = await prisma.rfq.create({
        data: {
          organizationId: user.organizationId,
          rfqNumber,
          title: msg.subject, // Title auto-populated from email subject
          partnerName: extracted.partner,
          customerName: extracted.customer,
          opportunityNo: extracted.opportunityNo,
          capacity: extracted.capacity,
          bandwidth: extracted.bandwidth,
          locations: extracted.locations ?? [],
          countries: extracted.countries ?? [],
          services: extracted.service ?? [],
          protection: extracted.protection,
          remarks: extracted.remarks,
          specialInstructions: extracted.specialInstructions,
          requestDate: new Date(), // import date, NOT email date
          pendingWith: "SALES",
          status: "NEW",
          gmailMessageId: msg.id,
          gmailThreadId: msg.threadId,
        },
      });

      await prisma.emailThread.create({
        data: {
          rfqId: rfq.id, gmailMessageId: msg.id, fromAddr: msg.from, toAddr: msg.to,
          subject: msg.subject, body: msg.body, snippet: msg.snippet, internalDate: msg.internalDate,
        },
      });
      await prisma.delayHistory.create({
        data: { rfqId: rfq.id, pendingWith: "SALES", startedAt: new Date() },
      });
      await logActivity(rfq.id, "IMPORTED", "Imported from Gmail", user.id);

      // Mark READ only after successful import.
      await markEmailAsRead(msg.id);
      created.push(rfq.rfqNumber);
    }

    return ok({ importedCount: created.length, created, skipped, scanned: messages.length });
  });
}
