import crypto from "node:crypto";
import { ensureDatabaseReady, getCollection, scheduleWrite } from "@/lib/jsondb";

/**
 * Prisma-compatible facade over the JSON-file engine (`jsondb`).
 *
 * Implements the subset of the Prisma Client API this app uses:
 *   findUnique, findFirst, findMany, create, createMany, update, upsert, count
 * with support for: equality / contains+mode / has / hasSome / in / not /
 * gt/gte/lt/lte / startsWith, AND/OR, compound-unique keys, one-level relation
 * filters, `include` (one + many, nestable), `orderBy`, `skip`/`take`,
 * `select`, and `{ increment }` updates.
 *
 * Drop-in for `import { prisma } from "@/lib/prisma"` — no call-site changes.
 */

// ---- relation registry: model -> field -> relation ----
type Rel = { type: "one" | "many"; coll: string; fk: string };
const REL: Record<string, Record<string, Rel>> = {
  rfq: {
    comments: { type: "many", coll: "comment", fk: "rfqId" },
    attachments: { type: "many", coll: "attachment", fk: "rfqId" },
    activities: { type: "many", coll: "activity", fk: "rfqId" },
    delayHistory: { type: "many", coll: "delayHistory", fk: "rfqId" },
    statusHistory: { type: "many", coll: "statusHistory", fk: "rfqId" },
    emailThreads: { type: "many", coll: "emailThread", fk: "rfqId" },
    aiRecommendations: { type: "many", coll: "aiRecommendation", fk: "rfqId" },
    quotations: { type: "many", coll: "quotation", fk: "rfqId" },
    assignedTo: { type: "one", coll: "user", fk: "assignedToId" },
    partner: { type: "one", coll: "partner", fk: "partnerId" },
    customer: { type: "one", coll: "customer", fk: "customerId" },
  },
  partner: { contacts: { type: "many", coll: "partnerContact", fk: "partnerId" } },
  supplier: { contacts: { type: "many", coll: "supplierContact", fk: "supplierId" } },
  comment: { author: { type: "one", coll: "user", fk: "authorId" } },
  attachment: { rfq: { type: "one", coll: "rfq", fk: "rfqId" } },
  activity: { actor: { type: "one", coll: "user", fk: "actorId" } },
};

// ---- compound unique keys ----
const COMPOUND: Record<string, string[]> = {
  organizationId_name: ["organizationId", "name"],
  organizationId_rfqNumber: ["organizationId", "rfqNumber"],
  organizationId_key: ["organizationId", "key"],
};

// ---- field defaults applied on create ----
const now = () => new Date();
const DEFAULTS: Record<string, () => Record<string, any>> = {
  organization: () => ({}),
  user: () => ({ role: "PRESALES", isActive: true }),
  partner: () => ({ services: [], preferredSupplier: false, isActive: true }),
  partnerContact: () => ({}),
  supplier: () => ({ countries: [], services: [] }),
  supplierContact: () => ({}),
  customer: () => ({}),
  service: () => ({ isActive: true }),
  rfq: () => ({
    services: [], locations: [], countries: [], status: "NEW", priority: "MEDIUM",
    pendingWith: "SALES", salesDelayMins: 0, presalesDelayMins: 0, sourcingDelayMins: 0,
    aiOfferEnabled: false, requestDate: now(),
  }),
  comment: () => ({ type: "INTERNAL" }),
  attachment: () => ({}),
  activity: () => ({}),
  delayHistory: () => ({}),
  statusHistory: () => ({}),
  emailThread: () => ({ direction: "INBOUND" }),
  aiRecommendation: () => ({ kind: "BUDGETARY_OFFER" }),
  aiPromptLog: () => ({ success: true }),
  quotation: () => ({ services: [], countries: [], locations: [], currency: "USD" }),
  delayCache: () => ({}),
  setting: () => ({}),
  notification: () => ({ isRead: false }),
  auditLog: () => ({}),
};
const HAS_UPDATED_AT = new Set([
  "organization", "user", "partner", "partnerContact", "supplier", "customer",
  "rfq", "quotation", "setting",
]);

// ---------------- query helpers ----------------

function clone<T>(v: T): T {
  return v == null ? v : (structuredClone(v) as T);
}

function expandWhere(where: any): any {
  if (!where || typeof where !== "object") return where || {};
  const out: any = {};
  for (const [k, v] of Object.entries(where)) {
    if (COMPOUND[k] && v && typeof v === "object") {
      for (const f of COMPOUND[k]) out[f] = (v as any)[f];
    } else {
      out[k] = v;
    }
  }
  return out;
}

const OP_KEYS = new Set(["contains", "mode", "has", "hasSome", "in", "notIn", "not", "gt", "gte", "lt", "lte", "equals", "startsWith"]);
function isOperator(v: any): boolean {
  return v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && Object.keys(v).some((k) => OP_KEYS.has(k));
}

function eq(a: any, b: any): boolean {
  if (b === null) return a == null;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date && (typeof b === "string" || typeof b === "number")) return a.getTime() === new Date(b).getTime();
  return a === b;
}

function cmp(a: any, b: any): number {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
}

function matchField(value: any, cond: any): boolean {
  if (cond === null) return value == null;
  if (isOperator(cond)) {
    for (const [op, target] of Object.entries(cond)) {
      switch (op) {
        case "equals": if (!eq(value, target)) return false; break;
        case "not": if (eq(value, target)) return false; break;
        case "in": if (!(Array.isArray(target) && target.some((t) => eq(value, t)))) return false; break;
        case "notIn": if (Array.isArray(target) && target.some((t) => eq(value, t))) return false; break;
        case "contains": {
          const hay = String(value ?? "");
          const needle = String(target);
          if ((cond.mode === "insensitive" ? hay.toLowerCase().includes(needle.toLowerCase()) : hay.includes(needle)) === false) return false;
          break;
        }
        case "startsWith": {
          const hay = String(value ?? "");
          if (cond.mode === "insensitive" ? !hay.toLowerCase().startsWith(String(target).toLowerCase()) : !hay.startsWith(String(target))) return false;
          break;
        }
        case "has": if (!(Array.isArray(value) && value.includes(target))) return false; break;
        case "hasSome": if (!(Array.isArray(value) && Array.isArray(target) && target.some((t) => value.includes(t)))) return false; break;
        case "gt": if (!(cmp(value, target) > 0)) return false; break;
        case "gte": if (!(cmp(value, target) >= 0)) return false; break;
        case "lt": if (!(cmp(value, target) < 0)) return false; break;
        case "lte": if (!(cmp(value, target) <= 0)) return false; break;
        case "mode": break;
        default: return false;
      }
    }
    return true;
  }
  return eq(value, cond);
}

function matchWhere(coll: string, rec: any, where: any): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND") {
      const arr = Array.isArray(cond) ? cond : [cond];
      if (!arr.every((w) => matchWhere(coll, rec, w))) return false;
      continue;
    }
    if (key === "OR") {
      const arr = (cond as any[]) || [];
      if (arr.length && !arr.some((w) => matchWhere(coll, rec, w))) return false;
      continue;
    }
    if (key === "NOT") {
      if (matchWhere(coll, rec, cond)) return false;
      continue;
    }
    // relation filter (belongsTo)
    const rel = REL[coll]?.[key];
    if (rel && rel.type === "one" && cond && typeof cond === "object" && !(cond instanceof Date)) {
      const related = getCollection(rel.coll).find((r) => r.id === rec[rel.fk]);
      if (!related || !matchWhere(rel.coll, related, cond)) return false;
      continue;
    }
    if (!matchField(rec[key], cond)) return false;
  }
  return true;
}

function orderBy(arr: any[], spec: any): any[] {
  if (!spec) return arr;
  const specs = Array.isArray(spec) ? spec : [spec];
  return [...arr].sort((a, b) => {
    for (const s of specs) {
      const [field, dir] = Object.entries(s)[0] as [string, string];
      const r = cmp(a[field], b[field]) * (dir === "desc" ? -1 : 1);
      if (r !== 0) return r;
    }
    return 0;
  });
}

function project(rec: any, select: any): any {
  if (!select) return rec;
  const out: any = {};
  for (const [k, v] of Object.entries(select)) if (v) out[k] = rec[k];
  return out;
}

function resolveIncludes(coll: string, rec: any, include: any): any {
  if (!include) return rec;
  for (const [key, cfg] of Object.entries<any>(include)) {
    if (!cfg) continue;
    const rel = REL[coll]?.[key];
    if (!rel) continue;
    const sub = typeof cfg === "object" ? cfg : {};
    if (rel.type === "many") {
      let items = getCollection(rel.coll).filter((r) => r[rel.fk] === rec.id);
      if (sub.where) items = items.filter((r) => matchWhere(rel.coll, r, sub.where));
      if (sub.orderBy) items = orderBy(items, sub.orderBy);
      if (typeof sub.take === "number") items = items.slice(0, sub.take);
      rec[key] = items.map((r) => resolveIncludes(rel.coll, clone(r), sub.include));
    } else {
      const found = getCollection(rel.coll).find((r) => r.id === rec[rel.fk]);
      rec[key] = found ? resolveIncludes(rel.coll, clone(found), sub.include) : null;
    }
  }
  return rec;
}

function output(coll: string, rec: any, args: any): any {
  let out = clone(rec);
  if (args?.include) out = resolveIncludes(coll, out, args.include);
  if (args?.select) out = project(out, args.select);
  return out;
}

function applyData(coll: string, rec: any, data: any): void {
  for (const [k, v] of Object.entries<any>(data)) {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && ("increment" in v || "decrement" in v || "set" in v)) {
      if ("increment" in v) rec[k] = (rec[k] ?? 0) + v.increment;
      else if ("decrement" in v) rec[k] = (rec[k] ?? 0) - v.decrement;
      else rec[k] = v.set;
    } else {
      rec[k] = v;
    }
  }
  if (HAS_UPDATED_AT.has(coll)) rec.updatedAt = now();
}

function buildCreate(coll: string, data: any): any {
  const rec: any = { ...(DEFAULTS[coll]?.() ?? {}) };
  for (const [k, v] of Object.entries(data)) if (v !== undefined) rec[k] = v;
  if (!rec.id) rec.id = crypto.randomUUID();
  if (!rec.createdAt && (DATE_HAS_CREATED(coll))) rec.createdAt = now();
  if (HAS_UPDATED_AT.has(coll) && !rec.updatedAt) rec.updatedAt = now();
  return rec;
}
function DATE_HAS_CREATED(coll: string): boolean {
  return coll !== "setting"; // every model has createdAt except `setting` (uses updatedAt)
}

// ---------------- model API ----------------

function modelApi(coll: string) {
  const ready = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    await ensureDatabaseReady();
    return fn();
  };

  return {
    async findUnique(args: any) {
      return ready(() => {
      const where = expandWhere(args?.where);
      const rec = getCollection(coll).find((r) => matchWhere(coll, r, where));
      return rec ? output(coll, rec, args) : null;
      });
    },
    async findFirst(args: any = {}) {
      return ready(() => {
      let arr = getCollection(coll).filter((r) => matchWhere(coll, r, expandWhere(args.where)));
      if (args.orderBy) arr = orderBy(arr, args.orderBy);
      const rec = arr[0];
      return rec ? output(coll, rec, args) : null;
      });
    },
    async findMany(args: any = {}) {
      return ready(() => {
      let arr = getCollection(coll).filter((r) => matchWhere(coll, r, expandWhere(args.where)));
      if (args.orderBy) arr = orderBy(arr, args.orderBy);
      if (typeof args.skip === "number") arr = arr.slice(args.skip);
      if (typeof args.take === "number") arr = arr.slice(0, args.take);
      return arr.map((r) => output(coll, r, args));
      });
    },
    async count(args: any = {}) {
      return ready(() =>
        getCollection(coll).filter((r) => matchWhere(coll, r, expandWhere(args.where))).length
      );
    },
    async create(args: any) {
      return ready(async () => {
      const rec = buildCreate(coll, args.data);
      getCollection(coll).push(rec);
      await scheduleWrite();
      return output(coll, rec, args);
      });
    },
    async createMany(args: any) {
      return ready(async () => {
      const rows = (args.data as any[]).map((d) => buildCreate(coll, d));
      getCollection(coll).push(...rows);
      await scheduleWrite();
      return { count: rows.length };
      });
    },
    async update(args: any) {
      return ready(async () => {
      const where = expandWhere(args.where);
      const rec = getCollection(coll).find((r) => matchWhere(coll, r, where));
      if (!rec) throw new Error(`update: ${coll} record not found`);
      applyData(coll, rec, args.data);
      await scheduleWrite();
      return output(coll, rec, args);
      });
    },
    async upsert(args: any) {
      return ready(async () => {
      const where = expandWhere(args.where);
      const rec = getCollection(coll).find((r) => matchWhere(coll, r, where));
      if (rec) {
        applyData(coll, rec, args.update);
        await scheduleWrite();
        return output(coll, rec, args);
      }
      const created = buildCreate(coll, { ...where, ...args.create });
      getCollection(coll).push(created);
      await scheduleWrite();
      return output(coll, created, args);
      });
    },
    async delete(args: any) {
      return ready(async () => {
      const where = expandWhere(args.where);
      const list = getCollection(coll);
      const idx = list.findIndex((r) => matchWhere(coll, r, where));
      if (idx === -1) throw new Error(`delete: ${coll} record not found`);
      const [removed] = list.splice(idx, 1);
      await scheduleWrite();
      return output(coll, removed, args);
      });
    },
  };
}

type Model = ReturnType<typeof modelApi>;
const handler: Record<string, Model> & { $disconnect: () => Promise<void> } = {
  $disconnect: async () => {},
} as any;

for (const coll of [
  "organization", "user", "partner", "partnerContact", "supplier", "supplierContact",
  "customer", "service", "rfq", "comment", "attachment", "activity", "delayHistory",
  "statusHistory", "emailThread", "aiRecommendation", "aiPromptLog", "quotation",
  "delayCache", "setting", "notification", "auditLog",
]) {
  (handler as any)[coll] = modelApi(coll);
}

export const prisma = handler;
export default prisma;
