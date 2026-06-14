# Tick Worth Watches

Full-stack watch retail + inventory management system (supplier → warehouse → shop → customer, plus repairs).

- **Plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- **Use cases:** [docs/USE_CASES.md](docs/USE_CASES.md)

## Stack
React 18 + TypeScript + Tailwind (Vite) · Node 20 + Express + TypeScript · Prisma · JWT auth · Zod validation.

> **DB is Postgres** (Neon). The schema stores enum-like fields as validated strings
> (validation lives in the API layer via Zod, not Prisma enums). Money is integer cents
> everywhere. Set `DATABASE_URL` in `backend/.env` to your Postgres connection string.

## Repository layout
```
backend/    Express API, Prisma schema, seed script
frontend/   Vite + React + Tailwind SPA
docs/        Plan and use-case mapping
```

## Quick start

### 1. Backend
```bash
cd backend
npm install
# Set DATABASE_URL (Postgres) and JWT_SECRET in .env — see .env.example. PORT defaults to 5001.
npx prisma db push            # create/sync the Postgres schema
npm run db:seed               # 4 demo accounts + catalog + starting stock
npm run dev                   # http://localhost:5001  (GET /health)
```

### 2. Frontend
```bash
cd frontend
npm install
# .env is already set: VITE_API_URL=http://localhost:5001/api
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173, then use the demo-account buttons on the login page to sign in.
Customers land on the catalog; staff land on the manager dashboard.

## Roles & access
- **Customers** use the public storefront — sign in / register at `/login` and `/register`.
- **Staff** use a separate **staff portal** at **`/staff/login`** (linked discreetly in the
  storefront footer). There is no staff self-registration: the **Owner provisions staff**
  from the dashboard's User Management tab and can deactivate accounts (a deactivated account
  can't log in). Each staff role gets its own dashboard:
  - **Shopkeeper** — order admin + dispatch, customer requests, **restock asks to the warehouse**
    (request all low/out-of-stock items at once, or specific ones), shop stock, shop↔repair
    transfers, damage/repairs, courier roster, and an **order-status report** (each order's
    record: ordered → confirmed → dispatched → delivered, plus cancellations) to send to the owner.
  - **Warehouse Manager** — full inventory, **a restock-requests queue** (approve & send the
    shop's asks, choosing how many units — or decline), receive stock (purchase-in), all
    transfers, damage/repairs. No order access.
  - **Owner** — everything, plus the monthly revenue report, a **Received Reports archive**
    (open/download the detailed reports staff send), and User Management.

## Order fulfilment & delivery
- Every order gets a human-readable number (e.g. `TW-000001`).
- At checkout the customer picks a **delivery option** — Standard (free), Express (+fee), or
  Collect in store. The fee is applied **server-side** (never trusted from the client) and
  added to the order total.
- Orders flow **PENDING → PAID → DISPATCHED → DELIVERED**. Dispatching a delivery order
  **requires assigning an active courier** (a pickup does not); the assigned courier's name
  and phone then appear on the order for both staff and the customer.
- Couriers are managed (add / deactivate) by the shopkeeper or owner under the **Couriers** tab.

## Stock availability, pre-booking & requests
- The cart **can't exceed the shop quantity** — add-to-cart and the quantity steppers cap at
  what's actually on the shop floor (the backend's guarded decrement is the final safety net).
- When a watch is **out of stock in the shop**, the customer sees one of two actions, decided
  **server-side** from warehouse availability:
  - **Pre-book** — the warehouse has it, so it can be pulled to the shop. The shopkeeper/owner
    fulfils the pre-booking (which moves a unit warehouse → shop and notifies the customer it's
    now available to buy).
  - **Request** — the warehouse is empty too, so there's no promise of arrival; the customer
    just registers interest. Staff can fulfil it after a future restock, or decline it.
- Staff see the demand queue under the dashboard **Requests** tab; customers track theirs on the
  order-history page. The supply chain is: **owner/warehouse receive stock → warehouse → shop**,
  and the shopkeeper can see warehouse availability in the **Stock** tab to know what can be pulled.
- The seed leaves two watches out of stock to demo this: *Seamaster 300* (warehouse-stocked →
  pre-book) and *Khaki Field* (out everywhere → request only).

## Demo accounts
All seeded accounts use password **`password123`**:

| Role | Email | Sign in at |
|---|---|---|
| Customer | `customer@tickworth.test` | `/login` |
| Shopkeeper | `shop@tickworth.test` | `/staff/login` |
| Warehouse Manager | `warehouse@tickworth.test` | `/staff/login` |
| Owner | `owner@tickworth.test` | `/staff/login` |

## Features (UC1–UC9, all implemented)

- **Customer** — browse/search/filter catalog, cart with qty editing, checkout (address +
  payment), receipt modal, order history with self-service cancel (restores stock).
- **Staff dashboard** — live stock-by-location grid with low-stock alerts; stock transfers
  (warehouse↔shop↔repair); damage reports + repair lifecycle; order admin (confirm payment →
  dispatch → deliver, plus cancel); notification bell.
- **Owner** — monthly revenue report (KPIs, daily-revenue bars, top products) over
  PAID/DISPATCHED/DELIVERED orders; plus a **Received Reports archive**: shopkeeper and
  warehouse staff send detailed, **frozen-snapshot** reports (each covers everything since
  their last send), and the owner browses, opens, and **downloads** them (printable HTML).
  Shop reports list each item sold (when + to whom); warehouse reports cover stock received /
  sent to shop / restock asks / sent-for-repair / repaired / scrapped + the per-period ledger.

Every stock change (sale, transfer, damage, repair-complete, cancel/return) runs in a Prisma
transaction with a guarded decrement (no overselling) and writes a `StockMovement` ledger row.
See `backend/src/services/order.service.ts` for the reference pattern.

See [docs/USE_CASES.md](docs/USE_CASES.md) for the full UC → screen/endpoint mapping.

## Tests

```bash
cd backend
# Tests need a SEPARATE Postgres DB (e.g. a Neon branch) — set TEST_DATABASE_URL (see .env.example).
npm run test                          # Vitest: stock/transfer/cancel/damage logic
npm run dev                           # in one terminal, then in another:
powershell -File scripts/smoke-test.ps1   # 38 API assertions across all 9 UCs incl. RBAC 403s
```
