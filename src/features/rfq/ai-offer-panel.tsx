"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, AlertTriangle, HelpCircle, Building2, DollarSign, ChevronDown,
  BookOpen, Cpu, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BudgetaryOffer } from "@/types";

function confidenceTone(score: number) {
  if (score >= 70) return { ring: "text-success", bg: "bg-success/10", label: "High" };
  if (score >= 40) return { ring: "text-warning", bg: "bg-warning/10", label: "Moderate" };
  return { ring: "text-destructive", bg: "bg-destructive/10", label: "Low" };
}

/**
 * Collapsible, read-only AI Budgetary Recommendation panel.
 * Lives in its own section and NEVER writes back to RFQ fields.
 */
export function AiOfferPanel({ offer, generatedAt }: { offer: BudgetaryOffer; generatedAt?: string }) {
  const [open, setOpen] = useState(true);
  const tone = confidenceTone(offer.confidenceScore);

  return (
    <div className="overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-b from-primary/[0.06] to-transparent">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">AI Budgetary Recommendation</h3>
            {generatedAt && <p className="text-[11px] text-muted-foreground">Generated {new Date(generatedAt).toLocaleString()}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone.bg, tone.ring)}>
            {offer.confidenceScore}% · {tone.label}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="space-y-4 border-t border-primary/20 p-4">
              <Section title="Executive Summary">
                <p className="text-sm leading-relaxed text-foreground/90">{offer.executiveSummary}</p>
              </Section>

              <Section title="Technical Recommendation" icon={Cpu}>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <Spec k="Recommended Service" v={offer.recommendedSolution.recommendedService} />
                  <Spec k="Bandwidth" v={offer.recommendedSolution.bandwidth} />
                  <Spec k="Access Technology" v={offer.recommendedSolution.accessTechnology} />
                  <Spec k="Protection" v={offer.recommendedSolution.protection} />
                  <Spec k="Suggested Architecture" v={offer.recommendedSolution.architecture} span />
                  <Spec k="Possible Routing" v={offer.recommendedSolution.routing} span />
                </dl>
                {offer.recommendedSolution.assumptions?.length > 0 && (
                  <Bullets title="Assumptions" items={offer.recommendedSolution.assumptions} />
                )}
              </Section>

              <Section title="Recommended Suppliers" icon={Building2}>
                <div className="space-y-2">
                  {offer.potentialSuppliers?.length ? offer.potentialSuppliers.map((s, i) => (
                    <div key={i} className="rounded-lg border bg-card p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{s.name}</span>
                        <ConfidenceBar value={s.confidence} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>
                      {s.footprint && <p className="mt-0.5 text-[11px] text-muted-foreground/80">Footprint: {s.footprint}</p>}
                    </div>
                  )) : <Empty>No supplier matched the available evidence.</Empty>}
                </div>
              </Section>

              <Section title="Suggested Partner Contacts (internal directory)" icon={Users}>
                {offer.suggestedContacts?.length ? (
                  <ul className="space-y-1 text-sm">
                    {offer.suggestedContacts.map((c, i) => (
                      <li key={i}><span className="font-medium">{c.name}</span> — <span className="text-muted-foreground">{c.note}</span></li>
                    ))}
                  </ul>
                ) : <Empty>No internal contact match — no recommendation made.</Empty>}
              </Section>

              <Section title="Budgetary Price Range" icon={DollarSign}>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Price label="Low" v={offer.priceGuidance.low} c={offer.priceGuidance.currency} />
                  <Price label="Expected" v={offer.priceGuidance.expected} c={offer.priceGuidance.currency} highlight />
                  <Price label="High" v={offer.priceGuidance.high} c={offer.priceGuidance.currency} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Pricing confidence: {offer.priceGuidance.confidence}</p>
              </Section>

              <div className="grid gap-3 sm:grid-cols-2">
                <Section title="Risks" icon={AlertTriangle}>
                  <Bullets items={offer.risks} muted />
                </Section>
                <Section title="Missing Information" icon={HelpCircle}>
                  <Bullets items={offer.missingInformation} muted />
                </Section>
              </div>

              {offer.historicalReferences?.length ? (
                <Section title="Historical References" icon={BookOpen}>
                  <Bullets items={offer.historicalReferences} muted />
                </Section>
              ) : null}

              <Section title="Confidence Score">
                <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", tone.ring.replace("text-", "bg-"))} style={{ width: `${offer.confidenceScore}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{offer.confidenceExplanation}</p>
              </Section>

              <p className="rounded-md bg-warning/10 p-2 text-[11px] text-warning">{offer.disclaimer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </h4>
      {children}
    </div>
  );
}
function Spec({ k, v, span }: { k: string; v?: string; span?: boolean }) {
  return (
    <div className={cn("rounded-md bg-card p-2", span && "col-span-2")}>
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd className="text-sm">{v || "—"}</dd>
    </div>
  );
}
function Bullets({ title, items, muted }: { title?: string; items?: string[]; muted?: boolean }) {
  if (!items?.length) return <Empty>None noted.</Empty>;
  return (
    <div>
      {title && <p className="mb-1 text-[11px] font-medium text-muted-foreground">{title}</p>}
      <ul className={cn("list-inside list-disc space-y-0.5 text-xs", muted ? "text-muted-foreground" : "text-foreground/90")}>
        {items.map((a, i) => <li key={i}>{a}</li>)}
      </ul>
    </div>
  );
}
function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </span>
  );
}
function Price({ label, v, c, highlight }: { label: string; v: number | null; c: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-2", highlight ? "border-primary bg-primary/10" : "bg-card")}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{v != null ? `${c} ${v.toLocaleString()}` : "—"}</p>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-muted-foreground">{children}</p>;
}
