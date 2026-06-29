import { prisma } from "@/lib/prisma";
import { naiveBusinessDays, deriveDeadline } from "@/lib/business-days";
import type { PendingWith } from "@/types";

export { deriveDeadline };

const MINS_PER_BUSINESS_DAY = 8 * 60;

const accumulatorField: Record<PendingWith, "salesDelayMins" | "presalesDelayMins" | "sourcingDelayMins"> = {
  SALES: "salesDelayMins",
  PRESALES: "presalesDelayMins",
  SOURCING: "sourcingDelayMins",
};

/** Effective business-minutes between two instants (weekends excluded). */
function effectiveMinutes(start: Date, end: Date): number {
  if (end <= start) return 0;
  const { effectiveDelayDays } = naiveBusinessDays(start, end);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const day = start.getDay();
    if (day === 0 || day === 6) return 0;
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }
  return effectiveDelayDays * MINS_PER_BUSINESS_DAY;
}

/**
 * Move the RFQ to a new "pendingWith":
 *  - close the open DelayHistory segment, compute its effective minutes,
 *  - add those minutes to the matching accumulator,
 *  - open a fresh segment for the new owner.
 * Returns the updated accumulator values.
 */
export async function changePendingWith(
  rfqId: string,
  from: PendingWith,
  to: PendingWith,
  at: Date = new Date()
) {
  const open = await prisma.delayHistory.findFirst({
    where: { rfqId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  let addMins = 0;
  if (open) {
    addMins = effectiveMinutes(open.startedAt, at);
    await prisma.delayHistory.update({
      where: { id: open.id },
      data: { endedAt: at, effectiveMins: addMins },
    });
  }

  const field = accumulatorField[from];
  await prisma.rfq.update({
    where: { id: rfqId },
    data: { [field]: { increment: addMins }, pendingWith: to },
  });

  await prisma.delayHistory.create({
    data: { rfqId, pendingWith: to, startedAt: at },
  });

  return { from, to };
}

/**
 * Live totals = stored accumulators + currently-open segment.
 */
export async function computeLiveDelays(rfq: {
  id: string;
  pendingWith: PendingWith;
  salesDelayMins: number;
  presalesDelayMins: number;
  sourcingDelayMins: number;
}) {
  const totals = {
    sales: rfq.salesDelayMins,
    presales: rfq.presalesDelayMins,
    sourcing: rfq.sourcingDelayMins,
  };

  const open = await prisma.delayHistory.findFirst({
    where: { rfqId: rfq.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) {
    const live = effectiveMinutes(open.startedAt, new Date());
    if (open.pendingWith === "SALES") totals.sales += live;
    else if (open.pendingWith === "PRESALES") totals.presales += live;
    else totals.sourcing += live;
  }

  return {
    salesDelayMins: totals.sales,
    presalesDelayMins: totals.presales,
    sourcingDelayMins: totals.sourcing,
    totalDelayMins: totals.sales + totals.presales + totals.sourcing,
  };
}
