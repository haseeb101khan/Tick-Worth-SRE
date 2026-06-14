# Use Case → Implementation Mapping (UC1–UC9)

Fill the **Screen / Endpoint** and **Status** columns as you build each slice. This table
is the checklist a grader uses to confirm the system is complete — keep it up to date.

| UC | Use case | Actor | Screen / Endpoint | Status |
|----|----------|-------|-------------------|--------|
| UC1 | Browse & search catalog | Customer | `GET /products` · `ProductsPage` (search + brand/category filters) | ✅ done |
| UC2 | Register / login | Customer, Staff | Customers self-register/sign in (`/login`, `/register`); staff sign in at the separate **staff portal** (`/staff/login`). Owner provisions staff via `POST /users`. | ✅ done |
| UC3 | Add to cart & checkout | Customer | `CartContext` (**caps quantity at shop stock**) · `POST /orders` · `CartPage` (**delivery option** + address/payment) → `ReceiptModal` (order #, fee breakdown) | ✅ done |
| UC3b | Pre-book / request out-of-stock watch | Customer | `POST /stock-requests` · `OutOfStockActions` (pre-book if warehouse-stocked, else request); `GET /stock-requests/my` · `MyRequestsPanel`; staff resolve via Dashboard › Requests (`StockRequestsPanel`, `GET/PATCH /stock-requests`) | ✅ done |
| UC4 | View order history & receipt | Customer | `GET /orders/my`, `POST /orders/:id/cancel` · `OrderHistoryPage` (order #, delivery method, **assigned courier contact**, cancel restores stock) | ✅ done |
| UC5 | View inventory & low-stock alerts | Staff | `GET /inventory`, `/inventory/low-stock`; receive supplier stock via `POST /inventory/receive` (PURCHASE_IN) · Dashboard › Inventory / Receive Stock | ✅ done |
| UC6 | Transfer stock between locations | Warehouse/Shop | `POST /transfers` · Dashboard › Transfers (`TransferPanel`; shopkeeper limited to SHOP↔REPAIR) | ✅ done |
| UC7 | Report damage & track repairs | Staff | `POST/GET/PATCH /damage-reports` · Dashboard › Damage & Repairs (`DamagePanel`) | ✅ done |
| UC8 | Manage orders & dispatch | Staff | `GET /orders/all`, `PATCH /orders/:id/status` (**assign courier at dispatch**), cancel · Dashboard › Orders (`OrdersAdmin`) + Couriers (`CourierPanel`, `GET/POST/PATCH /couriers`) | ✅ done |
| UC9 | Monthly sales report to owner | Owner | `GET /reports/monthly` (owner) · Dashboard › Monthly Report (live revenue/order-status) | ✅ done |
| UC12 | Detailed reports → owner archive (download + history) | Shopkeeper/Warehouse → Owner | Staff preview (`GET /reports/preview`) + send a **frozen snapshot** (`POST /reports/send-owner`, period = since their last report) + own history (`GET /reports/mine`) · Dashboard › Reports (`SendReportPanel`). Owner archive: list (`GET /reports/sent`) + full detail (`GET /reports/sent/:id`) + per-report **HTML download** · Dashboard › Received Reports (`ReportsArchivePanel`). Shopkeeper report = each item sold (when + to whom) + order statuses; Warehouse report = received / sent-to-shop / restock asks / sent-for-repair / repaired / scrapped + per-period stock ledger. | ✅ done |
| UC10 | Restock the shop from the warehouse | Shopkeeper → Warehouse | Shopkeeper raises asks (`POST /restock-requests`, "request all" or specific items) · Dashboard › Restock (`RestockPanel`); warehouse manager/owner fulfil (guarded WAREHOUSE→SHOP) or decline via `PATCH /restock-requests/:id` · Dashboard › Restock requests (`RestockQueuePanel`); shopkeeper withdraws own open ask via `POST /restock-requests/:id/cancel` | ✅ done |
| UC11 | Order-status report (each order's record) | Shopkeeper, Owner | `GET /reports/order-status` (order admin) — ordered/confirmed/dispatched/delivered + cancellations (incl. who cancelled) · Dashboard › Reports (`MonthlyReportPanel` status cards + per-order table). Revenue stays owner-only. | ✅ done |

Legend: ✅ done · 🚧 in progress · ⬜ not started

## How each UC was verified

- **Backend integration**: `backend/scripts/smoke-test.ps1` (run the dev server, then
  `powershell -File scripts/smoke-test.ps1`) — 78 assertions across all 9 UCs, including
  the RBAC 403 paths (customer → inventory/transfers/reports/users/couriers; shopkeeper →
  warehouse transfer/purchase-in/user-mgmt; warehouse manager → orders/couriers), invalid
  status transitions (409), oversell guards (409), stock-restoration on cancel,
  owner-provisioned staff, deactivated-login rejection (401), self-registration always
  creating a CUSTOMER, **delivery fees + order numbers**, the **courier-required
  dispatch** flow (400 without a courier / with an inactive one; PICKUP needs none), and the
  **out-of-stock request/pre-book** flow (PREBOOK when warehouse-stocked vs REQUEST when not,
  duplicate-block 409, fulfil pulling warehouse→shop + notifying the customer, can't-fulfil-with-no-stock 400).
- **Stock/money unit tests**: `backend/tests/order.service.test.ts` (`npm run test`) — 19
  Vitest cases covering the oversell guard, full-transaction rollback, server-side totals,
  STORE-order shortcut, status lifecycle, cancel restore, the damage/repair ledger, and the
  delivery-fee / order-number / courier-dispatch logic.

### Role & access model

- **Customer** — public storefront only (`/login`, `/register` self-service). No dashboard.
- **Staff** sign in at the separate **staff portal** `/staff/login` (no self-registration).
  Each role gets its own dashboard with a tailored overview + only its tabs:
  - **Shopkeeper** → Orders admin · Customer requests · **Restock asks to the warehouse** · Shop stock (SHOP/REPAIR) · Transfers (SHOP↔REPAIR) · Damage & repairs · **Reports** (order-status + send to owner).
  - **Warehouse Manager** → Full inventory · **Restock requests queue (fulfil/decline shop asks)** · Receive stock (purchase-in) · Transfers (incl. WAREHOUSE→SHOP) · Damage & repairs · Send report. **No order access.**
  - **Owner** → Everything above **+** Monthly revenue report **+** a **Received Reports archive** (detailed, downloadable reports sent by staff) **+** User Management (provision / re-role / deactivate staff).
- **"Verified" accounts** — staff are provisioned by the owner and gated by `User.active`;
  the owner can deactivate (and a deactivated account cannot log in). The owner cannot
  deactivate or demote their own account.

### RBAC summary (enforced + tested)

| Endpoint | Allowed | Blocked (→ 403/401) |
|---|---|---|
| `GET /inventory*`, `POST /damage-reports` | any staff | CUSTOMER |
| `GET /orders/all`, `PATCH /orders/:id/status` | SHOPKEEPER, OWNER | WAREHOUSE_MANAGER, CUSTOMER |
| `POST /orders/:id/cancel` | SHOPKEEPER/OWNER, or the owning customer | WAREHOUSE_MANAGER, other customers |
| `POST /transfers` from `WAREHOUSE`, `POST /inventory/receive` | WAREHOUSE_MANAGER, OWNER | SHOPKEEPER, CUSTOMER |
| `GET /reports/monthly` | OWNER | SHOPKEEPER, WAREHOUSE_MANAGER, CUSTOMER |
| `GET /reports/preview`, `POST /reports/send-owner`, `GET /reports/mine` (send/track own) | any staff | CUSTOMER |
| `GET /reports/sent`, `GET /reports/sent/:id` (received archive) | OWNER | SHOPKEEPER, WAREHOUSE_MANAGER, CUSTOMER |
| `GET/POST/PATCH /couriers` (delivery roster) | SHOPKEEPER, OWNER | WAREHOUSE_MANAGER, CUSTOMER |
| `POST /stock-requests`, `/my`, `/:id/cancel` (raise/track) | CUSTOMER | staff |
| `GET /stock-requests`, `PATCH /stock-requests/:id` (resolve) | SHOPKEEPER, OWNER | WAREHOUSE_MANAGER, CUSTOMER |
| `POST /restock-requests`, `/:id/cancel` (raise/withdraw shop asks) | SHOPKEEPER, OWNER | WAREHOUSE_MANAGER, CUSTOMER |
| `GET /restock-requests` (view queue) | any staff | CUSTOMER |
| `PATCH /restock-requests/:id` (fulfil/decline) | WAREHOUSE_MANAGER, OWNER | SHOPKEEPER, CUSTOMER |
| `GET /reports/order-status` (order record, no money) | SHOPKEEPER, OWNER | WAREHOUSE_MANAGER, CUSTOMER |
| `GET/POST/PATCH /users` (staff provisioning) | OWNER | everyone else |
| `POST /auth/login` for a deactivated account | — | rejected (401) |
