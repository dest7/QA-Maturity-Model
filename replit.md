# QA Maturity Dashboard

A company-wide QA maturity tracking tool: teams are assessed across 15 skills in 4 categories, rated 0–3, with evidence artifacts, assessment status, and company metrics.

## Run & Operate

| Command | Purpose |
|---|---|
| `pnpm --filter @workspace/api-server run dev` | Start API server (port 8080) |
| `pnpm --filter @workspace/qa-maturity run dev` | Start frontend Vite dev server |
| `pnpm --filter @workspace/db run db:generate` | Generate Drizzle migration after schema change |
| `pnpm --filter @workspace/db run db:push` | Push schema to DB (dev) |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate React Query hooks from OpenAPI spec |

Required env var: `DATABASE_URL` (auto-provided by Replit PostgreSQL).

## Stack

- **Monorepo**: pnpm workspaces, TypeScript 5.9, Node 24
- **Frontend**: React + Vite, Tailwind CSS, Shadcn/ui, Framer Motion, Wouter, TanStack Query
- **Backend**: Express 5, Drizzle ORM + PostgreSQL, Zod validation
- **Auth**: express-session + connect-pg-simple (cookie sessions), bcryptjs password hashing
- **API codegen**: Orval (from `lib/api-spec/openapi.yaml`)

## Where Things Live

```
artifacts/
  api-server/src/
    app.ts            — Express app, CORS, session middleware
    routes/           — health, auth, users, metrics, teams, skills, artifacts
    lib/auth.ts       — requireAuth/requireAdmin middleware + permission helpers
    lib/seed.ts       — Initial data + 5 test users
  qa-maturity/src/
    contexts/AuthContext.tsx  — Auth state, login/logout, permission helpers
    pages/LoginPage.tsx       — Login form with test user quick-select
    pages/MetricsPage.tsx     — Company-wide heatmap + rankings (manager/admin)
    components/AppLayout.tsx  — Sidebar + routing, uses canManageTeams/canViewMetrics
    components/UserMenu.tsx   — User info + logout in sidebar footer
lib/db/src/schema/
  skills.ts          — teams, skills, skill levels, artifacts tables
  users.ts           — users table (role, assignedTeamIds)
```

## Architecture Decisions

- **Session-based auth** over JWT: simpler for admin-only management UI; no token refresh complexity
- **Permission helpers in AuthContext** (frontend) + `lib/auth.ts` (backend): permission logic defined in both layers — frontend for UI visibility, backend for actual enforcement
- **Orval-generated hooks** include `credentials: "include"` (patched in `custom-fetch.ts`) so cookies are sent automatically
- **Migration tracking**: `db:push` applies schema changes directly; migration hashes manually inserted into `drizzle.__drizzle_migrations` to keep `runMigrations()` idempotent
- **Seed is idempotent**: skills/teams check once, users seeded separately so they're added even to existing DBs

## Product

5 roles with granular permissions:
- **viewer** — read-only
- **contributor** — read + add artifacts on assigned teams only
- **reviewer** — read + edit skill levels + artifacts + assessment status (all teams)
- **manager** — reviewer permissions on assigned teams + company metrics page
- **admin** — full access including team/user management

Test accounts (password = first name):
`edward@company.com` (admin), `anna@company.com` (viewer), `boris@company.com` (contributor, Teams Alpha+Beta), `clara@company.com` (reviewer), `igor@company.com` (manager, Teams Alpha+Beta)

## Gotchas

- After adding a new DB table: run `db:generate`, `db:push`, then insert the migration hash into `drizzle.__drizzle_migrations` manually so `runMigrations()` doesn't fail on restart
- `connect-pg-simple` creates `session` table automatically (`createTableIfMissing: true`)
- TypeScript `tsc --noEmit` shows errors for `@workspace/api-client-react` imports — pre-existing, Vite (esbuild) handles them fine at runtime
