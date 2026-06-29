export type Role = "SALES" | "PRESALES";
export type RfqStatus =
  | "NEW" | "ASSIGNED" | "PENDING" | "SUBMITTED" | "WON" | "LOST" | "CANCELLED";
export type PendingWith = "SALES" | "PRESALES" | "SOURCING";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
}

export interface RfqListItem {
  id: string;
  rfqNumber: string;
  title: string;
  partnerName: string | null;
  customerName: string | null;
  services: string[];
  capacity: string | null;
  pendingWith: PendingWith;
  status: RfqStatus;
  priority: Priority;
  salesDelayMins: number;
  presalesDelayMins: number;
  sourcingDelayMins: number;
  totalDelayMins: number;
  expectedProposalDate: string | null;
  deadline: string | null;
  aiOfferEnabled: boolean;
}

export interface DelayResult {
  businessDays: number;
  weekendDays: number;
  holidayDays: number;
  effectiveDelayDays: number;
}

// ---- AI Budgetary Offer structured output ----
export interface SupplierRec {
  name: string;
  confidence: number; // 0..1
  reason: string;
  footprint: string;
}
export interface PriceGuidance {
  currency: string;
  low: number | null;
  expected: number | null;
  high: number | null;
  confidence: string;
}
export interface BudgetaryOffer {
  executiveSummary: string;
  recommendedSolution: {
    architecture: string;
    routing: string;
    protection: string;
    accessTechnology: string;
    recommendedService: string;
    bandwidth: string;
    assumptions: string[];
  };
  potentialSuppliers: SupplierRec[];
  suggestedContacts: { name: string; note: string }[];
  priceGuidance: PriceGuidance;
  risks: string[];
  missingInformation: string[];
  historicalReferences?: string[];
  confidenceScore: number; // 0..100
  confidenceExplanation: string;
  disclaimer: string;
}

export interface ExtractedRfq {
  partner: string | null;
  customer: string | null;
  opportunityNo: string | null;
  capacity: string | null;
  bandwidth: string | null;
  locations: string[] | null;
  countries: string[] | null;
  service: string[] | null;
  protection: string | null;
  remarks: string | null;
  specialInstructions: string | null;
}
