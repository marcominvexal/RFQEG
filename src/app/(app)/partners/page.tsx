"use client";
import { useState } from "react";
import { Plus, Trash2, Building2, Star, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { usePartners, usePartnerMutations } from "@/hooks/useDirectory";
import { useMe } from "@/hooks/useAuth";

const empty = {
  id: "", name: "", country: "", services: "", email: "", phone: "",
  accountManager: "", notes: "", preferredSupplier: false,
};

export default function PartnersPage() {
  const { data: user } = useMe();
  const { data: partners, isLoading } = usePartners();
  const { create, update, remove } = usePartnerMutations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);

  if (user && user.role !== "SALES")
    return <p className="text-sm text-muted-foreground">Partner management is available to Sales (Admin) only.</p>;

  function edit(p: any) {
    setForm({
      id: p.id, name: p.name, country: p.country ?? "", services: (p.services ?? []).join(", "),
      email: p.email ?? "", phone: p.phone ?? "", accountManager: p.accountManager ?? "",
      notes: p.notes ?? "", preferredSupplier: !!p.preferredSupplier,
    });
    setOpen(true);
  }

  function save() {
    const payload: any = {
      name: form.name, country: form.country || null,
      services: form.services ? form.services.split(",").map((x) => x.trim()).filter(Boolean) : [],
      email: form.email || null, phone: form.phone || null,
      accountManager: form.accountManager || null, notes: form.notes || null,
      preferredSupplier: form.preferredSupplier,
    };
    const done = () => { setOpen(false); setForm(empty); };
    if (form.id) update.mutate({ id: form.id, ...payload }, { onSuccess: done });
    else create.mutate(payload, { onSuccess: done });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Partner Management</h1>
          <p className="text-sm text-muted-foreground">{partners?.length ?? 0} partners · internal contact directory for the AI</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4" /> New Partner</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {partners?.map((p: any) => (
            <Card key={p.id} className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">{p.name}</span>
                    {p.preferredSupplier && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => edit(p)}>Edit</Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {p.accountManager && <p className="text-xs text-muted-foreground">AM: {p.accountManager}</p>}
                {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                <div className="flex flex-wrap gap-1">{(p.services ?? []).slice(0, 4).map((x: string) => <Badge key={x} variant="secondary">{x}</Badge>)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-lg">
          <div className="space-y-4 p-6">
            <SheetTitle className="text-lg font-semibold">{form.id ? "Edit" : "New"} Partner</SheetTitle>
            <F label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Country"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></F>
              <F label="Account Manager"><Input value={form.accountManager} onChange={(e) => setForm({ ...form, accountManager: e.target.value })} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
              <F label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
            </div>
            <F label="Services (comma separated)"><Input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} /></F>
            <F label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.preferredSupplier} onChange={(e) => setForm({ ...form, preferredSupplier: e.target.checked })} />
              Preferred supplier
            </label>
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
