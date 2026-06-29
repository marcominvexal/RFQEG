"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api-client";
import { useSettings } from "@/hooks/useRfqs";

export function NewRfqSheet() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", partnerName: "", customerName: "", capacity: "",
    opportunityNo: "", expectedProposalDate: "", services: [] as string[], remarks: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.title) return;
    setLoading(true);
    try {
      await api.post("/api/rfqs", form);
      qc.invalidateQueries({ queryKey: ["rfqs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setForm({ title: "", partnerName: "", customerName: "", capacity: "", opportunityNo: "", expectedProposalDate: "", services: [], remarks: "" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New RFQ</Button>
      </SheetTrigger>
      <SheetContent className="max-w-lg">
        <div className="space-y-5 p-6">
          <SheetTitle className="text-lg font-semibold">Create RFQ</SheetTitle>

          <Field label="Title (subject)">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Solution Request | …" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Partner">
              <Input list="partners" value={form.partnerName} onChange={(e) => set("partnerName", e.target.value)} />
              <datalist id="partners">{settings?.partners?.map((p: string) => <option key={p} value={p} />)}</datalist>
            </Field>
            <Field label="Customer">
              <Input list="customers" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
              <datalist id="customers">{settings?.customers?.map((c: string) => <option key={c} value={c} />)}</datalist>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity"><Input value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="100 Mbps" /></Field>
            <Field label="Opportunity No"><Input value={form.opportunityNo} onChange={(e) => set("opportunityNo", e.target.value)} /></Field>
          </div>
          <Field label="Expected Proposal Date">
            <Input type="date" value={form.expectedProposalDate} onChange={(e) => set("expectedProposalDate", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Deadline auto-set to one day before.</p>
          </Field>
          <Field label="Services">
            <div className="flex flex-wrap gap-1.5">
              {(settings?.services ?? []).slice(0, 24).map((s: string) => {
                const active = form.services.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("services", active ? form.services.filter((x) => x !== s) : [...form.services, s])}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Remarks"><Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} /></Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={loading || !form.title}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
