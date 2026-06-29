"use client";
import { useState } from "react";
import {
  Clock, MessageSquare, Paperclip, Truck, Mail as MailIcon, Sparkles, Loader2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, PriorityBadge, PendingWithBadge, LiveDelay, DeadlineBadge } from "@/components/status";
import { AiOfferPanel } from "@/features/rfq/ai-offer-panel";
import { EmailTab } from "@/features/rfq/email-tab";
import { AttachmentsTab } from "@/features/rfq/attachments-tab";
import { useUIStore } from "@/store/useUIStore";
import { useRfq, useUpdateRfq, useAddComment, useAiOffer } from "@/hooks/useRfqs";
import { useMe } from "@/hooks/useAuth";
import { RFQ_STATUSES, PENDING_WITH } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export function RfqSheet() {
  const id = useUIStore((s) => s.selectedRfqId);
  const close = useUIStore((s) => s.closeRfq);
  const open = !!id;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent>{id && <RfqDetail id={id} />}</SheetContent>
    </Sheet>
  );
}

function RfqDetail({ id }: { id: string }) {
  const { data: user } = useMe();
  const { data: rfq, isLoading } = useRfq(id);
  const update = useUpdateRfq(id);
  const ai = useAiOffer(id);
  const isSales = user?.role === "SALES";

  if (isLoading || !rfq) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const latestRec = rfq.aiRecommendations?.find((r: any) => r.kind === "BUDGETARY_OFFER");
  const latestOffer = latestRec?.payload;
  const hours = 24;
  const aiActive =
    rfq.aiOfferEnabled ||
    (rfq.deadline ? new Date(rfq.deadline).getTime() - Date.now() <= hours * 3600000 : false);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-6 pb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{rfq.rfqNumber}</span>
          <span>·</span>
          <span>Imported {formatDate(rfq.requestDate)}</span>
        </div>
        <h2 className="mt-1 pr-8 text-lg font-semibold leading-snug">{rfq.title}</h2>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={rfq.status} />
          <PriorityBadge priority={rfq.priority} />
          <PendingWithBadge value={rfq.pendingWith} />
          <DeadlineBadge deadline={rfq.deadline} />
        </div>

        {/* Quick stat strip */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Stat label="Sales" mins={rfq.salesDelayMins} />
          <Stat label="Presales" mins={rfq.presalesDelayMins} />
          <Stat label="Sourcing" mins={rfq.sourcingDelayMins} />
          <Stat label="Total" mins={rfq.totalDelayMins} bold />
        </div>
      </div>

      {/* Editable controls */}
      <div className="grid grid-cols-2 gap-3 border-b p-6 py-4 sm:grid-cols-3">
        <Control label="Pending With">
          <Select
            value={rfq.pendingWith}
            onChange={(e) => update.mutate({ pendingWith: e.target.value })}
            className="w-full"
          >
            {PENDING_WITH.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Control>

        <Control label="Status" hint={!isSales ? "Sales only" : undefined}>
          <Select
            value={rfq.status}
            disabled={!isSales}
            onChange={(e) => update.mutate({ status: e.target.value })}
            className="w-full"
          >
            {RFQ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Control>

        <Control label="Expected Proposal" hint={!isSales ? "Sales only" : undefined}>
          <Input
            type="date"
            disabled={!isSales}
            defaultValue={rfq.expectedProposalDate?.slice(0, 10) ?? ""}
            onBlur={(e) => e.target.value && update.mutate({ expectedProposalDate: e.target.value })}
          />
        </Control>

        {isSales && (
          <>
            <Control label="Partner">
              <Input defaultValue={rfq.partnerName ?? ""} onBlur={(e) => update.mutate({ partnerName: e.target.value })} />
            </Control>
            <Control label="Customer">
              <Input defaultValue={rfq.customerName ?? ""} onBlur={(e) => update.mutate({ customerName: e.target.value })} />
            </Control>
            <Control label="Capacity">
              <Input defaultValue={rfq.capacity ?? ""} onBlur={(e) => update.mutate({ capacity: e.target.value })} />
            </Control>
          </>
        )}
        <Control label="Deadline (derived)">
          <div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground">
            {formatDate(rfq.deadline)}
          </div>
        </Control>
      </div>

      {/* Reason for delay — editable by Sales and Presales */}
      <div className="border-b px-6 py-4">
        <Control label="Reason for Delay">
          <Textarea
            defaultValue={rfq.reasonForDelay ?? ""}
            placeholder="Explain any delay (visible to Sales & Presales)…"
            className="min-h-[60px]"
            onBlur={(e) => {
              if ((e.target.value || "") !== (rfq.reasonForDelay ?? "")) update.mutate({ reasonForDelay: e.target.value });
            }}
          />
        </Control>
      </div>

      {/* Middle: structured detail */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-b p-6 py-4 text-sm">
        <Detail label="Locations" value={rfq.locations?.join(", ")} />
        <Detail label="Countries" value={rfq.countries?.join(", ")} />
        <Detail label="Services" value={rfq.services?.join(", ")} />
        <Detail label="Opportunity No" value={rfq.opportunityNo} />
        <Detail label="Bandwidth" value={rfq.bandwidth} />
        <Detail label="Protection" value={rfq.protection} />
        <div className="col-span-2"><Detail label="Remarks" value={rfq.remarks} /></div>
      </div>

      {/* AI Budgetary Offer */}
      <div className="border-b p-6 py-4">
        <Button
          variant={aiActive ? "default" : "secondary"}
          disabled={!aiActive || ai.isPending}
          onClick={() => ai.mutate()}
          title={aiActive ? "" : "Activates within 24h of deadline, or when Sales enables it."}
        >
          {ai.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Ask AI for a Budgetary Offer
        </Button>
        {isSales && !rfq.aiOfferEnabled && (
          <button className="ml-3 text-xs text-primary underline" onClick={() => update.mutate({ aiOfferEnabled: true })}>
            Enable now
          </button>
        )}
        {ai.isError && <p className="mt-2 text-xs text-destructive">{(ai.error as Error).message}</p>}
        {latestOffer && <div className="mt-4"><AiOfferPanel offer={latestOffer} generatedAt={latestRec?.createdAt} /></div>}
      </div>

      {/* Bottom tabs */}
      <div className="p-6">
        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline"><Clock className="mr-1.5 h-3.5 w-3.5" />Timeline</TabsTrigger>
            <TabsTrigger value="comments"><MessageSquare className="mr-1.5 h-3.5 w-3.5" />Comments</TabsTrigger>
            <TabsTrigger value="attachments"><Paperclip className="mr-1.5 h-3.5 w-3.5" />Files</TabsTrigger>
            <TabsTrigger value="supplier"><Truck className="mr-1.5 h-3.5 w-3.5" />Supplier</TabsTrigger>
            <TabsTrigger value="email"><MailIcon className="mr-1.5 h-3.5 w-3.5" />Email</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <ol className="relative space-y-4 border-l pl-4">
              {rfq.activities?.map((a: any) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm">{a.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.actor?.name ?? "System"} · {formatDate(a.createdAt)}
                  </p>
                </li>
              ))}
              {!rfq.activities?.length && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            </ol>
          </TabsContent>

          <TabsContent value="comments">
            <CommentThread rfqId={id} comments={rfq.comments?.filter((c: any) => c.type === "INTERNAL")} type="INTERNAL" />
          </TabsContent>

          <TabsContent value="attachments">
            <AttachmentsTab rfq={rfq} />
          </TabsContent>

          <TabsContent value="supplier">
            <CommentThread rfqId={id} comments={rfq.comments?.filter((c: any) => c.type === "SUPPLIER")} type="SUPPLIER" />
          </TabsContent>

          <TabsContent value="email">
            <EmailTab rfq={rfq} isSales={isSales} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CommentThread({ rfqId, comments, type }: { rfqId: string; comments: any[]; type: "INTERNAL" | "SUPPLIER" }) {
  const add = useAddComment(rfqId);
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {comments?.map((c) => (
          <div key={c.id} className="rounded-lg border bg-card p-2.5">
            <p className="text-sm">{c.body}</p>
            <p className="text-xs text-muted-foreground">{c.author?.name ?? "—"} · {formatDate(c.createdAt)}</p>
          </div>
        ))}
        {!comments?.length && <p className="text-sm text-muted-foreground">No {type === "INTERNAL" ? "internal" : "supplier"} comments yet.</p>}
      </div>
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={type === "INTERNAL" ? "Add internal note…" : "Add supplier update…"}
          className="min-h-[60px]"
        />
        <Button
          onClick={() => { if (text.trim()) { add.mutate({ type, body: text }); setText(""); } }}
          disabled={add.isPending || !text.trim()}
        >
          Post
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, mins, bold }: { label: string; mins: number; bold?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`flex items-center justify-center gap-1 text-sm ${bold ? "font-semibold" : ""}`}>
        <LiveDelay mins={mins} />
      </p>
    </div>
  );
}
function Control({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}{hint && <span className="text-[10px] text-muted-foreground/70">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}
