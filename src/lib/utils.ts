import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMins(mins: number): string {
  if (!mins || mins < 0) return "0h";
  const d = Math.floor(mins / (60 * 8)); // 8h business day
  const h = Math.floor((mins % (60 * 8)) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h || !d) parts.push(`${h}h`);
  return parts.join(" ");
}

export function formatDate(d?: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysUntil(d?: Date | string | null): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export function classifyPriorityByDeadline(deadline?: Date | string | null): string {
  const days = daysUntil(deadline);
  if (days === null) return "MEDIUM";
  if (days < 0) return "CRITICAL";
  if (days <= 1) return "CRITICAL";
  if (days <= 3) return "HIGH";
  return "MEDIUM";
}
