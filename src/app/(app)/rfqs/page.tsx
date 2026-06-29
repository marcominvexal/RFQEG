"use client";
import { useCallback, useState } from "react";
import { Search, Download, Filter, FileSpreadsheet, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RfqTable } from "@/features/rfq/rfq-table";
import { UpdateFromEmailButton } from "@/features/rfq/update-from-email-button";
import { NewRfqSheet } from "@/features/rfq/new-rfq-sheet";
import { useRfqs, useSettings, useBulkUpdate } from "@/hooks/useRfqs";
import { useMe } from "@/hooks/useAuth";
import { RFQ_STATUSES, PENDING_WITH } from "@/lib/constants";
import { exportRfqsToExcel, exportRfqsToCsv } from "@/lib/export";

export default function RfqsPage() {
  const { data: user } = useMe();
  const { data: settings } = useSettings();
  const [filters, setFilters] = useState({
    search: "", status: "", pendingWith: "", partner: "", service: "", page: 1, pageSize: 25,
  });
  const { data, isLoading } = useRfqs(filters);
  const isSales = user?.role === "SALES";
  const [selected, setSelected] = useState<string[]>([]);
  const bulk = useBulkUpdate();
  const onSelectionChange = useCallback((ids: string[]) => setSelected(ids), []);

  function set<K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) {
    setFilters((f) => ({ ...f, [k]: v, page: k === "page" ? (v as number) : 1 }));
  }

  function applyBulk(patch: Record<string, any>) {
    if (!selected.length) return;
    bulk.mutate({ ids: selected, patch }, { onSuccess: () => setSelected([]) });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">RFQs</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} requests</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSales && <UpdateFromEmailButton />}
          {isSales && <NewRfqSheet />}
          <Button variant="outline" onClick={() => data && exportRfqsToExcel(data.items)} disabled={!data?.items?.length}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={() => data && exportRfqsToCsv(data.items)} disabled={!data?.items?.length}>
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search RFQ #, title, partner, customer, opportunity…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground"><Filter className="h-4 w-4" /></div>
        <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All status</option>
          {RFQ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filters.pendingWith} onChange={(e) => set("pendingWith", e.target.value)}>
          <option value="">All owners</option>
          {PENDING_WITH.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filters.partner} onChange={(e) => set("partner", e.target.value)}>
          <option value="">All partners</option>
          {settings?.partners?.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={filters.service} onChange={(e) => set("service", e.target.value)}>
          <option value="">All services</option>
          {settings?.services?.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
          <span className="px-1 text-sm font-medium">{selected.length} selected</span>
          <Select className="h-8" defaultValue="" onChange={(e) => e.target.value && applyBulk({ pendingWith: e.target.value })}>
            <option value="">Set Pending With…</option>
            {PENDING_WITH.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          {isSales && (
            <Select className="h-8" defaultValue="" onChange={(e) => e.target.value && applyBulk({ status: e.target.value })}>
              <option value="">Set Status…</option>
              {RFQ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
          {isSales && (
            <Select className="h-8" defaultValue="" onChange={(e) => e.target.value && applyBulk({ priority: e.target.value })}>
              <option value="">Set Priority…</option>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
          {bulk.isPending && <span className="text-xs text-muted-foreground">Applying…</span>}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected([])}>
            <X className="h-4 w-4" /> Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <RfqTable rows={data?.items ?? []} onSelectionChange={onSelectionChange} />
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {data.page} of {Math.ceil(data.total / data.pageSize)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => set("page", filters.page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={filters.page >= Math.ceil(data.total / data.pageSize)} onClick={() => set("page", filters.page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
