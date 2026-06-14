import { ReactNode } from 'react';
import { ReportData, ReportKind, ShopkeeperReportData, WarehouseReportData } from '../../types';
import { formatMoney, orderStatusLabel } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

const d = (iso: string) => new Date(iso).toLocaleDateString();
const dt = (iso: string) => new Date(iso).toLocaleString();

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      {children}
    </div>
  );
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniCard({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${tone ?? 'border-gray-200 bg-white'}`}>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function ShopkeeperView({ data }: { data: ShopkeeperReportData }) {
  const sc = data.statusCounts;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <MiniCard value={data.totalOrders} label="Orders" />
        <MiniCard value={sc.PENDING ?? 0} label="Ordered" tone="border-amber-200 bg-amber-50" />
        <MiniCard value={sc.PAID ?? 0} label="Confirmed" tone="border-blue-200 bg-blue-50" />
        <MiniCard value={sc.DISPATCHED ?? 0} label="Dispatched" tone="border-purple-200 bg-purple-50" />
        <MiniCard value={sc.DELIVERED ?? 0} label="Delivered" tone="border-emerald-200 bg-emerald-50" />
        <MiniCard value={sc.CANCELLED ?? 0} label="Cancelled" tone="border-gray-200 bg-gray-100" />
      </div>
      <MiniCard value={formatMoney(data.revenueCents)} label="Revenue (paid / dispatched / delivered)" tone="border-amber-300 bg-amber-50" />

      <Section title={`Items sold (${data.sales.length})`}>
        <DataTable
          headers={['Date', 'Order', 'Item', 'Qty', 'Unit', 'Line', 'Customer', 'Status']}
          empty="No items sold in this period."
          rows={data.sales.map((s) => [
            d(s.date),
            <span className="font-mono text-xs font-semibold">{s.orderNumber}</span>,
            <span>
              {s.productName}
              {s.color && <span className="text-gray-400"> ({s.color})</span>}
            </span>,
            s.quantity,
            formatMoney(s.unitPriceCents),
            formatMoney(s.lineTotalCents),
            <span>
              {s.customerName}
              {s.customerEmail && <span className="block text-xs text-gray-400">{s.customerEmail}</span>}
            </span>,
            <StatusBadge status={s.status} label={orderStatusLabel(s.status)} />,
          ])}
        />
      </Section>

      <Section title={`Cancellations (${data.cancellations.length})`}>
        <DataTable
          headers={['Order', 'Date', 'Cancelled by', 'Reason']}
          empty="No cancellations in this period."
          rows={data.cancellations.map((c) => [
            <span className="font-mono text-xs font-semibold">{c.orderNumber}</span>,
            d(c.date),
            c.cancelledBy === 'CUSTOMER' ? 'Customer' : c.cancelledBy ? 'Staff' : '—',
            c.cancelReason ?? '—',
          ])}
        />
      </Section>
    </div>
  );
}

function WarehouseView({ data }: { data: WarehouseReportData }) {
  const s = data.summary;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <MiniCard value={s.received} label="Received" tone="border-emerald-200 bg-emerald-50" />
        <MiniCard value={s.sentToShop} label="Sent to shop" tone="border-blue-200 bg-blue-50" />
        <MiniCard value={s.sentToRepair} label="To repair" tone="border-amber-200 bg-amber-50" />
        <MiniCard value={s.repaired} label="Repaired" tone="border-emerald-200 bg-emerald-50" />
        <MiniCard value={s.scrapped} label="Scrapped" tone="border-gray-200 bg-gray-100" />
        <MiniCard value={s.restockRequests} label="Restock asks" />
      </div>

      <Section title={`Stock received from supplier (${data.received.length})`}>
        <DataTable
          headers={['Date', 'Item', 'Qty received']}
          empty="No stock received in this period."
          rows={data.received.map((r) => [d(r.date), r.productName, r.quantity])}
        />
      </Section>

      <Section title={`Sent to shop (${data.sentToShop.length})`}>
        <DataTable
          headers={['Date', 'Item', 'Qty sent']}
          empty="Nothing sent to the shop in this period."
          rows={data.sentToShop.map((r) => [d(r.date), r.productName, r.quantity])}
        />
      </Section>

      <Section title={`Restock requests handled (${data.restockRequests.length})`}>
        <DataTable
          headers={['Requested', 'Item', 'Qty', 'Status', 'Sent', 'Resolved']}
          empty="No restock requests in this period."
          rows={data.restockRequests.map((r) => [
            d(r.requestedAt),
            r.productName,
            r.quantity,
            <StatusBadge status={r.status} />,
            r.movedQty != null ? r.movedQty : '—',
            r.resolvedAt ? d(r.resolvedAt) : '—',
          ])}
        />
      </Section>

      <Section title={`Sent for repair (${data.sentToRepair.length})`}>
        <DataTable
          headers={['Date', 'Item', 'Qty', 'Issue', 'Status']}
          empty="Nothing sent for repair in this period."
          rows={data.sentToRepair.map((r) => [d(r.date), r.productName, r.quantity, r.description, <StatusBadge status={r.status} />])}
        />
      </Section>

      <Section title={`Repaired (${data.repaired.length})`}>
        <DataTable
          headers={['Date', 'Item', 'Qty']}
          empty="Nothing repaired in this period."
          rows={data.repaired.map((r) => [d(r.date), r.productName, r.quantity])}
        />
      </Section>

      <Section title={`Unable to repair — scrapped (${data.scrapped.length})`}>
        <DataTable
          headers={['Date', 'Item', 'Qty', 'Issue']}
          empty="Nothing scrapped in this period."
          rows={data.scrapped.map((r) => [d(r.date), r.productName, r.quantity, r.description])}
        />
      </Section>

      <Section title={`All stock updates — ledger (${data.movements.length})`}>
        <DataTable
          headers={['When', 'Type', 'Item', 'Qty', 'From', 'To']}
          empty="No stock movements in this period."
          rows={data.movements.map((m) => [
            dt(m.date),
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{m.type}</span>,
            m.productName,
            m.quantity,
            m.from ?? '—',
            m.to ?? '—',
          ])}
        />
      </Section>
    </div>
  );
}

export function ReportDetail({ kind, data }: { kind: ReportKind; data: ReportData }) {
  return kind === 'WAREHOUSE' ? (
    <WarehouseView data={data as WarehouseReportData} />
  ) : (
    <ShopkeeperView data={data as ShopkeeperReportData} />
  );
}
