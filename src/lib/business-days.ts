import type { DelayResult } from "@/types";

/**
 * Deterministic weekend-only business-day count (no holiday DB).
 * Used as a fallback when Gemini is unavailable. Pure & side-effect free.
 */
export function naiveBusinessDays(start: Date, end: Date): DelayResult {
  let business = 0;
  let weekend = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  while (cur < stop) {
    const day = cur.getDay();
    if (day === 0 || day === 6) weekend++;
    else business++;
    cur.setDate(cur.getDate() + 1);
  }
  return { businessDays: business, weekendDays: weekend, holidayDays: 0, effectiveDelayDays: business };
}

/** Deadline = Expected Proposal Date minus one calendar day (immutable, derived). */
export function deriveDeadline(expected: Date | null): Date | null {
  if (!expected) return null;
  return new Date(expected.getTime() - 86400000);
}
