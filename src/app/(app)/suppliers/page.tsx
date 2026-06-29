"use client";
import { useState } from "react";
import { Plus, Trash2, Truck, Star, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuppliers, useSupplierMutations } from "@/hooks/useDirectory";
import { useMe } from "@/hooks/useAuth";

const empty = {
  id: "", name: "", country: "", coverage: "", countries: "", services: "",
  leadTimeDays: "", reliabilityScore: "", performanceScore: "", responseTimeHours: "", preferredContact: "",
};

export default function SuppliersPage() {
  const { data: user } = useMe();
  const { data: suppliers, isLoading } = useSuppliers();
  const { create, update, remove } = useSupplierMutations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);

  if (user && user.role !== "SALES")
    return <p className="text-sm text-muted-foreground">Supplier management is available to Sales (Admin) only.</p>;

  function edit(s: any) {
    setForm({
      id: s.id, name: s.name, country: s.country ?? "", coverage: s.coverage ?? "",
      countries: (s.countries ?? []).join(", "), services: (s.services ?? []).join(", "),
      leadTimeDays: s.leadTimeDays ?? "", reliabilityScore: s.reliabilityScore ?? "",
      performanceScore: s.performanceScore ?? "", responseTimeHours: s.responseTimeHours ?? "",
      preferredContact: s.preferredContact ?? "",
    });
    setOpen(true);
  }

  function save() {
    const payload: any = {
      name: form.name, country: form.country || null, coverage: form.coverage || null,
      countries: form.countries ? form.countries.split(",").map((x) => x.trim()).filter(Boolean) : [],
      services: form.services ? form.services.split(",").map((x) => x.trim()).filter(Boolean) : [],
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : null,
      reliabilityScore: form.reliabilityScore ? Number(form.reliabilityScore) : null,
      performanceScore: form.performanceScore ? Number(form.performanceScore) : null,
      responseTimeHours: form.responseTimeHours ? Number(form.responseTimeHours) : null,
      preferredContact: form.preferredContact || null,
    };
    const done = () => { setOpen(false); setForm(empty); };
    if (form.id) update.mutate({ id: form.id, ...payload }, { onSuccess: done });
    else create.mutate(payload, { onSuccess: done });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Supplier Database</h1>
          <p className="text-sm text-muted-foreground">{suppliers?.length ?? 0} suppliers · used by the AI engine</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4" /> New Supplier</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : suppliers?.length ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s: any) => (
            <Card key={s.id} className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => edit(s)}>Edit</Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {s.coverage && <p className="text-xs text-muted-foreground">{s.coverage}</p>}
                <div className="flex flex-wrap gap-1">{(s.services ?? []).slice(0, 4).map((x: string) => <Badge key={x} variant="secondary">{x}</Badge>)}</div>
                <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                  {s.leadTimeDays != null && <span>Lead {s.leadTimeDays}d</span>}
                  {s.reliabilityScore != null && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3" /> {s.reliabilityScore}</span>}
                  {s.countries?.length ? <span>{s.countries.length} countries</span> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState onAdd={() => setOpen(true)} />
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-lg">
          <div className="space-y-4 p-6">
            <SheetTitle className="text-lg font-semibold">{form.id ? "Edit" : "New"} Supplier</SheetTitle>
            <F label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Country"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></F>
              <F label="Lead time (days)"><Input type="number" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} /></F>
            </div>
            <F label="Coverage"><Textarea value={form.coverage} onChange={(e) => setForm({ ...form, coverage: e.target.value })} /></F>
            <F label="Countries (comma separated)"><Input value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} /></F>
            <F label="Services (comma separated)"><Input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} /></F>
            <div className="grid grid-cols-3 gap-3">
              <F label="Reliability"><Input type="number" value={form.reliabilityScore} onChange={(e) => setForm({ ...form, reliabilityScore: e.target.value })} /></F>
              <F label="Performance"><Input type="number" value={form.performanceScore} onChange={(e) => setForm({ ...form, performanceScore: e.target.value })} /></F>
              <F label="Resp (hrs)"><Input type="number" value={form.responseTimeHours} onChange={(e) => setForm({ ...form, responseTimeHours: e.target.value })} /></F>
            </div>
            <F label="Preferred contact"><Input value={form.preferredContact} onChange={(e) => setForm({ ...form, preferredContact: e.target.value })} /></F>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.name || create.isPending || update.isPending}>
                {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-sm font-medium">{label}</label>{children}</div>;
}
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Truck className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No suppliers yet. Add your carrier database so the AI can use it.</p>
        <Button onClick={onAdd}><Plus className="h-4 w-4" /> Add supplier</Button>
      </CardContent>
    </Card>
  );
}
