# Getting Started — Running & Testing the RFQ Portal

This is a single Next.js full-stack app with a **file-based JSON database** — there is
**no database server to install**. All data lives in one `database.json` file with
atomic writes and automatic backups. Your `.env` already has the Gemini key and the
Gmail (IMAP) credentials.

You only need **Node.js 20+**.

---

## 1. Install Node.js (one time)
Download the LTS installer from https://nodejs.org and install it. Verify:
```powershell
node -v   # v20.x or v22.x
npm -v
```

## 2. Install dependencies
```powershell
cd "C:\Users\waqia\Claude\Projects\RFQ EG"
npm install
```

## 3. Seed the database (creates database.json with sample data)
```powershell
npm run db:seed
```
The seed prints the two logins at the end. (Use `npm run db:reset` to wipe and reseed.)

## 4. Run it
```powershell
npm run dev
```
Open **http://localhost:3000**.

That's it — no Docker, no Postgres, no migrations.

---

## Logins (created by the seed)
| Portal | Email | Password |
|--------|-------|----------|
| Sales (Admin) | `sales@invexal.com` | `sales123` |
| Presales / Sourcing | `presales@invexal.com` | `presales123` |

The login screen has quick-fill buttons for both.

---

## Where your data lives
- `database.json` — the entire database (one JSON file at the project root).
- `backups/` — timestamped snapshots, written automatically (throttled to one every
  5 minutes, newest 20 kept). Tune with `DB_BACKUP_INTERVAL_MS` / `DB_BACKUP_KEEP` in `.env`.
- Writes are atomic (temp file + rename), so a crash mid-save can't corrupt the file.
- To start fresh: delete `database.json` (or run `npm run db:reset`).
- To back up manually: just copy `database.json` somewhere safe.

> Attachments are stored separately as real files under `storage/` (configurable via
> `STORAGE_DIR`).

---

## What to click to test each feature
1. **Dashboard** — KPI cards, partner leaderboard, delay charts, AI usage (Sales).
2. **RFQs table** — sort, filter, search, column chooser, select rows → bulk set
   Pending/Status, and Excel/CSV export. Click a row to open the ticket.
3. **Ticket slide-over**
   - Change **Pending With** → the Sales/Presales/Sourcing delay counters shift.
   - **Comments / Supplier** tabs — post notes.
   - **Attachments** tab — upload a PDF, preview it, "Download all" as ZIP.
   - **Email** tab — "AI Summary" of the thread, and (Sales) reply from inside the app.
4. **Ask AI for a Budgetary Offer** — dormant until 24h before the deadline OR until
   "Enable now" (Sales). Seeded RFQ-2026-0002 (due in 1 day) is already active.
5. **Update From Email** (Sales) — email "Solution Request" to marcominvexal@gmail.com,
   leave it unread, click the button → it imports as a new RFQ.
6. **Partners / Suppliers** (Sales) — add records that feed the AI engine.
7. **Settings** (Sales) — config, AI on/off, dropdown lists, AI prompt log.

## Common issues
- **`JWT_SECRET not configured`** → make sure `.env` exists and you ran `npm run dev`
  from the project folder.
- **Gmail import returns 0** → the mailbox needs an *unread* message containing
  "Solution Request". Read messages are skipped by design.
- **Port 3000 in use** → `npm run dev -- -p 3001`.
- **AI buttons error** → check `GEMINI_API_KEY` in `.env`; the app degrades gracefully
  if it's missing.

## Security reminder
Rotate the Gemini key and Gmail app password after testing — they were shared in chat
and should be treated as exposed. Replace the values in `.env`.
