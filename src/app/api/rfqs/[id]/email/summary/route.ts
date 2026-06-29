import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { summarizeText, geminiConfigured } from "@/lib/gemini";
import { logActivity } from "@/lib/audit";

/** Summarize the RFQ email thread with Gemini. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;
    if (!geminiConfigured()) return fail("Gemini API key not configured", 503);

    const rfq = await prisma.rfq.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      include: { emailThreads: { orderBy: { internalDate: "asc" } } },
    });
    if (!rfq) return fail("RFQ not found", 404);
    if (!rfq.emailThreads.length) return fail("No email thread to summarize", 409);

    const text = rfq.emailThreads
      .map((e: { direction: string; subject: string | null; fromAddr: string | null; body: string | null }) => `[${e.direction}] ${e.subject || ""}\nFrom: ${e.fromAddr}\n${e.body || ""}`)
      .join("\n\n---\n\n")
      .slice(0, 20000);

    const summary = await summarizeText("SUMMARY", text, id);
    if (!summary) return fail("AI did not return a summary", 502);

    await prisma.aiRecommendation.create({
      data: { rfqId: id, kind: "SUMMARY", payload: { summary } as any, model: process.env.GEMINI_MODEL || "gemini-2.0-flash" },
    });
    await logActivity(id, "AI_RECOMMENDATION", "AI email-thread summary generated", user.id);

    return ok({ summary });
  });
}
