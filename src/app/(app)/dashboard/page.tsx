"use client";
import {
  Clock, AlertTriangle, CalendarClock, CalendarX, Trophy, XCircle, Timer, Layers,
  Send, Zap, Cpu, CheckCircle2, Gauge,
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useRfqs";
import { useAiLogs } from "@/hooks/useDirectory";
import { useMe } from "@/hooks/useAuth";
import { formatMins } from "@/lib/utils";
import { MonthlyRfqs, DistributionPie, DelayBar, StatusLine, DelayTrend } from "@/features/dashboard/charts";

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { data: user } = useMe();
  const isSales = user?.role === "SALES";
  const { data: ai } = useAiLogs(isSales); // sales-only endpoint

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  const c = data.cards;
  const ch = data.charts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">SLA & pipeline overview · {c.total} total RFQs</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard index={0} label="Pending RFQs" value={c.pending} icon={Clock} accent="warning" />
        <KpiCard index={1} label="Critical RFQs" value={c.critical} icon={AlertTriangle} accent="destructive" />
        <KpiCard index={2} label="Near Deadline (48h)" value={c.nearDeadline} icon={Gauge} accent="warning" />
        <KpiCard index={3} label="Due Today" value={c.dueToday} icon={CalendarClock} />
        <KpiCard index={4} label="Overdue" value={c.overdue} icon={CalendarX} accent="destructive" />
        <KpiCard index={5} label="Won" value={c.won} icon={Trophy} accent="success" />
        <KpiCard index={6} label="Lost" value={c.lost} icon={XCircle} accent="destructive" />
        <KpiCard index={7} label="Avg Proposal Time" value={formatMins(c.avgProposalMins)} icon={Send} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard index={0} label="Avg Turnaround" value={formatMins(c.avgTurnaroundMins)} icon={Timer} />
        <KpiCard index={1} label="Avg Sales Delay" value={formatMins(c.avgSalesDelayMins)} icon={Layers} />
        <KpiCard index={2} label="Avg Presales Delay" value={formatMins(c.avgPresalesDelayMins)} icon={Layers} accent="warning" />
        <KpiCard index={3} label="Avg Sourcing Delay" value={formatMins(c.avgSourcingDelayMins)} icon={Layers} />
      </div>

      {/* AI Usage (Sales only) */}
      {isSales && ai?.stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard index={0} label="AI Requests" value={ai.stats.total} icon={Cpu} />
          <KpiCard index={1} label="AI Success Rate" value={`${ai.stats.successRate}%`} icon={CheckCircle2} accent="success" />
          <KpiCard index={2} label="Avg AI Latency" value={`${(ai.stats.avgMs / 1000).toFixed(1)}s`} icon={Zap} />
          <KpiCard index={3} label="Tokens (in/out)" value={`${ai.stats.tokensIn}/${ai.stats.tokensOut}`} icon={Layers} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyRfqs data={ch.byMonth} />
        <Leaderboard title="Partner Leaderboard" data={ch.byPartner} />
        <DistributionPie title="Service Distribution" data={ch.byService} />
        <DelayBar data={ch.delaySplit} />
        <StatusLine data={ch.byStatus} />
        <DelayTrend data={ch.byMonth} />
      </div>
    </div>
  );
}

function Leaderboard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {data.slice(0, 8).map((d, i) => (
            <div key={d.name} className="flex items-center gap-3">
              <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
              <span className="w-28 shrink-0 truncate text-sm">{d.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(d.value / max) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{d.value}</span>
            </div>
          ))}
          {!data.length && <p className="text-sm text-muted-foreground">No data yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
