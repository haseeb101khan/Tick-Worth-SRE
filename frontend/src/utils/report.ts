import { FullReport, ShopkeeperReportData, WarehouseReportData } from '../types';
import { formatMoney } from './format';
import { SHOP } from './receipt';

// Minimal HTML escaping for dynamic text (product/customer names, reasons).
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const dateTime = (iso: string) => new Date(iso).toLocaleString();
const dateOnly = (iso: string) => new Date(iso).toLocaleDateString();

function table(headers: string[], rows: string[][], empty = 'None in this period.'): string {
  if (rows.length === 0) return `<p class="muted">${empty}</p>`;
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows
    .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function section(title: string, inner: string): string {
  return `<h2>${esc(title)}</h2>${inner}`;
}

function shopkeeperSections(d: ShopkeeperReportData): string {
  const sc = d.statusCounts;
  const summary = `
    <div class="cards">
      <div class="card"><span>${d.totalOrders}</span>Orders</div>
      <div class="card"><span>${sc.PENDING ?? 0}</span>Ordered</div>
      <div class="card"><span>${sc.PAID ?? 0}</span>Confirmed</div>
      <div class="card"><span>${sc.DISPATCHED ?? 0}</span>Dispatched</div>
      <div class="card"><span>${sc.DELIVERED ?? 0}</span>Delivered</div>
      <div class="card"><span>${sc.CANCELLED ?? 0}</span>Cancelled</div>
      <div class="card grand"><span>${formatMoney(d.revenueCents)}</span>Revenue</div>
    </div>`;

  const sales = table(
    ['Date', 'Order', 'Item', 'Qty', 'Unit', 'Line total', 'Customer', 'Status'],
    d.sales.map((s) => [
      dateOnly(s.date),
      `<span class="mono">${esc(s.orderNumber)}</span>`,
      esc(s.productName) + (s.color ? ` <span class="muted">(${esc(s.color)})</span>` : ''),
      String(s.quantity),
      formatMoney(s.unitPriceCents),
      formatMoney(s.lineTotalCents),
      `${esc(s.customerName)}${s.customerEmail ? `<br/><span class="muted">${esc(s.customerEmail)}</span>` : ''}`,
      esc(s.status),
    ]),
    'No items sold in this period.',
  );

  const cancels = table(
    ['Order', 'Date', 'Cancelled by', 'Reason'],
    d.cancellations.map((c) => [
      `<span class="mono">${esc(c.orderNumber)}</span>`,
      dateOnly(c.date),
      c.cancelledBy === 'CUSTOMER' ? 'Customer' : c.cancelledBy ? 'Staff' : '—',
      esc(c.cancelReason ?? '—'),
    ]),
    'No cancellations in this period.',
  );

  return summary + section('Items sold', sales) + section('Cancellations', cancels);
}

function warehouseSections(d: WarehouseReportData): string {
  const s = d.summary;
  const summary = `
    <div class="cards">
      <div class="card"><span>${s.received}</span>Received</div>
      <div class="card"><span>${s.sentToShop}</span>Sent to shop</div>
      <div class="card"><span>${s.sentToRepair}</span>To repair</div>
      <div class="card"><span>${s.repaired}</span>Repaired</div>
      <div class="card"><span>${s.scrapped}</span>Scrapped</div>
      <div class="card"><span>${s.restockRequests}</span>Restock asks</div>
    </div>`;

  const received = table(
    ['Date', 'Item', 'Qty received'],
    d.received.map((r) => [dateOnly(r.date), esc(r.productName), String(r.quantity)]),
    'No stock received in this period.',
  );
  const sentToShop = table(
    ['Date', 'Item', 'Qty sent'],
    d.sentToShop.map((r) => [dateOnly(r.date), esc(r.productName), String(r.quantity)]),
    'Nothing sent to the shop in this period.',
  );
  const restock = table(
    ['Requested', 'Item', 'Qty', 'Status', 'Sent', 'Resolved'],
    d.restockRequests.map((r) => [
      dateOnly(r.requestedAt),
      esc(r.productName),
      String(r.quantity),
      esc(r.status),
      r.movedQty != null ? String(r.movedQty) : '—',
      r.resolvedAt ? dateOnly(r.resolvedAt) : '—',
    ]),
    'No restock requests in this period.',
  );
  const repair = table(
    ['Date', 'Item', 'Qty', 'Issue', 'Status'],
    d.sentToRepair.map((r) => [dateOnly(r.date), esc(r.productName), String(r.quantity), esc(r.description), esc(r.status)]),
    'Nothing sent for repair in this period.',
  );
  const repaired = table(
    ['Date', 'Item', 'Qty'],
    d.repaired.map((r) => [dateOnly(r.date), esc(r.productName), String(r.quantity)]),
    'Nothing repaired in this period.',
  );
  const scrapped = table(
    ['Date', 'Item', 'Qty', 'Issue'],
    d.scrapped.map((r) => [dateOnly(r.date), esc(r.productName), String(r.quantity), esc(r.description)]),
    'Nothing scrapped in this period.',
  );
  const movements = table(
    ['When', 'Type', 'Item', 'Qty', 'From', 'To'],
    d.movements.map((m) => [
      dateTime(m.date),
      esc(m.type),
      esc(m.productName),
      String(m.quantity),
      esc(m.from ?? '—'),
      esc(m.to ?? '—'),
    ]),
    'No stock movements in this period.',
  );

  return (
    summary +
    section('Stock received (from supplier)', received) +
    section('Sent to shop', sentToShop) +
    section('Restock requests handled', restock) +
    section('Sent for repair', repair) +
    section('Repaired', repaired) +
    section('Unable to repair (scrapped)', scrapped) +
    section('All stock updates (ledger)', movements)
  );
}

/** Build a fully self-contained, printable HTML report (inline styles only). */
export function buildReportHtml(report: FullReport): string {
  const body =
    report.kind === 'WAREHOUSE'
      ? warehouseSections(report.data as WarehouseReportData)
      : shopkeeperSections(report.data as ShopkeeperReportData);
  const kindLabel = report.kind === 'WAREHOUSE' ? 'Warehouse Report' : 'Shop Report';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(report.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 40px; background: #fff; }
  .wrap { max-width: 880px; margin: 0 auto; }
  .head { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
  .brand { font-size: 28px; letter-spacing: 6px; }
  .tag { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #b08d57; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 20px; font-size: 13px; }
  .meta b { display: block; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #999; }
  h2 { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin: 30px 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { text-align: left; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #999; padding: 6px 8px; border-bottom: 2px solid #1a1a1a; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .muted { color: #888; font-size: 11px; }
  .mono { font-family: 'Courier New', monospace; font-weight: bold; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
  .card { flex: 1; min-width: 90px; border: 1px solid #e3e3e3; border-radius: 6px; padding: 12px; text-align: center; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #888; }
  .card span { display: block; font-size: 20px; color: #1a1a1a; letter-spacing: 0; text-transform: none; margin-bottom: 2px; }
  .card.grand { border-color: #b08d57; }
  .foot { margin-top: 36px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body onload="window.print()">
  <div class="wrap">
    <div class="head">
      <div class="brand">${SHOP.name}</div>
      <div class="tag">${kindLabel}</div>
    </div>
    <div class="meta">
      <div><b>Report</b>${esc(report.title)}</div>
      <div><b>From</b>${esc(report.senderName)} (${esc(report.senderRole.replace('_', ' '))})</div>
      <div><b>Period</b>${dateOnly(report.periodStart)} – ${dateOnly(report.periodEnd)}</div>
      <div><b>Sent</b>${dateTime(report.createdAt)}</div>
    </div>
    ${body}
    <div class="foot">${SHOP.name} · ${SHOP.contact}</div>
  </div>
</body>
</html>`;
}

export function downloadReport(report: FullReport) {
  const html = buildReportHtml(report);
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }
  // Pop-up blocked → fall back to a downloadable HTML file.
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-${report.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
