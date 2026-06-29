"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Cpu, CheckCircle2, XCircle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/hooks/useRfqs";
import { useAiLogs, useUpdateSetting } from "@/hooks/useDirectory";
import { useMe } from "@/hooks/useAuth";
import { api } from "@/lib/api-client";

export default function SettingsPage() {
  const { data: user } = useMe();
  const { data } = useSettings();
  const isSales = user?.role === "SALES";
  const { data: ai } = useAiLogs(isSales);

  if (user && !isSales) {
    return <p className="text-sm text-muted-foreground">Settings are available to Sales (Admin) only.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configuration, dropdown values and AI activity.</p>
      </div>

      <ConfigCard settings={data?.settings ?? {}} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Manager kind="service" title="Services" items={data?.services ?? []} />
        <Manager kind="partner" title="Partners" items={data?.partners ?? []} />
        <Manager kind="customer" title="Customers" items={data?.customers ?? []} />
      </div>

      <AiActivity ai={ai} />
    </div>
  );
}

function ConfigCard({ settings }: { settings: Record<string, any> }) {
  const update = useUpdateSetting();
  const [company, setCompany] = useState<string>(settings.companyName ?? "");
  const [warnHours, setWarnHours] = useState<string>(String(settings.aiOfferActivationHours ?? 24));
  const aiEnabled = settings.aiEnabled !== false;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Company Name">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} onBlur={() => update.mutate({ key: "companyName", value: company })} />
        </Field>
        <Field label="AI Activation (hrs before deadline)">
          <Input type="number" value={warnHours} onChange={(e) => setWarnHours(e.target.value)} onBlur={() => update.mutate({ key: "aiOfferActivationHours", value: Number(warnHours) })} />
        </Field>
        <Field label="Weekend Days">
          <div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground">Sat & Sun (fixed)</div>
        </Field>
        <Field label="AI Engine">
          <button
            onClick={() => update.mutate({ key: "aiEnabled", value: !aiEnabled })}
            className={`flex h-9 items-center justify-center rounded-lg border text-sm font-medium ${aiEnabled ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground"}`}
          >
            {aiEnabled ? "Enabled" : "Disabled"}
          </button>
        </Field>
      </CardContent>
    </Card>
  );
}

function Manager({ kind, title, items }: { kind: "service" | "partner" | "customer"; title: string; items: string[] }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/settings", { kind, name: value.trim() });
      qc.invalidateQueries({ queryKey: ["settings"] });
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title} <span className="text-muted-foreground">({items.length})</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Add ${kind}…`} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button size="icon" onClick={add} disabled={saving}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
          {items.map((i) => <Badge key={i} variant="secondary">{i}</Badge>)}
        </div>
      </CardContent>
    </Card>
  );
}

function AiActivity({ ai }: { ai: any }) {
  if (!ai?.stats) return null;
  const s = ai.stats;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">AI Activity & Prompt Logs</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Cpu} label="Requests" value={s.total} />
          <Stat icon={CheckCircle2} label="Success" value={`${s.successRate}%`} />
          <Stat icon={XCircle} label="Failures" value={s.failure} />
          <Stat icon={Zap} label="Avg latency" value={`${(s.avgMs / 1000).toFixed(1)}s`} />
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Feature</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Latency</th>
                <th className="px-3 py-2 text-left">Tokens</th>
                <th className="px-3 py-2 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {ai.recent.slice(0, 20).map((l: any) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{l.feature}</td>
                  <td className="px-3 py-2">
                    <Badge variant={l.success ? "success" : "destructive"}>{l.success ? "OK" : "FAIL"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.executionMs ? `${(l.executionMs / 1000).toFixed(1)}s` : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{(l.tokensIn ?? 0) + (l.tokensOut ?? 0) || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!ai.recent.length && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No AI activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}
