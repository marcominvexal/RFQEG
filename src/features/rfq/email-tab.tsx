"use client";
import { useState } from "react";
import { Sparkles, Loader2, Send, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useEmailReply, useEmailSummary } from "@/hooks/useRfqs";

export function EmailTab({ rfq, isSales }: { rfq: any; isSales: boolean }) {
  const reply = useEmailReply(rfq.id);
  const summary = useEmailSummary(rfq.id);
  const [showReply, setShowReply] = useState(false);
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");

  const summaryRec = rfq.aiRecommendations?.find((r: any) => r.kind === "SUMMARY");
  const threads = rfq.emailThreads ?? [];

  function send() {
    if (!body.trim()) return;
    reply.mutate(
      { body, to: to || undefined },
      { onSuccess: () => { setBody(""); setShowReply(false); } }
    );
  }

  if (!threads.length) {
    return <p className="text-sm text-muted-foreground">No linked email (created manually).</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => summary.mutate()} disabled={summary.isPending}>
          {summary.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI Summary
        </Button>
        {isSales && (
          <Button variant="outline" size="sm" onClick={() => setShowReply((s) => !s)}>
            <Send className="h-3.5 w-3.5" /> Reply
          </Button>
        )}
      </div>

      {(summary.data?.summary || summaryRec) && (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Thread summary
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {summary.data?.summary ?? summaryRec?.payload?.summary}
          </p>
        </div>
      )}

      {showReply && isSales && (
        <div className="space-y-2 rounded-lg border p-3">
          <Input placeholder="To (defaults to last sender)" value={to} onChange={(e) => setTo(e.target.value)} />
          <Textarea placeholder="Write your reply…" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[100px]" />
          {reply.isError && <p className="text-xs text-destructive">{(reply.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowReply(false)}>Cancel</Button>
            <Button size="sm" onClick={send} disabled={reply.isPending || !body.trim()}>
              {reply.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {threads.map((e: any) => {
          const out = e.direction === "OUTBOUND";
          return (
            <div key={e.id} className={cn("rounded-lg border p-3", out && "border-primary/30 bg-primary/[0.03]")}>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {out ? <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> : <ArrowDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                  {e.subject || "(no subject)"}
                </p>
                <span className="text-[11px] text-muted-foreground">{formatDate(e.internalDate)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{out ? `To: ${e.toAddr}` : `From: ${e.fromAddr}`}</p>
              <p className="mt-2 line-clamp-[8] whitespace-pre-wrap text-sm text-muted-foreground">{e.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
