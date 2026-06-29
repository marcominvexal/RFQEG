import * as XLSX from "xlsx";
import type { RfqListItem } from "@/types";
import { formatMins } from "@/lib/utils";

function toRows(rows: RfqListItem[]) {
  return rows.map((r) => ({
    "RFQ Number": r.rfqNumber,
    Title: r.title,
    Partner: r.partnerName ?? "",
    Customer: r.customerName ?? "",
    Service: r.services.join(", "),
    Capacity: r.capacity ?? "",
    "Pending With": r.pendingWith,
    "Sales Delay": formatMins(r.salesDelayMins),
    "Presales Delay": formatMins(r.presalesDelayMins),
    "Sourcing Delay": formatMins(r.sourcingDelayMins),
    "Total Delay": formatMins(r.totalDelayMins),
    "Expected Proposal Date": r.expectedProposalDate?.slice(0, 10) ?? "",
    Deadline: r.deadline?.slice(0, 10) ?? "",
    Status: r.status,
  }));
}

export function exportRfqsToExcel(rows: RfqListItem[]) {
  const ws = XLSX.utils.json_to_sheet(toRows(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RFQs");
  XLSX.writeFile(wb, `rfqs-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportRfqsToCsv(rows: RfqListItem[]) {
  const ws = XLSX.utils.json_to_sheet(toRows(rows));
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rfqs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
