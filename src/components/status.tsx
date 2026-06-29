import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { slaLevel, slaClasses, deadlineTone, DEFAULT_SLA_MINS } from "@/lib/sla";
import { formatMins } from "@/lib/utils";

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  NEW: "secondary",
  ASSIGNED: "default",
  PENDING: "warning",
  SUBMITTED: "default",
  WON: "success",
  LOST: "destructive",
  CANCELLED: "secondary",
};

const priorityVariant: Record<string, "default" | "secondary" | "warning" | "destructive"> = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "warning",
  CRITICAL: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant[status] ?? "secondary"}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge variant={priorityVariant[priority] ?? "secondary"}>{priority}</Badge>;
}

export function PendingWithBadge({ value }: { value: string }) {
  return <Badge variant="outline" className="border-border">{value}</Badge>;
}

/** Color-coded SLA dot based on delay minutes vs SLA target (75% warn, breach at 100%). */
export function SlaDot({ mins, slaMins = DEFAULT_SLA_MINS }: { mins: number; slaMins?: number }) {
  const cls = slaClasses(slaLevel(mins, slaMins));
  return <span className={cn("inline-block h-2 w-2 rounded-full", cls.dot)} />;
}

/** Animated live delay value with SLA color. */
export function LiveDelay({ mins, slaMins = DEFAULT_SLA_MINS, className }: { mins: number; slaMins?: number; className?: string }) {
  const cls = slaClasses(slaLevel(mins, slaMins));
  return (
    <span className={cn("inline-flex items-center gap-1.5 tabular-nums", cls.text, className)}>
      <span className="relative flex h-2 w-2">
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", cls.dot)} />
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", cls.dot)} />
      </span>
      {formatMins(mins)}
    </span>
  );
}

/** Deadline badge: red overdue, amber within 24h. */
export function DeadlineBadge({ deadline }: { deadline?: string | Date | null }) {
  if (!deadline) return <span className="text-muted-foreground">—</span>;
  const tone = deadlineTone(deadline);
  const cls = slaClasses(tone);
  const ms = new Date(deadline).getTime() - Date.now();
  const label = ms < 0 ? `${Math.ceil(-ms / 86400000)}d overdue` : `${Math.ceil(ms / 86400000)}d left`;
  return <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", cls.bg, cls.text)}>{label}</span>;
}
