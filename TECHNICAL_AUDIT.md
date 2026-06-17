# Tick Worth — Technical Audit

> A complete technical audit of the Tick Worth watch retail + inventory platform.
> Status at time of writing: **pre-launch MVP** (not yet deployed). Payments are
> **cash-on-delivery** (a Stripe integration was evaluated and removed — Stripe is not
> available in Pakistan). Images are hosted on **Cloudinary**; prices are in **PKR**.

---

## 1. Project Overview

### Purpose
A full-stack system for a Pakistan-based luxury-watch business that combines a **public
e-commerce storefront** with an **internal operations platform**. It models the real supply
chain: supplier → warehouse → shop → customer, plus a repair loop. Customers browse and buy;
staff run catalogue, stock, orders, repairs and reporting from role-specific dashboards.

### Main features
- **Storefront:** brand/catalogue browsing, search, product detail with per-colour variants,
  cart, checkout (cash-on-delivery or "online (mock)"), order history, printable receipts.
- **Reviews:** customers can rate/review a product, gated to verified purchases (a *delivered*
  order containing that product); ratings aggregate onto product cards.
- **Demand capture:** out-of-stock "request"/"pre-book" flow when shop stock is empty.
- **Inventory ops:** stock tracked per location (WAREHOUSE / SHOP / REPAIR), guarded
  transactional stock moves, a full `StockMovement` ledger, purchase-in (receive stock),
  warehouse→shop transfers, damage/repair lifecycle, internal restock requests.
- **Orders ops:** order lifecycle (PENDING → PAID → DISPATCHED → DELIVERED, plus CANCELLED with
  stock restoration), courier assignment at dispatch.
- **Reporting:** owner live monthly revenue + order-status views; staff send periodic
  shop/warehouse reports that are frozen as snapshots into an owner archive (viewable +
  printable).
- **Admin:** catalogue management with Cloudinary image upload + a colour-variant manager;
  user/staff provisioning; notifications.

### User roles
| Role | Capabilities |
|------|--------------|
| **CUSTOMER** | Browse, buy, review (verified purchase), raise stock requests, manage own orders. Self-registers. |
| **SHOPKEEPER** | Order administration, catalogue, couriers, restock requests, reports (shop). |
| **WAREHOUSE_MANAGER** | Stock receiving, transfers out of warehouse, restock fulfilment, damage/repair, reports (warehouse). |
| **OWNER** | Everything, plus revenue reports, the report archive, and staff/user management. |

Role groupings in middleware: `requireStaff` = SHOPKEEPER | WAREHOUSE_MANAGER | OWNER;
`requireOrderAdmin` = SHOPKEEPER | OWNER; `requireWarehouse` = WAREHOUSE_MANAGER | OWNER.

---

## 2. Technology Stack

| Layer | Choice |
|-------|--------|
| **Frontend framework** | React 18 + TypeScript, built with **Vite**; styled with **Tailwind CSS**; routing via **react-router-dom v6**; HTTP via **axios**. |
| **Backend framework** | **Node + Express 4** in TypeScript (routes → controllers → services). |
| **Database** | **PostgreSQL** (hosted on **Neon**), accessed via **Prisma 5** ORM. |
| **Authentication** | **JWT** (`jsonwebtoken`, 7-day expiry) signed with `JWT_SECRET`; passwords hashed with **bcryptjs**. Stateless (no server sessions). |
| **State management** | React **Context** (`AuthContext`, `CartContext`, `ToastContext`) + component-local `useState`. No Redux/Zustand. |
| **Validation** | **Zod** schemas (`backend/src/utils/validators.ts`), parsed in controllers. |
| **Image storage** | **Cloudinary** — browser compresses the image, the API uploads it (server-side credentials) and stores the returned URL on the product/colour. |
| **Deployment targets** | Not yet deployed. Intended: frontend static build → Vercel/Netlify; backend → Render/Railway/Fly; DB already on Neon. No Dockerfile or CI yet. |

---

## 3. Folder Structure

```
tick.worth SRE/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # Postgres schema (14 models)
│   │   ├── seed.ts                  # demo accounts + catalogue + starting stock
│   │   ├── import-watches.mjs       # builds catalogue/variant JSON from the Watches/ images
│   │   └── watches.generated.json   # generated seed catalogue
│   ├── scripts/smoke-test.ps1       # quick API smoke test
│   ├── tests/                       # globalSetup.ts + order.service.test.ts (Vitest)
│   └── src/
│       ├── app.ts                   # Express app: CORS, JSON, route mounting, error handler
│       ├── prisma.ts                # Prisma client singleton
│       ├── cloudinary.ts            # Cloudinary client (configured from env)
│       ├── controllers/             # HTTP layer — parse (Zod) + call services (15 files)
│       ├── services/                # business logic + Prisma access (15 files)
│       ├── routes/                  # Express routers, one per resource (13 files)
│       ├── middleware/              # auth.middleware, role.middleware, error.middleware
│       └── utils/                   # validators (Zod), errors, asyncHandler, logger
├── frontend/
│   ├── public/watches/…             # static colourway images used by the seed catalogue
│   └── src/
│       ├── main.tsx, App.tsx, index.css, vite-env.d.ts
│       ├── pages/                   # storefront pages (10) + pages/dashboards/ (3 role shells)
│       ├── components/              # shared UI (13) + components/dashboard/ (17 admin panels)
│       ├── contexts/                # AuthContext, CartContext, ToastContext
│       ├── services/                # axios API wrappers, one per resource (14)
│       ├── utils/                   # format, imageUpload, report/receipt builders, brands…
│       └── types/index.ts           # shared TS types (frontend⇄backend contract)
├── docs/                            # IMPLEMENTATION_PLAN.md, USE_CASES.md
├── Watches/                         # source watch images (organised by brand/model)
├── README.md                        # quick-start
└── TECHNICAL_AUDIT.md               # this document
```

**Major folders:** `backend/src/{routes,controllers,services}` form a clean three-layer API;
`middleware` enforces auth/role; `utils/validators.ts` centralises all input schemas.
`frontend/src/{pages,components,services}` mirror the resources; `components/dashboard` holds
the role-specific admin panels. `prisma/` owns the schema + seed.

---

## 4. Database Design

PostgreSQL via Prisma. Enum-like fields are stored as **String** and validated at the API layer
with Zod (kept out of the DB to stay portable). **Money is integer minor units (paisa)** — never
floats.

### Tables / models (14)
| Model | Key fields | Notes / relationships |
|-------|-----------|------------------------|
| **User** | id, name, email *(unique)*, passwordHash, role, active, createdBy?, createdAt | `orders Order[]`. role ∈ CUSTOMER/SHOPKEEPER/WAREHOUSE_MANAGER/OWNER. |
| **Product** | id, name, brand, category, description?, priceCents, imageUrl?, images[] *(legacy)*, createdAt | `stock Stock[]`, `variants ProductVariant[]`. Indexed on brand, category. |
| **ProductVariant** | id, productId, color, imageUrl, position | → Product (**onDelete: Cascade**). Indexed on productId. The store's colour layer. |
| **Stock** | id, productId, location, quantity, reorderLevel | → Product. `@@unique([productId, location])`. Locations: WAREHOUSE/SHOP/REPAIR. |
| **StockMovement** | id, productId, type, fromLocation?, toLocation?, quantity, referenceId?, performedBy, createdAt | Append-only ledger. type ∈ PURCHASE_IN/TRANSFER/SALE/RETURN/DAMAGE/REPAIR_DONE. Indexed createdAt, productId. |
| **Order** | id, orderNumber *(unique)*, customerId, channel, status, deliveryMethod, deliveryFeeCents, courierId?, totalCents, paymentMethod, paymentConfirmed, shippingAddress?, cancelledBy?, cancelReason?, createdAt | → User, → Courier?, `items OrderItem[]`. Indexed createdAt, status. |
| **OrderItem** | id, orderId, productId, quantity, unitPriceCents, color? | → Order. Price snapshot at purchase time. |
| **Courier** | id, name, phone, email?, active, createdAt | `orders Order[]`. |
| **DamageReport** | id, productId, quantity, description, status, reportedBy, createdAt, updatedAt | status ∈ REPORTED/IN_REPAIR/REPAIRED/SCRAPPED. |
| **Notification** | id, userId, type, message, read, createdAt | Per-user in-app notifications. |
| **StockRequest** | id, productId, customerId, quantity, type, status, note?, createdAt, updatedAt | Customer demand. type REQUEST/PREBOOK; status OPEN/FULFILLED/DECLINED/CANCELLED. |
| **RestockRequest** | id, productId, quantity, status, note?, requestedBy, resolvedBy?, movedQty?, createdAt, updatedAt | Internal shop→warehouse supply ask. |
| **Report** | id, kind, senderId, senderName, senderRole, title, periodStart, periodEnd, data *(Json snapshot)*, createdAt | Frozen report archive. Indexed createdAt, senderId. |
| **Review** | id, productId, customerId, rating, comment?, createdAt, updatedAt | `@@unique([productId, customerId])` (one review per customer/product, upserted). Indexed productId. No FK relation — names attached via lookup. |

### Relationships (summary)
- User **1—N** Order; Order **1—N** OrderItem; Courier **1—N** Order.
- Product **1—N** Stock, **1—N** ProductVariant (cascade delete), referenced by OrderItem,
  StockMovement, DamageReport, StockRequest, RestockRequest, Review (by id; some without FK).

---

## 5. API Documentation

Base path `/api`. JSON in/out. Auth via `Authorization: Bearer <jwt>`. Validation errors → 400
(Zod), auth → 401, role → 403, missing → 404, conflicts (e.g. concurrent stock) → 409.

| Method & path | Auth | Purpose |
|---------------|------|---------|
| `GET /health` | public | Liveness check. |
| **Auth** | | |
| `POST /api/auth/register` | public | Register (always CUSTOMER) → `{ token, user }`. |
| `POST /api/auth/login` | public | Login → `{ token, user }`. |
| `GET /api/auth/me` | any auth | Current user. |
| **Products & reviews** | | |
| `GET /api/products` | public | List (filters: brand, category, search) + rating aggregate. |
| `GET /api/products/:id` | public | Product detail incl. stock, variants, rating. |
| `GET /api/products/:id/reviews` | public | Rating summary + reviews. |
| `GET /api/products/:id/reviews/me` | CUSTOMER | Whether/what the user reviewed. |
| `POST /api/products/:id/reviews` | CUSTOMER | Create/update review (verified-purchase gate). |
| `POST /api/products` | staff | Create product. |
| `PATCH /api/products/:id` | staff | Edit product. |
| `PUT /api/products/:id/variants` | staff | Replace colour variants (array order = position). |
| **Uploads** | | |
| `POST /api/uploads/image` | staff | Upload an image to Cloudinary → `{ url }`. |
| **Orders** | | |
| `POST /api/orders` | CUSTOMER | Place order (transactional stock decrement). |
| `GET /api/orders/my` | CUSTOMER | My orders. |
| `GET /api/orders/all` | orderAdmin | All orders. |
| `PATCH /api/orders/:id/status` | orderAdmin | Advance status (+ courier at dispatch). |
| `POST /api/orders/:id/cancel` | any auth* | Cancel (own order, or staff) → restores stock. |
| **Inventory / transfers / damage** | | |
| `GET /api/inventory` · `GET /api/inventory/low-stock` | staff | Stock views. |
| `POST /api/inventory/receive` | warehouse | Purchase-in to warehouse. |
| `POST /api/transfers` | staff | Move stock between locations. |
| `POST /GET /PATCH /api/damage-reports` | staff | Create / list / update repair status. |
| **Requests** | | |
| `POST /GET(my) /POST(:id/cancel) /api/stock-requests` | CUSTOMER | Customer demand requests. |
| `GET /PATCH /api/stock-requests` | orderAdmin | List / resolve requests. |
| `POST /POST(:id/cancel) /api/restock-requests` | orderAdmin | Raise / cancel restock ask. |
| `GET /api/restock-requests` | staff | List. `PATCH /:id` | warehouse | Fulfil/decline. |
| **Reports** | | |
| `GET /api/reports/monthly` | OWNER | Revenue report. |
| `GET /api/reports/order-status` | orderAdmin | Order-status report. |
| `GET /api/reports/preview` · `POST /send-owner` · `GET /mine` | staff | Preview / send / own history. |
| `GET /api/reports/sent` · `GET /sent/:id` · `DELETE /sent/:id` | OWNER | Archive list / detail / delete. |
| **Couriers / users / notifications** | | |
| `GET /POST /PATCH(:id) /api/couriers` | orderAdmin | Courier management. |
| `GET /POST /PATCH(:id) /api/users` | OWNER | Staff provisioning. |
| `GET /api/notifications` · `PATCH /:id/read` | any auth | In-app notifications. |

\* `cancel` authorises inside the service: a customer may cancel only their own order; among
staff, only SHOPKEEPER/OWNER.

**Typical response shapes:** auth → `{ token, user:{id,name,email,role} }`; product → product +
`stock[]`, `variants[]`, `ratingAverage`, `ratingCount`; order → order + `items[]` + `courier`.

---

## 6. Authentication & Authorization

**Login flow:** `POST /auth/login` → user looked up by email → `bcrypt.compare` against
`passwordHash` → deactivated accounts rejected → JWT signed with `{id, role, email}` (7-day
expiry) → returned to client.

**Session management:** **stateless JWT**. The frontend stores the token in `localStorage` and an
axios request interceptor attaches `Authorization: Bearer <token>` to every call. The backend
`authMiddleware` verifies the token and populates `req.user`. No server-side session store; logout
is a client-side token discard.

**Role-based access control:** `role.middleware.ts` exposes `requireRole(...roles)` plus the
convenience guards `requireStaff`, `requireOrderAdmin`, `requireWarehouse`. Routes compose
`authMiddleware` + a role guard; a few finer-grained checks (e.g. "cancel only your own order")
live in the service layer.

---

## 7. Admin Dashboard Features

- **Product management** (`CatalogPanel`): add/edit products (name, brand, category, description,
  **price in PKR**, primary image). Live storefront preview.
- **Colour management** (in `CatalogPanel`, when editing): add/edit/remove colour variants, each
  with its own Cloudinary-hosted image; array order sets display position. Drives the colour
  picker on the product detail page.
- **Inventory management:** stock overview per location, low-stock view, receive stock
  (warehouse), warehouse→shop transfers, damage/repair lifecycle, restock-request fulfilment.
- **Order management:** order list, status advancement (PAID → DISPATCHED with courier →
  DELIVERED), cancellation with stock restoration; live monthly revenue + order-status reports;
  staff report sending + owner archive.
- **Image upload flow:** staff pick/drag/paste an image → browser **compresses** it (downscale to
  ≤1280px, re-encode JPEG ~0.82) → `POST /api/uploads/image` → backend uploads to Cloudinary
  (`tickworth/products` folder) with server-side credentials → returns `secure_url` → stored as
  the product's / variant's `imageUrl` (a lightweight URL, **not** base64 in the DB).

---

## 8. Infrastructure & Deployment

- **Hosting provider:** not yet chosen/deployed. Recommended: frontend static → Vercel/Netlify;
  backend → Render/Railway/Fly; Postgres already on **Neon**.
- **Environment variables:**
  - Backend: `DATABASE_URL`, `TEST_DATABASE_URL` (tests), `JWT_SECRET`, `PORT` (5001),
    `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
  - Frontend: `VITE_API_URL` (the deployed API base; falls back to localhost in dev).
- **Storage providers:** **Neon** (Postgres), **Cloudinary** (images).
- **Third-party services:** Neon, Cloudinary. (No payment gateway — cash-on-delivery only.)

---

## 9. Security Measures

| Area | Status |
|------|--------|
| **Input validation** | ✅ Strong — Zod schemas on all write endpoints; server recomputes prices/fees (never trusts the client). |
| **Password hashing** | ✅ bcryptjs (cost 10). Hashes never returned to clients. |
| **SQL injection** | ✅ Prisma parameterises all queries. |
| **Rate limiting** | ❌ **None** — `/auth/login` and `/register` are open to brute-force/spam. |
| **CSRF** | ➖ Largely N/A — auth uses a `Bearer` header from `localStorage`, not cookies, so classic CSRF doesn't apply. (Trade-off: localStorage tokens are exposed to XSS.) |
| **XSS** | ✅ Mostly — React escapes output by default; the printable report HTML escapes dynamic values via an `esc()` helper. |
| **Security headers** | ❌ No `helmet` / CSP / HSTS. |
| **CORS** | ⚠️ Wide open (`cors()` allows all origins) — must be locked to the frontend domain. |
| **Secrets** | ⚠️ `JWT_SECRET` must be a long random value in prod (tokens encode role — a weak secret = full account takeover). |

---

## 10. Performance Optimizations

- **Caching:** ❌ none (no Redis / HTTP caching layer). Acceptable at launch scale.
- **Image optimization:** ✅ browser-side compression before upload + Cloudinary (which can also
  do on-the-fly transforms/`f_auto`/`q_auto` if you add them to the URLs).
- **Lazy loading:** ✅ variant thumbnails use `loading="lazy"`. ❌ no route-level code-splitting
  (`React.lazy`) — the SPA ships as one bundle.
- **Database indexing:** ✅ reasonable — `@@index` on hot columns (Order.createdAt/status,
  StockMovement.createdAt/productId, Report.createdAt/senderId, Product.brand/category,
  Review.productId, etc.) and `@unique` constraints (User.email, Order.orderNumber,
  Stock[productId,location], Review[productId,customerId]). Product listing attaches ratings via a
  single grouped aggregate (avoids N+1).

---

## 11. Monitoring & Logging

- **Error tracking:** ❌ none (no Sentry/equivalent).
- **Logging:** ➖ a lightweight `utils/logger.ts` (startup/info logging); a centralised
  `error.middleware` maps thrown errors to HTTP responses. No structured/request logging.
- **Health checks:** ✅ `GET /health` returns status + timestamp (suitable for platform probes).

---

## 12. Current Known Problems

**Technical debt**
- No rate limiting; CORS open; no security headers (see §9).
- Order numbers are generated from a row count (`TW-000001`) — the code itself flags a race under
  truly concurrent checkout; the `@unique` constraint is the safety net. Fine at low volume.
- Test coverage is thin (one Vitest file, `order.service`).
- A legacy `Product.images[]` field is superseded by `ProductVariant` but still present.
- Several accessibility lint warnings on dashboard form inputs (labels not programmatically
  associated).
- Demo/seed accounts and catalogue still present (to be removed before launch).
- Brand imagery (Rolex/AP/Hublot, etc.) may carry trademark exposure for commercial use.

**Bugs**
- A prior code-review pass fixed a batch (report period scoping, "items sold" counting
  cancelled/pending orders, a year-filter request storm, stale cart quantity, optimistic review
  state, etc.). No known critical bugs outstanding; remaining items are minor/cosmetic.

**Incomplete / intentionally deferred**
- **Payments:** cash-on-delivery only (online card payment is mock; Stripe was removed as it's
  unavailable in Pakistan). No alternative gateway integrated yet.
- **No password-reset / forgot-password flow** — a real gap for public customers.
- **No transactional email** (order confirmations, etc.).
- Colour manager is available only when **editing** a product (colours attach to a saved product).
- `EXPRESS` delivery fee is a placeholder (Rs 500) pending the real rate.

---

## 13. Architecture & Data Flows

```
                         ┌──────────────────────────────────────────────┐
   Browser (React SPA)   │  pages/components → contexts (Auth/Cart/Toast) │
   localStorage: JWT     │  services/*.ts (axios; interceptor adds Bearer)│
                         └───────────────┬───────────────────────────────┘
                                         │ HTTPS  (Authorization: Bearer <jwt>)
                                         ▼
                         ┌──────────────────────────────────────────────┐
   Express API (Node)    │  app.ts → CORS → JSON                         │
                         │  authMiddleware → role guard                  │
                         │  controller (Zod parse) → service (logic)     │
                         │  Prisma client                                │
                         └───────┬───────────────────────────┬──────────┘
                                 │                            │
                                 ▼                            ▼
                       PostgreSQL (Neon)            Cloudinary (images)
```

**Key flows**
1. **Auth:** login → bcrypt verify → JWT (role-bearing) → client stores in localStorage →
   interceptor attaches it → `authMiddleware` verifies on each request → `req.user`.
2. **Checkout (COD):** cart → `POST /orders` → service runs a **Prisma transaction**: snapshot
   prices, create order, **guarded** SHOP-stock decrement (`updateMany … quantity ≥ qty`; 0 rows ⇒
   rollback), write a `SALE` `StockMovement`, low-stock notify. Online orders start PENDING;
   in-store start DELIVERED.
3. **Order lifecycle:** orderAdmin advances PENDING→PAID→DISPATCHED(+courier)→DELIVERED;
   `cancel` (before dispatch) restores stock via `RETURN` movements in a transaction.
4. **Image upload:** browser compress → `POST /uploads/image` (staff) → Cloudinary → URL saved on
   product/variant.
5. **Reviews:** `POST /products/:id/reviews` → service verifies a *delivered* order for that
   product → upsert (one per customer/product) → ratings re-aggregate on listing.
6. **Reports:** staff `preview`/`send` → service builds a per-period snapshot (shop or warehouse,
   gap-free per kind) → frozen as a `Report` row → owner archive list/detail/print; owner also has
   live monthly revenue + order-status views.

---

## 14. Production Readiness Assessment

### ✅ Complete
- Core commerce (browse → cart → COD checkout → order lifecycle) and full internal ops (stock,
  transfers, damage/repair, requests, reporting).
- Auth + RBAC, strong server-side validation, transactional/guarded stock logic.
- Image hosting on Cloudinary; PKR pricing; colour-variant management; health check.

### ❌ Missing (close before public launch)
- **Security hardening:** strong `JWT_SECRET` discipline, **CORS allow-list**, **rate limiting**,
  `helmet` headers.
- **Password reset** + transactional email.
- **Ops:** hosting/deploy config (no Dockerfile/CI), error monitoring (Sentry), structured logs.
- **Data/legal:** real catalogue + remove demo accounts; confirm brand-image licensing.
- **Tests:** broaden beyond the single order test.

### ⚠️ Overengineered / could simplify
- **Dual reporting** (live monthly views *and* a persisted snapshot archive) is feature-rich for a
  single shop — fine if the owner wants both, but it's the heaviest subsystem.
- The product **`images[]` legacy field** is dead alongside `ProductVariant` — remove it.
- Some **duplicated helpers** (date formatting, product-name maps, status tallies) were partly
  consolidated in a recent cleanup; finishing that consolidation would trim code.
- Storefront ships as a single bundle — add route-level code-splitting if/when it grows.

### Verdict
**Code quality is solid and above typical MVP level**; the architecture is clean and the data
model is sound. It is **not yet safe to point the public at** as-is — but it is roughly a focused
**half-day of security hardening + deploy setup** away from a controlled launch (one shop, limited
traffic, cash-on-delivery). Finish the §9/§12 must-fixes, load real data, deploy, and it's
launchable.
