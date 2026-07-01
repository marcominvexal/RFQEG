import { promises as fs } from "node:fs";
import fssync from "node:fs";
import path from "node:path";
import {
  blobEnabled,
  DB_PATH,
  readText,
  writeText,
} from "@/lib/blob-storage";

/**
 * Lightweight JSON-file database engine.
 *
 * Local dev: `database.json` on disk.
 * Vercel: persisted in Vercel Blob (`BLOB_READ_WRITE_TOKEN`).
 */

const FILE = path.resolve(process.cwd(), process.env.DB_FILE || "database.json");
const BACKUP_DIR = path.join(path.dirname(FILE), "backups");
const BACKUP_INTERVAL_MS = Number(process.env.DB_BACKUP_INTERVAL_MS || 5 * 60 * 1000);
const BACKUP_KEEP = Number(process.env.DB_BACKUP_KEEP || 20);

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
let readyPromise: Promise<void> | null = null;

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

function loadParsed(raw: string): DB {
  const parsed = JSON.parse(raw);
  const db = emptyDb();
  for (const c of COLLECTIONS) {
    db[c] = Array.isArray(parsed[c]) ? parsed[c].map((r: any) => reviveDates(c, r)) : [];
  }
  return db;
}

function loadFromFile(): DB {
  try {
    const raw = fssync.readFileSync(FILE, "utf8");
    return loadParsed(raw);
  } catch {
    return emptyDb();
  }
}

async function loadFromBlob(): Promise<DB> {
  const raw = await readText(DB_PATH);
  if (!raw) return emptyDb();
  return loadParsed(raw);
}

async function loadStorage(): Promise<void> {
  data = blobEnabled() ? await loadFromBlob() : loadFromFile();
}

/** Ensure DB is loaded before any read/write (required on Vercel). */
export async function ensureDatabaseReady(): Promise<void> {
  if (data) return;
  if (!readyPromise) readyPromise = loadStorage();
  await readyPromise;
}

/** Load the DB into memory (sync, local dev). */
export function ensureLoaded(): DB {
  if (!data) data = blobEnabled() ? emptyDb() : loadFromFile();
  return data;
}

export function getCollection(name: string): any[] {
  const db = ensureLoaded();
  if (!db[name]) db[name] = [];
  return db[name];
}

export function scheduleWrite(): Promise<void> {
  writeQueue = writeQueue.then(persist).catch((e) => {
    console.error("[jsondb] persist failed", e);
  });
  return writeQueue;
}

async function persist(): Promise<void> {
  const snapshot = JSON.stringify(data ?? emptyDb(), null, 2);
  if (blobEnabled()) {
    await writeText(DB_PATH, snapshot);
    return;
  }

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
  if (blobEnabled()) return;
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

export async function forceBackup(): Promise<void> {
  lastBackup = 0;
  await ensureDatabaseReady();
  await maybeBackup(JSON.stringify(data, null, 2));
}

export function _resetForTests(): void {
  data = null;
  lastBackup = 0;
  readyPromise = null;
  writeQueue = Promise.resolve();
}
