// SLA / delay color logic. Single source of truth for delay tone.
// Default SLA target per stage = 3 business days (8h * 3 * 60 mins).

export const DEFAULT_SLA_MINS = 3 * 8 * 60;

export type SlaLevel = "ok" | "warn" | "breach";

/** 75% of SLA → warn; >=100% → breach. */
export function slaLevel(mins: number, slaMins: number = DEFAULT_SLA_MINS): SlaLevel {
  if (slaMins <= 0) return "ok";
  const ratio = mins / slaMins;
  if (ratio >= 1) return "breach";
  if (ratio >= 0.75) return "warn";
  return "ok";
}

export function slaClasses(level: SlaLevel): { dot: string; text: string; bg: string } {
  switch (level) {
    case "breach":
      return { dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/10" };
    case "warn":
      return { dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" };
    default:
      return { dot: "bg-success", text: "text-success", bg: "bg-success/10" };
  }
}

/** Deadline tone: red once overdue, amber within 24h. */
export function deadlineTone(deadline?: string | Date | null): SlaLevel {
  if (!deadline) return "ok";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return "breach";
  if (ms <= 24 * 3600000) return "warn";
  return "ok";
}
