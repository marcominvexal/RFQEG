import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { naiveBusinessDays } from "@/lib/business-days";
import type { ExtractedRfq, DelayResult, BudgetaryOffer } from "@/types";

export { naiveBusinessDays };

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export interface GenOpts {
  rfqId?: string;
  userId?: string;
  temperature?: number;
}

/** Low-level JSON call with full logging (timing + tokens). Returns parsed JSON or null. */
async function generateJson<T>(
  feature: string,
  prompt: string,
  opts: GenOpts = {}
): Promise<T | null> {
  const started = Date.now();
  const ai = client();
  if (!ai) {
    await log({ feature, prompt, response: null, success: false, ...opts, executionMs: 0 });
    return null;
  }
  try {
    const model = ai.getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: "application/json", temperature: opts.temperature ?? 0.2 },
    });
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    const usage: any = (res.response as any).usageMetadata ?? {};
    await log({
      feature, prompt, response: text, success: true, ...opts,
      executionMs: Date.now() - started,
      tokensIn: usage.promptTokenCount, tokensOut: usage.candidatesTokenCount,
    });
    return JSON.parse(text) as T;
  } catch (e) {
    console.error(`Gemini ${feature} failed`, e);
    await log({ feature, prompt, response: String(e), success: false, ...opts, executionMs: Date.now() - started });
    return null;
  }
}

async function log(d: {
  feature: string;
  prompt: string;
  response: string | null;
  success: boolean;
  rfqId?: string;
  userId?: string;
  executionMs?: number;
  tokensIn?: number;
  tokensOut?: number;
}) {
  try {
    await prisma.aiPromptLog.create({
      data: {
        feature: d.feature,
        prompt: d.prompt.slice(0, 8000),
        response: d.response?.slice(0, 8000),
        success: d.success,
        rfqId: d.rfqId,
        userId: d.userId,
        executionMs: d.executionMs,
        tokensIn: d.tokensIn,
        tokensOut: d.tokensOut,
      },
    });
  } catch {
    /* never block */
  }
}

// ------------------------------------------------------------------
// 1) Email parsing → structured RFQ
// ------------------------------------------------------------------
export async function extractRfqFromEmail(
  subject: string,
  body: string
): Promise<ExtractedRfq> {
  const prompt = `You are a telecom RFQ data extraction engine.
Extract the following fields from the email. Return JSON ONLY, no prose.
If a field is unavailable, return null. NEVER invent or hallucinate values.

Fields (exact keys):
{
  "partner": string|null,
  "customer": string|null,
  "opportunityNo": string|null,
  "capacity": string|null,
  "bandwidth": string|null,
  "locations": string[]|null,
  "countries": string[]|null,
  "service": string[]|null,
  "protection": string|null,
  "remarks": string|null,
  "specialInstructions": string|null
}

EMAIL SUBJECT: ${subject}
EMAIL BODY:
${body}`;

  const parsed = await generateJson<ExtractedRfq>("EMAIL_PARSE", prompt);
  return (
    parsed ?? {
      partner: null, customer: null, opportunityNo: null, capacity: null,
      bandwidth: null, locations: null, countries: null, service: null,
      protection: null, remarks: null, specialInstructions: null,
    }
  );
}

// ------------------------------------------------------------------
// 2) Business-day / delay calculation (PK weekends + public holidays)
// ------------------------------------------------------------------
export async function calculateDelay(
  start: Date,
  end: Date,
  country = process.env.DELAY_COUNTRY || "Pakistan"
): Promise<DelayResult> {
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  const cacheKey = `${startKey}|${endKey}|${country}`;

  const cached = await prisma.delayCache.findUnique({ where: { cacheKey } });
  if (cached) {
    return {
      businessDays: cached.businessDays,
      weekendDays: cached.weekendDays,
      holidayDays: cached.holidayDays,
      effectiveDelayDays: cached.effectiveDelayDays,
    };
  }

  const prompt = `Calculate working days between two dates for ${country}.
Exclude Saturdays, Sundays and ${country} public holidays.
Return JSON ONLY:
{ "businessDays": number, "weekendDays": number, "holidayDays": number, "effectiveDelayDays": number }
Start Date: ${startKey}
End Date: ${endKey}
Country: ${country}`;

  let result = await generateJson<DelayResult>("DELAY", prompt);
  if (!result) result = naiveBusinessDays(start, end);

  try {
    await prisma.delayCache.create({
      data: {
        cacheKey,
        businessDays: result.businessDays,
        weekendDays: result.weekendDays,
        holidayDays: result.holidayDays,
        effectiveDelayDays: result.effectiveDelayDays,
      },
    });
  } catch {
    /* concurrent insert — ignore */
  }
  return result;
}

// ------------------------------------------------------------------
// 3) Thread / supplier-response summarization & follow-up
// ------------------------------------------------------------------
export async function summarizeText(
  feature: "SUMMARY" | "SUPPLIER_SUMMARY",
  text: string,
  rfqId?: string
): Promise<string | null> {
  const prompt = `Summarize the following telecom RFQ ${
    feature === "SUPPLIER_SUMMARY" ? "supplier responses" : "email thread"
  } in 4-6 concise bullet points. Return JSON: { "summary": string }.
TEXT:
${text}`;
  const r = await generateJson<{ summary: string }>(feature, prompt, { rfqId });
  return r?.summary ?? null;
}

export async function suggestFollowUp(context: string, rfqId?: string): Promise<string | null> {
  const prompt = `Draft a short, professional follow-up email to a telecom supplier requesting a quotation update.
Return JSON: { "email": string }. Keep it under 150 words, polite, specific.
CONTEXT:
${context}`;
  const r = await generateJson<{ email: string }>("FOLLOWUP", prompt, { rfqId });
  return r?.email ?? null;
}

// ------------------------------------------------------------------
// 4) AI Budgetary Offer (deep reasoning over full RFQ context)
// ------------------------------------------------------------------
export async function generateBudgetaryOffer(
  context: string,
  rfqId: string,
  userId?: string
): Promise<BudgetaryOffer | null> {
  const prompt = `ROLE: You are a Senior Global Telecom Presales Engineer with 20+ years of
experience designing international connectivity (DIA, IP Transit, L2/L3 VPN, IPLC/IEPL,
DWDM, dark fiber, last-mile, cloud on-ramps) across EMEA, APAC, the Americas and the
Middle East. You are producing a BUDGETARY (non-binding) recommendation to help Presales
respond before the customer deadline when firm supplier quotes are not yet available.

METHOD — reason step by step like a senior engineer before answering:
1. Restate what the customer is actually asking for (service, endpoints, capacity, protection).
2. Assess geographic feasibility and likely routing between the locations/countries given.
3. Identify which carriers in the provided supplier/partner directories plausibly serve
   these routes, weighting any that appear in the historical quotations/RFQs.
4. Derive a budgetary price range from the historical quotations for comparable
   service+capacity+geography; if none exist, reason from typical market structure and say so.
5. Surface assumptions, risks, and the specific missing inputs that would tighten the quote.

HARD RULES:
- Use ONLY the evidence in CONTEXT plus clearly-labeled reasonable assumptions.
- NEVER fabricate supplier capabilities, pricing, or contact details.
- "suggestedContacts" MUST come ONLY from the partnerDirectory/supplierDirectory in CONTEXT
  (internal database). If none match, return an empty array — do not invent names.
- Recommend a supplier only if evidence supports it; if confidence is low, state it plainly.
- All prices are budgetary estimates, not quotations.

Return JSON ONLY with this exact shape:
{
  "executiveSummary": string,
  "recommendedSolution": {
    "architecture": string, "routing": string, "protection": string,
    "accessTechnology": string, "recommendedService": string,
    "bandwidth": string, "assumptions": string[]
  },
  "potentialSuppliers": [{ "name": string, "confidence": number, "reason": string, "footprint": string }],
  "suggestedContacts": [{ "name": string, "note": string }],
  "priceGuidance": { "currency": string, "low": number|null, "expected": number|null, "high": number|null, "confidence": string },
  "risks": string[],
  "missingInformation": string[],
  "historicalReferences": string[],
  "confidenceScore": number,
  "confidenceExplanation": string,
  "disclaimer": string
}

RFQ CONTEXT (JSON):
${context}`;

  const offer = await generateJson<BudgetaryOffer>("BUDGETARY_OFFER", prompt, {
    rfqId, userId, temperature: 0.3,
  });
  if (offer && !offer.disclaimer) {
    offer.disclaimer =
      "These are budgetary estimates derived from historical data and reasonable assumptions — NOT confirmed supplier quotations.";
  }
  return offer;
}

// ------------------------------------------------------------------
// 5) Duplicate detection
// ------------------------------------------------------------------
export async function detectDuplicate(
  candidate: string,
  existing: string,
): Promise<{ isDuplicate: boolean; confidence: number; reason: string } | null> {
  const prompt = `Decide whether the CANDIDATE RFQ duplicates any EXISTING RFQ.
Return JSON: { "isDuplicate": boolean, "confidence": number, "reason": string }.
CANDIDATE:
${candidate}
EXISTING:
${existing}`;
  return generateJson("DUPLICATE", prompt);
}
