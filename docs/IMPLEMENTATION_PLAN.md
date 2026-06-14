# Tick Worth Watches — Implementation Plan (Solo / Course Edition)

> **Context:** University course deliverable, built solo over a few weeks.
> **Goal:** Demonstrate all 9 use cases (UC1–UC9) working end-to-end with clean docs.
> **Priority:** A working, gradeable product — *not* production infrastructure.
>
> Stack stays as planned: **React 18 + TypeScript + Tailwind** (frontend),
> **Node 20 + Express + TypeScript** (backend), **PostgreSQL + Prisma** (data).

---

## A. Right-sizing — what to CUT from v1

These add no grading value and will eat your weeks. Drop them now.

| Drop | Why |
|---|---|
| Sentry, Logtail, Uptime Robot | Production monitoring. Use `console` / `pino` to stdout. |
| Redis / caching | You will never have the traffic. Another service to run. |
| "Prisma **or** Drizzle" choice | Pick **Prisma**. No time to evaluate ORMs. |
| Cypress **and** Playwright | No browser E2E. Test stock/money logic with Vitest instead. |
| Full GitHub Actions CD (staging → prod approval) | Solo project. One manual deploy is fine. (Optional: a single lint+test CI check.) |
| Repository layer (`repositories/`) | With Prisma, Prisma *is* the repo. Collapse to **controller → service → Prisma**. |
| Supabase Storage / S3 | Product images = placeholder URLs in the DB. |

**Keep:** TypeScript, Zod validation, JWT auth, Tailwind, a clean **service layer**, a **seed script**, and **one** live deploy. That is plenty to look professional.

---

## B. The Data Model (the heart of the app)

Two key decisions:
1. **One `Stock` row per (product, location)** — not separate warehouse/shop/repair tables. Makes transfers trivial and adding a location free.
2. **A `StockMovement` ledger** — every sale, transfer, and damage writes an immutable row. This is what makes "all transactions logged" true and the monthly report trustworthy.

```prisma
// prisma/schema.prisma

generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role         { CUSTOMER  SHOPKEEPER  WAREHOUSE_MANAGER  OWNER }
enum Location     { WAREHOUSE  SHOP  REPAIR }
enum OrderChannel { ONLINE  STORE }
enum OrderStatus  { PENDING  PAID  DISPATCHED  DELIVERED  CANCELLED }
enum MovementType { PURCHASE_IN  TRANSFER  SALE  RETURN  DAMAGE  REPAIR_DONE }
enum RepairStatus { REPORTED  IN_REPAIR  REPAIRED  SCRAPPED }

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role     @default(CUSTOMER)
  orders       Order[]
  createdAt    DateTime @default(now())
}

model Product {
  id          String   @id @default(cuid())
  name        String
  brand       String
  category    String
  description String?
  priceCents  Int                       // money as integer minor units — NEVER Float
  imageUrl    String?
  stock       Stock[]
  createdAt   DateTime @default(now())

  @@index([brand])
  @@index([category])
}

model Stock {                            // one row per product per location
  id           String   @id @default(cuid())
  product      Product  @relation(fields: [productId], references: [id])
  productId    String
  location     Location
  quantity     Int      @default(0)
  reorderLevel Int      @default(5)      // drives low-stock alerts

  @@unique([productId, location])
}

model StockMovement {                    // immutable audit ledger
  id           String       @id @default(cuid())
  productId    String
  type         MovementType
  fromLocation Location?
  toLocation   Location?
  quantity     Int
  referenceId  String?                   // orderId / damageReportId
  performedBy  String                    // userId
  createdAt    DateTime     @default(now())

  @@index([createdAt])
  @@index([productId])
}

model Order {
  id               String       @id @default(cuid())
  customer         User         @relation(fields: [customerId], references: [id])
  customerId       String
  channel          OrderChannel
  status           OrderStatus  @default(PENDING)
  totalCents       Int
  paymentMethod    String                 // "COD" | "ONLINE"
  paymentConfirmed Boolean      @default(false)
  shippingAddress  String?
  items            OrderItem[]
  createdAt        DateTime     @default(now())

  @@index([createdAt])
  @@index([status])
}

model OrderItem {
  id             String  @id @default(cuid())
  order          Order   @relation(fields: [orderId], references: [id])
  orderId        String
  productId      String
  quantity       Int
  unitPriceCents Int                       // price snapshot at purchase time
}

model DamageReport {                       // repair lifecycle lives here
  id          String       @id @default(cuid())
  productId   String
  quantity    Int
  description String
  status      RepairStatus @default(REPORTED)
  reportedBy  String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Notification {                       // low-stock alerts + "report sent to owner"
  id        String   @id @default(cuid())
  userId    String
  type      String
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

---

## C. Business rules (decide these BEFORE coding)

These are exactly what a grader will probe.

### Stock changes are always atomic
Every sale, transfer, and damage runs inside `prisma.$transaction(...)`. Decrement with a **guarded update** so two buyers can't oversell the last watch:

```ts
// Returns count = 0 if not enough stock — prevents overselling under concurrency.
const res = await tx.stock.updateMany({
  where: { productId, location: 'SHOP', quantity: { gte: qty } },
  data:  { quantity: { decrement: qty } },
});
if (res.count === 0) throw new ConflictError('Insufficient stock');
```

### Order / stock lifecycle
- **Online order** → decrement `SHOP` now, status `PENDING` → (`paymentConfirmed`) `PAID` → manager sets `DISPATCHED` → `DELIVERED`.
- **Store order** → decrement `SHOP`, created straight as `PAID` / `DELIVERED`.
- **Cancel** (allowed only before `DISPATCHED`) → restore stock, write a `RETURN` movement.

### Transfers
`POST /api/transfers { productId, from, to, qty }` → decrement `from`, increment `to`, write one `TRANSFER` movement — **all in one transaction**. Covers warehouse→shop, shop→repair, repair→shop.

### Damage / repair
- Report decrements the source location, creates a `DamageReport` (`REPORTED`) + a `DAMAGE` movement.
- Status: `REPORTED → IN_REPAIR → REPAIRED` (then transfer repair→shop) or `→ SCRAPPED`.

### Monthly revenue report
Count orders where `status IN (PAID, DISPATCHED, DELIVERED)` within the month. Aggregate revenue + top products from `OrderItem`.

### RBAC
Single `role` enum, **not** a boolean. `role.middleware.ts` takes a list of allowed roles:
- Reports → `OWNER`
- Warehouse transfers → `WAREHOUSE_MANAGER`, `OWNER`
- Orders / shop stock → `SHOPKEEPER`, `WAREHOUSE_MANAGER`, `OWNER`
- Customers → only their own orders

---

## D. Sprint plan — vertical slices, ~3 weeks solo

**Key idea:** build thin end-to-end slices, not "all backend then all frontend." Something is demoable from day 3, and integration pain is spread out.

### Day 1–2 — Setup + walking skeleton
- Monorepo: `/backend`, `/frontend`.
- Prisma schema (Section B), `npx prisma migrate dev --name init`.
- **Seed script**: products + one user of each role + starting stock.
- Express app with `/health`; React app that fetches and renders it.
- **Deploy this now** so deployment isn't a week-3 surprise.

### Day 3–5 — Slice 1: Auth + catalog  *(UC: browse, login)*
- Register / login / JWT, `auth.middleware`, `role.middleware`.
- `GET /products` with brand/category filter + search.
- Product list UI, login UI, protected routing. ✅ First real demo.

### Day 6–9 — Slice 2: Cart → order → receipt  *(UC: cart, place order, history)*
- Client-side cart (React Context).
- `POST /orders` (atomic stock decrement, creates `Order` + `OrderItem` + `SALE` movement).
- Receipt modal, `GET /orders/my`.
- **Core flow — give it the most time.**

### Day 10–13 — Slice 3: Manager inventory  *(UC: view stock, transfer, damage/repair)*
- Dashboard: stock levels + low-stock alerts (`quantity <= reorderLevel`).
- Transfer panel (warehouse→shop, shop→repair, repair→shop).
- Damage-report form + repair status updates.

### Day 14–16 — Slice 4: Orders admin + monthly report  *(UC: manage orders, report to owner)*
- `GET /orders/all`, `PATCH /orders/:id/status`.
- `GET /reports/monthly` with a Recharts chart.
- "Send to owner" = create a `Notification`.

### Day 17–19 — Polish + tests + docs
- Toasts, responsive pass.
- **Focused tests** on `order.service` and stock/transfer logic only (Vitest).
- README with screenshots + demo credentials.
- Final deploy + `docs/USE_CASES.md` (UC1–UC9 → screen mapping).

> **If you run short on time:** Slices 1–3 (browse → buy → manage stock) are a coherent, gradeable product. Cut report polish before cutting the core flow.

---

## E. API endpoints

All return JSON. Auth via `Authorization: Bearer <token>`.

| Method | Endpoint | Description | Role |
|---|---|---|---|
| POST  | `/api/auth/register`      | Register customer/manager   | public |
| POST  | `/api/auth/login`         | Login, get JWT              | public |
| GET   | `/api/products`           | List products (filters)     | public |
| GET   | `/api/products/:id`       | Product details             | public |
| POST  | `/api/products`           | Create product              | manager+ |
| POST  | `/api/orders`             | Place order (atomic stock)  | customer |
| GET   | `/api/orders/my`          | Customer order history      | customer |
| GET   | `/api/orders/all`         | View all orders             | manager+ |
| PATCH | `/api/orders/:id/status`  | Update order status         | manager+ |
| POST  | `/api/orders/:id/cancel`  | Cancel + restore stock      | manager+ |
| POST  | `/api/transfers`          | Stock transfer              | manager+ |
| GET   | `/api/inventory?location=`| Stock by location           | manager+ |
| GET   | `/api/inventory/low-stock`| Items at/below reorderLevel | manager+ |
| POST  | `/api/damage-reports`     | Create damage report        | manager+ |
| GET   | `/api/damage-reports`     | List repairs                | manager+ |
| PATCH | `/api/damage-reports/:id` | Update repair status        | manager+ |
| GET   | `/api/reports/monthly`    | Monthly sales report        | owner |
| POST  | `/api/reports/send-owner` | Notify owner                | manager+ |
| GET   | `/api/notifications`      | My notifications            | any auth |

---

## F. Project structure (simplified — no repository layer)

```
backend/
├── src/
│   ├── controllers/   (auth, product, order, inventory, transfer, repair, report)
│   ├── services/      (auth, order, inventory, report)   ← business logic + Prisma
│   ├── middleware/    (auth, role, error)
│   ├── routes/
│   ├── utils/         (logger, validators [Zod])
│   ├── prisma.ts      (shared PrismaClient)
│   └── app.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/             (order.service, transfer logic — Vitest)
├── .env.example
└── package.json

frontend/
├── src/
│   ├── components/    (common, products, cart, checkout, orders, dashboard, auth)
│   ├── pages/         (Home, Products, Cart, OrderHistory, Dashboard)
│   ├── contexts/      (AuthContext, CartContext)
│   ├── services/      (api [axios], product, order, inventory, auth)
│   ├── types/
│   ├── App.tsx  main.tsx  index.css
├── .env.example       (VITE_API_URL)
└── package.json
```

---

## G. Deployment (one deploy each, manual)

- **DB:** Neon (Postgres free tier) — use the pooled connection string.
- **Backend:** Render or Railway. Env: `DATABASE_URL`, `JWT_SECRET`.
- **Frontend:** Vercel. Env: `VITE_API_URL`.
- Document exact local-run + deploy steps in README. Graders reward "live URL + how to run locally."

---

## H. Testing (focused, not aspirational)

| Test | Tool | Cover |
|---|---|---|
| Unit | Vitest | `order.service` (oversell guard, totals), transfer logic, report aggregation |
| Integration | Supertest | auth, place order, transfer (against a test DB) |

Skip browser E2E. The money + stock logic is where bugs hide and where tests pay off.

---

## I. Demo / Definition of Done

- `docs/USE_CASES.md`: table mapping **UC1–UC9 → screen/endpoint** that satisfies each.
- **4 seeded demo accounts:** customer, shopkeeper, warehouse_manager, owner (document the passwords).
- RBAC enforced (customer cannot reach manager pages).
- Stock updates correctly after sales, transfers, cancellations.
- Monthly report reflects PAID/DISPATCHED/DELIVERED orders.
- One live URL.

---

## J. Quick start

```bash
# Backend
cd backend
npm install
cp .env.example .env          # set DATABASE_URL, JWT_SECRET
npx prisma migrate dev --name init
npx prisma db seed
npm run dev

# Frontend
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:5000/api
npm run dev
```

---

### Net change from the original plan
Added the **data model + stock rules** (the actual hard part), **dropped ~40% of the infrastructure**, and **reordered sprints into vertical slices** so you always have something working to demo.
