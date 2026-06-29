"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type SortingState, type VisibilityState, type RowSelectionState,
} from "@tanstack/react-table";
import { ArrowUpDown, Pin, SlidersHorizontal } from "lucide-react";
import type { RfqListItem } from "@/types";
import { cn, formatMins, formatDate } from "@/lib/utils";
import { StatusBadge, PendingWithBadge, SlaDot } from "@/components/status";
import { useUIStore } from "@/store/useUIStore";

export function RfqTable({
  rows,
  onSelectionChange,
}: {
  rows: RfqListItem[];
  onSelectionChange?: (ids: string[]) => void;
}) {
  const openRfq = useUIStore((s) => s.openRfq);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [chooserOpen, setChooserOpen] = useState(false);
  const openRow = useCallback((rfq: RfqListItem) => openRfq(rfq.id), [openRfq]);

  const columns = useMemo<ColumnDef<RfqListItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "rfqNumber",
        header: "RFQ #",
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.rfqNumber}</span>,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => <span className="line-clamp-1 max-w-[260px] text-sm">{row.original.title}</span>,
      },
      { accessorKey: "partnerName", header: "Partner", cell: ({ getValue }) => getValue() || "—" },
      { accessorKey: "customerName", header: "Customer", cell: ({ getValue }) => getValue() || "—" },
      {
        accessorKey: "services",
        header: "Service",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.services.slice(0, 2).map((s) => (
              <span key={s} className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{s}</span>
            ))}
            {row.original.services.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{row.original.services.length - 2}</span>
            )}
          </div>
        ),
      },
      { accessorKey: "capacity", header: "Capacity", cell: ({ getValue }) => getValue() || "—" },
      { accessorKey: "pendingWith", header: "Pending With", cell: ({ getValue }) => <PendingWithBadge value={getValue() as string} /> },
      { accessorKey: "salesDelayMins", header: "Sales", cell: ({ getValue }) => <DelayCell mins={getValue() as number} /> },
      { accessorKey: "presalesDelayMins", header: "Presales", cell: ({ getValue }) => <DelayCell mins={getValue() as number} /> },
      { accessorKey: "sourcingDelayMins", header: "Sourcing", cell: ({ getValue }) => <DelayCell mins={getValue() as number} /> },
      { accessorKey: "totalDelayMins", header: "Total", cell: ({ getValue }) => <span className="font-medium">{formatMins(getValue() as number)}</span> },
      { accessorKey: "expectedProposalDate", header: "Expected", cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: "deadline", header: "Deadline", cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    enableRowSelection: true,
    getRowId: (r) => r.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  useEffect(() => {
    onSelectionChange?.(Object.keys(rowSelection).filter((k) => rowSelection[k]));
  }, [rowSelection, onSelectionChange]);

  return (
    <div className="relative">
      {/* Column chooser */}
      <div className="mb-2 flex justify-end">
        <div className="relative">
          <button
            onClick={() => setChooserOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Columns
          </button>
          {chooserOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setChooserOpen(false)} />
              <div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border bg-popover p-2 shadow-lg">
                {table.getAllLeafColumns().filter((c) => c.id !== "select").map((col) => (
                  <label key={col.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent">
                    <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} />
                    {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/95 backdrop-blur">
                {hg.headers.map((h, i) => (
                  <th
                    key={h.id}
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted-foreground",
                      i <= 1 && "sticky z-10 bg-muted/95",
                      i === 0 && "left-0",
                      i === 1 && "left-10"
                    )}
                  >
                    {h.column.getCanSort() ? (
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.id === "rfqNumber" ? <Pin className="h-3 w-3 opacity-40" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr
                key={r.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${r.original.rfqNumber}: ${r.original.title}`}
                onClick={() => openRow(r.original)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openRow(r.original);
                  }
                }}
                className={cn(
                  "cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  r.getIsSelected() && "bg-primary/5"
                )}
              >
                {r.getVisibleCells().map((c, i) => (
                  <td
                    key={c.id}
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5",
                      i <= 1 && "sticky z-[1] bg-card",
                      i === 0 && "left-0",
                      i === 1 && "left-10"
                    )}
                  >
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-16 text-center text-sm text-muted-foreground">
                  No RFQs match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DelayCell({ mins }: { mins: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <SlaDot mins={mins} />
      {formatMins(mins)}
    </span>
  );
}
