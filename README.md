# Mini Operations ERP

A small full-stack Operations ERP covering: Inventory → Work Order → Stock Check →
Internal Transfer / Shortage → Customer Reservation.

## Tech stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Frontend**: React, TypeScript, Vite (no UI framework — plain CSS)
- **Auth**: JWT (jsonwebtoken + bcryptjs), role middleware on every protected route
- **Testing**: Jest + Supertest, run against a real Postgres database
- **API docs**: OpenAPI 3 spec (`docs/openapi.yaml`), served via Swagger UI at
  `/docs` when the backend is running

## Project layout

```
backend/    Express API, Prisma schema + migrations, Jest tests
frontend/   React + Vite SPA
docs/       OpenAPI spec, database schema / ER diagram
docker-compose.yml   Postgres for local development
```

## Prerequisites

- Node.js 20+
- Docker (for the bundled Postgres), or your own PostgreSQL 14+ instance

## Database setup

The repo ships a `docker-compose.yml` that runs Postgres on **host port 5436**
(not 5432, to avoid clashing with other local Postgres instances) so it doesn't
require any manual setup:

```bash
docker compose up -d
```

If you'd rather use your own Postgres instance, just create a database and point
`DATABASE_URL` at it (see Environment variables below).

## Environment variables

Copy the example env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**backend/.env**

| Variable         | Description                                   | Example                                                        |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`   | Postgres connection string                    | `postgresql://erp:erp@localhost:5436/mini_op_erp?schema=public` |
| `JWT_SECRET`     | Secret used to sign JWTs                      | any long random string                                          |
| `JWT_EXPIRES_IN` | Token lifetime                                | `8h`                                                             |
| `PORT`           | API port                                      | `4010`                                                           |

**frontend/.env**

| Variable            | Description                                                          | Example |
| ------------------- | ---------------------------------------------------------------------- | ------- |
| `VITE_API_BASE_URL` | Base path/URL the SPA calls. `/api` works with the dev proxy below.  | `/api`  |

Nothing here is hardcoded to a specific hosting provider — swap `DATABASE_URL` for
any Postgres instance (RDS, Supabase, Neon, a self-hosted box, ...) and the app
setup is identical.

## How to run

**1. Install dependencies**

```bash
cd backend && npm install
cd ../frontend && npm install
```

**2. Start Postgres**

```bash
docker compose up -d
```

**3. Run migrations and seed data**

```bash
cd backend
npx prisma migrate deploy
npm run prisma:seed
```

Seeded accounts (password for all: `password123`):

| Role       | Email             |
| ---------- | ----------------- |
| Admin      | admin@erp.test    |
| Operations | ops@erp.test      |
| Sales      | sales@erp.test    |

**4. Run the backend**

```bash
cd backend
npm run dev
```

API listens on `http://localhost:4010`. Swagger UI is at `http://localhost:4010/docs`.

**5. Run the frontend**

```bash
cd frontend
npm run dev
```

SPA runs on `http://localhost:5174` and proxies `/api/*` to the backend
(configured in `frontend/vite.config.ts`).

## How to test

Tests run against a real Postgres database (the same `DATABASE_URL` as dev, or
point it at a separate database — either works, since every test factory generates
unique identifiers and doesn't depend on a clean table):

```bash
cd backend
npm test
```

This runs the full Jest + Supertest suite, including the mandatory tests:

1. Cannot reserve more than available inventory
2. Cannot transfer more than available inventory
3. Destination stock increases only after transfer receipt (not on dispatch)
4. Same transfer cannot be received twice
5. Unauthorized role cannot perform a restricted operation

...plus additional coverage: concurrent reservation requests, concurrent receive
requests, inventory adjustment constraints, duplicate-transaction idempotency, and
work order shortage calculation.

## Concurrency & correctness

The case study's core requirement — "two users must not be able to reserve more
stock than actually exists" — is solved with a **single atomic conditional UPDATE**,
not a read-then-write check:

```sql
UPDATE "InventoryRecord"
SET "reservedQuantity" = "reservedQuantity" + $quantity
WHERE id = $id
  AND "physicalQuantity" - "reservedQuantity" >= $quantity
RETURNING *;
```

Postgres takes a row lock to evaluate and apply this statement. A second concurrent
transaction targeting the same row blocks until the first commits, then re-evaluates
the `WHERE` clause against the now-updated row — so it correctly fails if the stock
is gone. This works under Postgres's default `READ COMMITTED` isolation; no
`SELECT ... FOR UPDATE` or `SERIALIZABLE` isolation is needed, because there's no
separate application-level read before the write.

The same pattern is used for:

- **Inventory adjustments** (`adjustInventory`) — guards against a negative result
- **Transfer dispatch** — guards against dispatching more than available
- **Transfer status transitions** (`REQUESTED → DISPATCHED → RECEIVED`) — the status
  flip itself is the atomic condition (`WHERE status = 'REQUESTED'`, etc.), which is
  what makes double-dispatch and double-receive impossible even under concurrent
  requests, not just sequential ones
- **Order cancellation** — releasing a reservation is guarded the same way, so a
  double-cancel can't release the same stock twice

See `backend/src/__tests__/reservation.test.ts` and
`backend/src/__tests__/transfers.test.ts` for tests that fire concurrent requests at
the same row and assert only the correct one succeeds.

As a second line of defense (not the primary mechanism), the migration also adds
`CHECK` constraints at the database level: `physicalQuantity >= 0`,
`reservedQuantity >= 0`, `reservedQuantity <= physicalQuantity`. Prisma's schema
language has no native `@@check` attribute, so these are hand-added to the generated
migration SQL — see `docs/database-schema.md`.

## Judgment calls

A few points in the spec were ambiguous. Documenting the decisions here so they're
easy to revisit:

1. **Reservation targets a specific inventory record (item + location + batch), not
   an item in the abstract.** The spec's inventory model is per item/location/batch,
   but the customer-order examples only mention "Item A". Auto-allocating a
   reservation across multiple batches (FIFO splitting) adds real complexity for
   little payoff at this scale, so the Sales User picks the exact batch to reserve
   against from the inventory list. Available-quantity math and the concurrency
   guarantee are identical either way.

2. **A Work Order does not automatically create a Transfer.** The spec says the
   system "should calculate the shortage automatically," which is implemented, but
   doesn't say a transfer must be created automatically. Given a shortage, an
   Operations User manually requests the internal transfer. Full automation would
   need to pick a source location, which isn't specified.

3. **Work Order status transitions are strictly forward** (`ASSIGNED → IN_PROGRESS →
   COMPLETED`, no skipping, no going backward), and can be advanced by an Admin or
   by the specific Operations User the work order is assigned to (not just any
   Operations User). This wasn't explicit in the spec but keeps ownership clear.

4. **Order cancellation was implemented even though it's not in the mandatory spec**,
   because it's named as an example "Live Verification" change. It releases the
   reservation using the same atomic-guard pattern as everything else, so it was
   cheap to add now rather than as a live, unannounced change later.

5. **"Available inventory" for a transfer dispatch is `physical - reserved`**, the
   same definition used everywhere else — so stock already reserved for a customer
   order at that location can't be shipped out from under the reservation. The spec
   only says "prevent transfer more than available inventory," which this reading
   satisfies literally (Test 2 in the mandatory tests uses this exact wording).

6. **Idempotency keys for inventory-affecting operations are client-supplied**
   (`idempotencyKey` field) rather than derived server-side from a content hash. This
   is simpler and puts the retry-detection responsibility where it usually lives in
   real systems (the client generates a UUID once per user action and resends it on
   retry).

## Roles & permissions

| Action                          | Admin | Operations | Sales |
| -------------------------------- | :---: | :--------: | :---: |
| View inventory / work orders / transfers / orders | ✅ | ✅ | ✅ |
| Create / adjust inventory        | ✅    | ✅         |       |
| Create Work Order                | ✅    |            |       |
| Advance Work Order status        | ✅    | ✅ (if assigned) |  |
| Create / dispatch / receive Transfer | ✅ | ✅       |       |
| Create / cancel Customer Order   | ✅    |            | ✅    |

Every restriction above is enforced server-side (`requireRole` middleware on each
route) — the frontend hides controls the current user can't use, but that's a UX
convenience, not the security boundary.

## Screens

1. **Login**
2. **Inventory** — list with computed available quantity; create records and apply
   adjustments (Admin/Operations)
3. **Work Orders** — create (Admin), view shortage, advance status
4. **Internal Transfers** — request, dispatch, receive
5. **Customer Orders** — create + reserve stock, cancel + release reservation

## Known limitations

- No password reset / user self-registration flow — users are seeded directly.
- Reservation targets a single inventory record rather than auto-splitting across
  batches (see Judgment call #1).
- The frontend was verified against the running backend via the dev proxy and via
  `npm run build`, but was not visually exercised in a browser in this environment
  (no browser tooling available here) — do a manual click-through before relying on
  it for a demo.
