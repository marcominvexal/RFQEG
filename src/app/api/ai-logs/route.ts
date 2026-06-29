import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** AI prompt logs + usage statistics (Sales/admin visibility). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, "SALES");

    const [recent, all] = await Promise.all([
      prisma.aiPromptLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.aiPromptLog.findMany({ select: { feature: true, success: true, executionMs: true, tokensIn: true, tokensOut: true } }),
    ]);

    const total = all.length;
    const success = all.filter((l) => l.success).length;
    const avgMs = total ? Math.round(all.reduce((s, l) => s + (l.executionMs ?? 0), 0) / total) : 0;
    const tokensIn = all.reduce((s, l) => s + (l.tokensIn ?? 0), 0);
    const tokensOut = all.reduce((s, l) => s + (l.tokensOut ?? 0), 0);
    const byFeature: Record<string, number> = {};
    for (const l of all) byFeature[l.feature] = (byFeature[l.feature] || 0) + 1;

    return ok({
      stats: {
        total,
        success,
        failure: total - success,
        successRate: total ? Math.round((success / total) * 100) : 0,
        avgMs,
        tokensIn,
        tokensOut,
        byFeature: Object.entries(byFeature).map(([name, value]) => ({ name, value })),
      },
      recent: recent.map((r) => ({
        id: r.id, feature: r.feature, success: r.success, executionMs: r.executionMs,
        tokensIn: r.tokensIn, tokensOut: r.tokensOut, rfqId: r.rfqId, createdAt: r.createdAt,
        responsePreview: r.response?.slice(0, 160) ?? null,
      })),
    });
  });
}
