import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendReply, replyConfigured } from "@/lib/email-provider";
import { logActivity, audit } from "@/lib/audit";

const schema = z.object({
  to: z.string().email().optional(),
  subject: z.string().optional(),
  body: z.string().min(1),
});

/** Reply to the RFQ's email thread from inside the app (Sales only). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "SALES");
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid reply payload", 422);

    if (!replyConfigured()) return fail("Email sending is not configured", 503);

    const rfq = await prisma.rfq.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      include: { emailThreads: { orderBy: { internalDate: "asc" } } },
    });
    if (!rfq) return fail("RFQ not found", 404);

    const lastInbound = [...rfq.emailThreads].reverse().find((e) => e.direction === "INBOUND") ?? rfq.emailThreads[0];
    const to = parsed.data.to || extractAddress(lastInbound?.fromAddr);
    if (!to) return fail("No recipient address available", 422);

    const subject = parsed.data.subject || `RE: ${rfq.title}`;
    const messageId = await sendReply({
      to,
      subject,
      text: parsed.data.body,
      threadId: rfq.gmailThreadId || undefined,
      inReplyTo: lastInbound?.gmailMessageId,
    });

    const record = await prisma.emailThread.create({
      data: {
        rfqId: id,
        gmailMessageId: messageId || `out-${Date.now()}`,
        direction: "OUTBOUND",
        fromAddr: process.env.SMTP_FROM || process.env.IMAP_USER || process.env.GMAIL_USER || "me",
        toAddr: to,
        subject,
        body: parsed.data.body,
        snippet: parsed.data.body.slice(0, 200),
        internalDate: new Date(),
      },
    });

    await logActivity(id, "SUPPLIER_RESPONSE", `Replied to email thread (${to})`, user.id);
    await audit({ actorId: user.id, entity: "Rfq", entityId: id, action: "EMAIL_REPLY", after: { to, subject }, req });

    return ok({ email: record });
  });
}

function extractAddress(raw?: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  return m ? m[1] : raw.trim();
}
