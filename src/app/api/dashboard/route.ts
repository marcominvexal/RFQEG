import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { computeLiveDelays } from "@/lib/delay-engine";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const org = user.organizationId;
    const where = { organizationId: org, deletedAt: null };

    const rfqs = await prisma.rfq.findMany({ where });

    const now = Date.now();
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

    let pending = 0, critical = 0, dueToday = 0, overdue = 0, won = 0, lost = 0, nearDeadline = 0;
    let salesSum = 0, presalesSum = 0, sourcingSum = 0, totalSum = 0, completed = 0;
    let proposalSum = 0, proposalCount = 0;
    const TERMINAL = ["WON", "LOST", "CANCELLED", "SUBMITTED"];

    const byStatus: Record<string, number> = {};
    const byPartner: Record<string, number> = {};
    const byService: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    for (const r of rfqs) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.partnerName) byPartner[r.partnerName] = (byPartner[r.partnerName] || 0) + 1;
      for (const s of r.services) byService[s] = (byService[s] || 0) + 1;
      const m = r.createdAt.toISOString().slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + 1;

      if (r.status === "PENDING") pending++;
      if (r.priority === "CRITICAL") critical++;
      if (r.status === "WON") won++;
      if (r.status === "LOST") lost++;
      const isTerminal = TERMINAL.includes(r.status);
      if (r.deadline) {
        if (r.deadline >= startOfToday && r.deadline <= endOfToday) dueToday++;
        else if (r.deadline.getTime() < now && !isTerminal) overdue++;
        // near deadline = within next 48h, not yet terminal
        const ms = r.deadline.getTime() - now;
        if (!isTerminal && ms > 0 && ms <= 48 * 3600000) nearDeadline++;
      }

      const d = await computeLiveDelays(r);
      salesSum += d.salesDelayMins;
      presalesSum += d.presalesDelayMins;
      sourcingSum += d.sourcingDelayMins;
      totalSum += d.totalDelayMins;
      completed++;

      // Average proposal time = total delay across RFQs that reached a proposal/terminal state
      if (["SUBMITTED", "WON", "LOST"].includes(r.status)) {
        proposalSum += d.totalDelayMins;
        proposalCount++;
      }
    }

    const n = Math.max(completed, 1);
    const topN = (obj: Record<string, number>, k = 8) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, value]) => ({ name, value }));

    return ok({
      cards: {
        pending, critical, dueToday, overdue, won, lost, nearDeadline,
        avgTurnaroundMins: Math.round(totalSum / n),
        avgProposalMins: proposalCount ? Math.round(proposalSum / proposalCount) : 0,
        avgSalesDelayMins: Math.round(salesSum / n),
        avgPresalesDelayMins: Math.round(presalesSum / n),
        avgSourcingDelayMins: Math.round(sourcingSum / n),
        total: rfqs.length,
      },
      charts: {
        byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
        byPartner: topN(byPartner),
        byService: topN(byService),
        byMonth: Object.entries(byMonth).sort().map(([name, value]) => ({ name, value })),
        delaySplit: [
          { name: "Sales", value: Math.round(salesSum / 60) },
          { name: "Presales", value: Math.round(presalesSum / 60) },
          { name: "Sourcing", value: Math.round(sourcingSum / 60) },
        ],
      },
    });
  });
}
