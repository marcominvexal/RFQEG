# RFQ Portal — Enterprise Telecom RFQ Management (Internal)

A production-minded, internal-use portal for managing telecom RFQs end‑to‑end:
Gmail import → Gemini extraction → assignment → SLA/delay tracking → AI budgetary
offer → dashboard & reporting.

Built as a **single deployable Next.js full‑stack app** (App Router API routes act
as the backend). This is the pragmatic "minimal, internal" shape of the original
multi-service spec — same technologies, fewer moving parts to run. The code is
layered (routes → service layer → Prisma) so it can later be split into a separate
Express API and multiple frontends without rewriting business logic.

## Stack

| Layer | Tech |
|------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind, shadcn-style UI, Framer Motion, Recharts, TanStack Table/Query, Zustand, React Hook Form |
| Backend | Next.js Route Handlers (REST), service layer, repository via Prisma |
| Auth | JWT (httpOnly cookie, `jose`), bcrypt, role-based (SALES / PRESALES) |
| DB | File-based JSON store (`database.json`) — atomic writes + automatic backups, no server required |
| AI | Google Gemini (`@google/generative-ai`) |
| Email | Gmail API (OAuth2, `googleapis`) |

## Two portals (only two)

| Login | Role | Capabilities |
|-------|------|--------------|
| **Sales (Admin)** | `SALES` | Full access: import from Gmail, create RFQs, edit every field, assign, set Expected Proposal Date, change Status/Pending With, configure dropdowns, dashboard/analytics/reports |
| **Presales / Sourcing** | `PRESALES` | Same login for Presales *and* Sourcing. Can edit only: Pending With, Reason for Delay, Internal Comments, Supplier Comments, attachments, supplier response, and move the ticket between Presales / Sourcing / Sales. Everything else read‑only. |

Field-level authorization is enforced server-side in `src/lib/rfq-service.ts`
(`PRESALES_EDITABLE_FIELDS`). Deadline is **never** editable (derived = Expected
Proposal Date − 1 day).

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env       # fill JWT_SECRET, GEMINI_API_KEY, IMAP_*/GMAIL_*

# 3. Seed the JSON database (creates database.json)
npm run db:seed            # org, 2 users, partners, suppliers, services, sample RFQs
                           # (npm run db:reset wipes + reseeds)

# 4. Run
npm run dev                # http://localhost:3000
```

> No database server. All data lives in `database.json` (atomic writes, automatic
> timestamped backups in `backups/`). See `GETTING_STARTED.md`.

### Seeded logins
```
Sales (Admin)        sales@invexal.com    / sales123
Presales / Sourcing  presales@invexal.com / presales123
```
> Change these immediately for any real deployment.

## Environment variables

See `.env.example`. Key secrets (never commit `.env`):
`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `GEMINI_API_KEY`,
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.

### Email import — two providers
Set `EMAIL_PROVIDER` to choose how "Update From Email" reads mail:
- `imap` (simplest, internal use): set `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, and a
  Gmail **App Password** in `IMAP_PASSWORD`. No Google Cloud project required.
- `oauth` (Gmail API): set the `GMAIL_*` values and complete the consent flow below.

If `EMAIL_PROVIDER` is unset it auto-detects based on which credentials are present.
Either way the rule is identical: unread messages containing "Solution Request"
(subject or body) become RFQs and are marked read after a successful import.

### Getting a Gmail refresh token (one-time, OAuth mode only)
1. In Google Cloud Console create an OAuth Client (Web), add redirect
   `http://localhost:3000/api/gmail/callback`.
2. Put client id/secret in `.env`, start the app, sign in as Sales.
3. `GET /api/gmail/auth-url` returns a consent URL → open it → approve.
4. The callback page prints a **refresh token** → paste into `GMAIL_REFRESH_TOKEN`, restart.

## Core feature map

- **Update From Email** (manual only, Sales) — `POST /api/update-from-email`.
  Searches **unread** Gmail for `"Solution Request"` (subject *or* body), creates
  one RFQ per email, extracts fields via Gemini, links the thread, then marks the
  message **read** so it is never re-imported. Request Date = import date.
- **Gemini extraction** — `src/lib/gemini.ts › extractRfqFromEmail`. Returns JSON
  only, `null` for unknown fields, instructed never to hallucinate.
- **Delay engine** — `src/lib/delay-engine.ts`. Three counters (Sales / Presales /
  Sourcing). Each `Pending With` change closes the open `DelayHistory` segment,
  adds effective business‑minutes to the matching counter, and opens a new one.
  Business days exclude Sat/Sun **and Pakistani public holidays** via Gemini
  (`calculateDelay`), results cached in `delay_cache`. Deterministic weekend-only
  fallback when Gemini is unavailable.
- **AI Budgetary Offer** — `POST /api/rfqs/:id/ai-offer`. Button is dormant until
  within `AI_OFFER_ACTIVATION_HOURS` (default 24) of the deadline **or** a Sales
  user enables it. Assembles full context (thread, comments, supplier responses,
  timeline, attachments text, similar historical RFQs, historical quotations,
  partner/supplier directories) and returns a structured recommendation rendered
  in the **AI Budgetary Recommendation** panel (never overwrites user data).
- **Dashboard** — `GET /api/dashboard`: KPI cards + 6 charts (Recharts).
- **Table** — TanStack Table with filters, global search, column sort, pinned RFQ #
  column, pagination, and **Export to Excel**.
- **Timeline** — every action auto-logged to `activities`; immutable.

## V2 additions

- **AI Budgetary Offer (flagship)** — deeper "Senior Global Telecom Presales
  Engineer" prompt with step-by-step reasoning; grounded in the knowledge base;
  suggested contacts restricted to the internal partner/supplier directory; results
  shown in a collapsible, read-only panel that never overwrites user data. Every call
  is logged with latency + token usage.
- **Historical learning** (`lib/knowledge-base.ts`) — when an RFQ is marked WON/LOST it
  is snapshotted into `quotations`; the AI searches this base (by service / geography /
  customer) *before* generating.
- **Supplier database & Partner management** — full CRUD modules (`/suppliers`,
  `/partners`) with the fields the AI consumes (coverage, lead time, reliability, contacts…).
- **Delay UI** — live, color-coded SLA counters (75% warn, breach at SLA, red once the
  deadline passes); list & ticket auto-refresh.
- **Dashboard** — added Near-Deadline, Avg Proposal Time, per-stage averages, Partner
  Leaderboard, and AI usage stats.
- **RFQ table** — sticky header, pinned first columns, column chooser, row selection
  with bulk status/assignment/priority, plus Excel **and** CSV export.
- **Settings** — company config, AI activation window, AI enable toggle, dropdown
  managers, and an AI prompt-log viewer.
- **AI prompt logging** — `ai_prompt_logs` now records user, RFQ, latency, tokens and
  success; surfaced at `/api/ai-logs` and in Settings.
- **Email thread (reply + AI summary)** — the Email tab shows the full inbound/outbound
  conversation, a one-click **AI Summary** of the thread, and a **Reply** composer
  (Sales). Replies send over SMTP in IMAP mode or the Gmail API in OAuth mode and are
  stored back on the thread (`email_threads.direction`).
- **Attachments** — real upload to object storage (`lib/storage.ts`, local-disk adapter,
  S3-swappable) supporting PDF/DOCX/XLSX/MSG/ZIP/TXT/images up to 25 MB. PDFs/images
  preview inline, every file downloads, and **Download all** returns a ZIP. PDF/TXT text
  is extracted on upload to enrich AI context.

> After pulling V2, re-run `npm install` (adds `imapflow`, `mailparser`, `nodemailer`,
> `archiver`, `pdf-parse`) and `npm run db:reset` to reseed. Attachments are stored
> under `STORAGE_DIR` (default `./storage`).

### Data layer
The database is a single `database.json` file managed by a small Prisma-compatible
facade (`src/lib/prisma.ts`) over a JSON engine (`src/lib/jsondb.ts`): atomic
temp-file + rename writes, a serialized write queue, and throttled rotating backups in
`backups/`. Call sites use the familiar `prisma.<model>.findMany/create/update/...`
API, so the data layer can be swapped for a real database later without touching routes.
`prisma/schema.prisma` is retained as a human-readable description of the data model.

## Project structure

```
prisma/                 schema.prisma · seed.ts
src/
  app/
    (app)/              authenticated shell: dashboard, rfqs, settings
    api/                REST route handlers (auth, rfqs, update-from-email, ai-offer, dashboard, settings, gmail)
    login/              login page
  components/           ui/ (button, card, badge, sheet, tabs, …) + shared widgets
  features/
    dashboard/          charts
    rfq/                table, slide-over sheet, AI panel, new-rfq, update-from-email
  hooks/                React Query hooks
  lib/                  prisma, auth, gemini, gmail, delay-engine, business-days, rfq-service, export, utils
  store/                Zustand UI store
  types/                shared TypeScript types
```

## Security

Role-based authorization on every mutating route; httpOnly JWT cookie; bcrypt
password hashing; Zod input validation; append-only `audit_logs` for updates;
DB reached only through the backend (route handlers) — credentials never exposed
to the browser; all secrets via env. Add HTTPS + a rate limiter (e.g. middleware
or a reverse proxy) before public exposure.

## Multi-tenancy

Every domain row carries `organizationId`; all queries are org-scoped. A single
org is seeded today; adding more orgs requires no schema change.

## Scripts

```
npm run dev             start dev server
npm run build           prisma generate + next build
npm run start           start production server
npm run typecheck       tsc --noEmit
npm run lint            next lint
npm run db:seed         seed database
npm run prisma:migrate  create/apply dev migration
npm run test            run unit tests (delay/business-day logic)
```

## Notes / next steps

- Attachment upload UI is stubbed; the schema + `storageKey` are ready to wire to
  S3/MinIO object storage.
- AI summary / follow-up / duplicate-detection helpers exist in `gemini.ts` and can
  be surfaced in the UI as needed.
- To split into separate services later: lift `src/lib/*` and `src/app/api/*` into a
  standalone Express app — the service layer already isolates business logic.
```
