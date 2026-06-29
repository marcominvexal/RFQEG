import { describe, it, expect } from "vitest";
import { naiveBusinessDays, deriveDeadline } from "@/lib/business-days";

describe("naiveBusinessDays", () => {
  it("counts Mon–Fri as business days, excludes the weekend", () => {
    // Mon 2026-06-01 -> Mon 2026-06-08 (8 days span; 5 business, 2 weekend)
    const start = new Date("2026-06-01T09:00:00Z");
    const end = new Date("2026-06-08T09:00:00Z");
    const r = naiveBusinessDays(start, end);
    expect(r.businessDays).toBe(5);
    expect(r.weekendDays).toBe(2);
    expect(r.effectiveDelayDays).toBe(5);
  });

  it("returns zero for same-day", () => {
    const d = new Date("2026-06-03T09:00:00Z");
    const r = naiveBusinessDays(d, d);
    expect(r.businessDays).toBe(0);
    expect(r.weekendDays).toBe(0);
  });

  it("excludes a single weekend day", () => {
    // Fri -> Sat = 1 business (Fri), 0 weekend counted before Sat? span Fri->Sat: counts Fri only
    const start = new Date("2026-06-05T09:00:00Z"); // Friday
    const end = new Date("2026-06-06T09:00:00Z"); // Saturday
    const r = naiveBusinessDays(start, end);
    expect(r.businessDays).toBe(1);
  });
});

describe("deriveDeadline", () => {
  it("is exactly one day before the expected proposal date", () => {
    const epd = new Date("2026-06-10T00:00:00Z");
    const dl = deriveDeadline(epd)!;
    expect(dl.toISOString().slice(0, 10)).toBe("2026-06-09");
  });

  it("returns null when no expected date", () => {
    expect(deriveDeadline(null)).toBeNull();
  });
});
