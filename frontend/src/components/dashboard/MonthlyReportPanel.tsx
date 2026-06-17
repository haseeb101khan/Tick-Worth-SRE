import { useCallback, useEffect, useState } from 'react';
import { MonthlyReport, OrderStatus, OrderStatusReport } from '../../types';
import { getMonthlyReport, getOrderStatusReport } from '../../services/reportService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate, formatMoney, orderStatusLabel } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The lifecycle, in order, with a card colour per stage.
const STATUS_CARDS: { key: OrderStatus; cls: string }[] = [
  { key: 'PENDING', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  { key: 'PAID', cls: 'border-blue-200 bg-blue-50 text-blue-800' },
  { key: 'DISPATCHED', cls: 'border-purple-200 bg-purple-50 text-purple-800' },
  { key: 'DELIVERED', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { key: 'CANCELLED', cls: 'border-gray-200 bg-gray-100 text-gray-600' },
];

function cancelledByLabel(cancelledBy?: string | null) {
  if (!cancelledBy) return null;
  return cancelledBy === 'CUSTOMER' ? 'by customer' : 'by staff';
}

/**
 * Owner's live month view: the order-status report (Ordered → Confirmed → Dispatched →
 * Delivered, plus cancellations) and the revenue figures. Staff send their detailed reports
 * from the separate SendReportPanel; the owner browses received ones in ReportsArchivePanel.
 */
export function MonthlyReportPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [status, setStatus] = useState<OrderStatusReport | null>(null);

  const isOwner = user?.role === 'OWNER';
  const isOrderAdmin = user?.role === 'SHOPKEEPER' || isOwner;

  const load = useCallback(() => {
    // The year <input> emits intermediate values while typing (e.g. '' → 0, '202' → 202).
    // Only query once it's a valid 4-digit year, matching the backend bounds, so we don't
    // fire a 400 + error toast on every keystroke. (Month comes from a <select>, always valid.)
    if (year < 2000 || year > 2100) return;
    if (isOrderAdmin) {
      getOrderStatusReport(year, month).then(setStatus).catch((e) => toast.error(apiErrorMessage(e)));
    }
    if (isOwner) {
      getMonthlyReport(year, month).then(setReport).catch((e) => toast.error(apiErrorMessage(e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, isOrderAdmin, isOwner]);

  useEffect(load, [load]);

  const maxDaily = report ? Math.max(...report.dailyRevenue.map((d) => d.revenueCents), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded border px-3 py-2 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28 rounded border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Order-status report — shopkeeper + owner. */}
      {isOrderAdmin && status && (
        <>
          <div>
            <h3 className="mb-3 font-semibold">
              Orders — {MONTHS[month - 1]} {year} ({status.total} total)
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {STATUS_CARDS.map((c) => (
                <div key={c.key} className={`rounded-lg border p-4 text-center ${c.cls}`}>
                  <p className="text-2xl font-semibold">{status.statusCounts[c.key] ?? 0}</p>
                  <p className="text-xs font-medium uppercase tracking-wide">{orderStatusLabel(c.key)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {status.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3">{o.customerName}</td>
                    <td className="px-4 py-3 text-center">{o.itemCount}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(o.totalCents)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} label={orderStatusLabel(o.status)} />
                      {o.status === 'CANCELLED' && (
                        <span className="ml-2 text-xs text-gray-400">
                          {cancelledByLabel(o.cancelledBy)}
                          {o.cancelReason ? ` — “${o.cancelReason}”` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {status.orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-gray-500">
                      No orders this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Revenue figures — owner only. */}
      {isOwner && report && (
        <>
          <h3 className="font-semibold">Revenue (owner-only)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-2xl font-semibold">{formatMoney(report.totalRevenueCents)}</p>
              <p className="text-xs text-gray-400">
                incl. {formatMoney(report.deliveryRevenueCents)} delivery ·{' '}
                {formatMoney(report.totalRevenueCents - report.deliveryRevenueCents)} products
              </p>
            </div>
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Orders (paid / dispatched / delivered)</p>
              <p className="text-2xl font-semibold">{report.orderCount}</p>
            </div>
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Avg order value</p>
              <p className="text-2xl font-semibold">
                {report.orderCount > 0
                  ? formatMoney(Math.round(report.totalRevenueCents / report.orderCount))
                  : '—'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold">
              Daily revenue — {MONTHS[month - 1]} {year}
            </h3>
            {report.dailyRevenue.length === 0 ? (
              <p className="text-sm text-gray-500">No revenue this month.</p>
            ) : (
              <div className="flex h-40 items-end gap-2 overflow-x-auto">
                {report.dailyRevenue.map((d) => (
                  <div key={d.day} className="flex min-w-10 flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500">{formatMoney(d.revenueCents)}</span>
                    <div
                      className="w-8 rounded-t bg-amber-500"
                      style={{ height: `${Math.max(6, (d.revenueCents / maxDaily) * 110)}px` }}
                    />
                    <span className="text-xs text-gray-500">{d.day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <h3 className="px-5 pt-4 font-semibold">Top products</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-right">Units sold</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.topProducts.map((p) => (
                  <tr key={p.productId}>
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3 text-right">{p.quantity}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(p.revenueCents)}</td>
                  </tr>
                ))}
                {report.topProducts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-4 text-gray-500">
                      No sales this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
