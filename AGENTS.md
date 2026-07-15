# AGENTS.md

## Cursor Cloud specific instructions

RFQ Portal is a single **Next.js 15 (App Router) full-stack app** — the API route
handlers are the backend, and data lives in a **file-based JSON database**
(`database.json` at the repo root, managed via a Prisma-compatible facade). There is
**no database server** to run: no Postgres, Docker, or migrations are required for
local development. Requires Node.js 20+ (VM uses v22).

Standard commands are already documented in `README.md` and `package.json` scripts
(`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:seed`, `db:reset`). Use
those as the source of truth. Notes below are the non-obvious bits.

### Environment
- The app reads a `.env` file (see `.env.example`). It is **gitignored**, so it is not
  in the repo — it is created during environment setup and persists in the VM snapshot.
  If `.env` is missing, recreate it: `cp .env.example .env` then set a real
  `JWT_SECRET` (e.g. `openssl rand -base64 48`) and `ENCRYPTION_KEY`
  (`openssl rand -hex 32`). Without a valid `JWT_SECRET`, login/auth routes fail.
- `GEMINI_API_KEY` (AI features) and `IMAP_*`/`GMAIL_*` (email import) are **optional**.
  They are unset by default; the app degrades gracefully — AI offer/summary and "Update
  From Email" will error/no-op, but core RFQ CRUD, dashboard, tables, and reports work.

### Data / seeding
- `database.json` is gitignored and lives at the repo root; it also persists in the VM
  snapshot. If it is missing or you want fresh data, run `npm run db:seed`
  (`npm run db:reset` wipes and reseeds). Seeding is idempotent (upserts) and prints the
  two seeded logins.
- Seeded logins: Sales admin `sales@invexal.com` / `sales123`; Presales/Sourcing
  `presales@invexal.com` / `presales123`. The login page has quick-fill buttons.

### Running / testing
- Dev server: `npm run dev` → http://localhost:3000 (port 3000). Hot reload works.
- Tests (`npm run test`) only cover business-day/delay logic (`vitest`, `*.test.ts`);
  there is no broader automated suite. For end-to-end verification, drive the UI (log in,
  create an RFQ, view the dashboard).
- `npm run lint` uses the deprecated `next lint` — that deprecation notice is expected and
  not an error.
