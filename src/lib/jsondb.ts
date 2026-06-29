import { promises as fs } from "node:fs";
import fssync from "node:fs";
import path from "node:path";

/**
 * Lightweight JSON-file database engine.
 *
 *  - Single `database.json` holds every collection as an array.
 *  - Loaded once into memory; all reads are in-memory.
 *  - Writes are ATOMIC: serialize → write `*.tmp` → fsync → rename over the
 *    target (rename is atomic on the same volume), so a crash mid-write can
 *    never corrupt the live file.
 *  - Writes are SERIALIZED through a promise queue (Node is single-threaded, so
 *    in-memory mutations between awaits are atomic; the queue prevents
 *    overlapping file writes).
 *  - AUTOMATIC BACKUPS: a timestamped copy is written to `backups/` (throttled),
 *    pruned to the newest N.
 *
 * Configure via env: DB_FILE, DB_BACKUP_INTERVAL_MS, DB_BACKUP_KEEP.
 */

const FILE = path.resolve(process.cwd(), process.env.DB_FILE || "database.json");
const BACKUP_DIR = path.join(path.dirname(FILE), "backups");
const BACKUP_INTERVAL_MS = Number(process.env.DB_BACKUP_INTERVAL_MS || 5 * 60 * 1000);
const BACKUP_KEEP = Number(process.env.DB_BACKUP_KEEP || 20);

// Date-typed fields per collection — revived to Date objects on load.
const DATE_FIELDS: Record<string, string[]> = {
  organization: ["createdAt", "updatedAt", "deletedAt"],
  user: ["createdAt", "updatedAt", "deletedAt"],
  partner: ["createdAt", "updatedAt", "deletedAt"],
  partnerContact: ["createdAt", "updatedAt"],
  supplier: ["createdAt", "updatedAt", "deletedAt"],
  supplierContact: ["createdAt"],
  customer: ["createdAt", "updatedAt", "deletedAt"],
  service: ["createdAt"],
  rfq: ["requestDate", "expectedProposalDate", "deadline", "createdAt", "updatedAt", "deletedAt"],
  comment: ["createdAt", "deletedAt"],
  attachment: ["createdAt", "deletedAt"],
  activity: ["createdAt"],
  delayHistory: ["startedAt", "endedAt"],
  statusHistory: ["createdAt"],
  emailThread: ["internalDate", "createdAt"],
  aiRecommendation: ["createdAt"],
  aiPromptLog: ["createdAt"],
  quotation: ["createdAt", "updatedAt"],
  delayCache: ["createdAt"],
  setting: ["updatedAt"],
  notification: ["createdAt"],
  auditLog: ["createdAt"],
};

export const COLLECTIONS = Object.keys(DATE_FIELDS);
export const DATE_FIELD_MAP = DATE_FIELDS;

type DB = Record<string, any[]>;

let data: DB | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let lastBackup = 0;

function emptyDb(): DB {
  const d: DB = {};
  for (const c of COLLECTIONS) d[c] = [];
  return d;
}

function reviveDates(coll: string, rec: any): any {
  for (const f of DATE_FIELDS[coll] || []) {
    if (rec[f] != null && typeof rec[f] === "string") rec[f] = new Date(rec[f]);
  }
  return rec;
}

/** Load the DB into memory (sync, once). */
export function ensureLoaded(): DB {
  if (data) return data;
  try {
    const raw = fssync.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw);
    const db = emptyDb();
    for (const c of COLLECTIONS) {
      db[c] = Array.isArray(parsed[c]) ? parsed[c].map((r: any) => reviveDates(c, r)) : [];
    }
    data = db;
  } catch {
    data = emptyDb();
  }
  return data;
}

export function getCollection(name: string): any[] {
  const db = ensureLoaded();
  if (!db[name]) db[name] = [];
  return db[name];
}

/** Queue an atomic persist; resolves once this write has hit disk. */
export function scheduleWrite(): Promise<void> {
  writeQueue = writeQueue.then(persist).catch((e) => {
    console.error("[jsondb] persist failed", e);
  });
  return writeQueue;
}

async function persist(): Promise<void> {
  const snapshot = JSON.stringify(data ?? emptyDb(), null, 2);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp-${process.pid}`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(snapshot, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, FILE);
  await maybeBackup(snapshot);
}

async function maybeBackup(snapshot: string): Promise<void> {
  const now = Date.now();
  if (now - lastBackup < BACKUP_INTERVAL_MS) return;
  lastBackup = now;
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(path.join(BACKUP_DIR, `database-${stamp}.json`), snapshot, "utf8");
    const files = (await fs.readdir(BACKUP_DIR))
      .filter((f) => f.startsWith("database-") && f.endsWith(".json"))
      .sort();
    while (files.length > BACKUP_KEEP) {
      const f = files.shift()!;
      await fs.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
    }
  } catch (e) {
    console.error("[jsondb] backup failed", e);
  }
}

/** Force a backup now (used by maintenance scripts). */
export async function forceBackup(): Promise<void> {
  lastBackup = 0;
  ensureLoaded();
  await maybeBackup(JSON.stringify(data, null, 2));
}

/** Test helper: reset in-memory state. */
export function _resetForTests(): void {
  data = null;
  lastBackup = 0;
  writeQueue = Promise.resolve();
}
