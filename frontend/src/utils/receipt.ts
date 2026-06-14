import { DELIVERY_OPTIONS, Order } from '../types';
import { formatMoney } from './format';

export const SHOP = {
  name: 'TICK WORTH',
  tagline: 'Fine Timepieces',
  address: '12 Regent Street · London W1B 5TF',
  contact: 'support@tickworth.test · +44 20 7946 0000',
};

export function receiptDeliveryLabel(order: Order) {
  return DELIVERY_OPTIONS.find((o) => o.value === order.deliveryMethod)?.label ?? order.deliveryMethod;
}

export function paymentLabel(method: string) {
  return method === 'COD' ? 'Cash on delivery' : 'Paid online';
}

type Customer = { name: string; email: string } | null | undefined;

/**
 * Build a fully self-contained HTML receipt (inline styles only) so it can be opened
 * in a new window and printed / saved as PDF without any app CSS. This is the
 * "download / save" path — the browser's print dialog offers "Save as PDF".
 */
export function buildReceiptHtml(order: Order, productNames: Record<string, string>, customer?: Customer) {
  const subtotalCents = order.totalCents - order.deliveryFeeCents;
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;">${productNames[item.productId] ?? item.productId}${item.color ? `<div style="font-size:11px;color:#888;">Colour: ${item.color}</div>` : ''}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(item.unitPriceCents)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(item.unitPriceCents * item.quantity)}</td>
        </tr>`,
    )
    .join('');

  const shipLine =
    order.deliveryMethod === 'PICKUP'
      ? 'Collect in store once payment is confirmed.'
      : order.shippingAddress ?? '—';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${order.orderNumber}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 40px; background: #fff; }
  .wrap { max-width: 640px; margin: 0 auto; }
  .head { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 18px; }
  .brand { font-size: 30px; letter-spacing: 6px; font-weight: 400; }
  .tag { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #b08d57; margin-top: 4px; }
  .muted { color: #777; font-size: 12px; }
  .meta { display: flex; justify-content: space-between; margin-top: 22px; font-size: 13px; }
  .meta h3 { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 26px; font-size: 14px; }
  th { text-align: left; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #999; padding-bottom: 8px; border-bottom: 2px solid #1a1a1a; }
  th.r, td.r { text-align: right; }
  th.c { text-align: center; }
  .totals { margin-top: 18px; margin-left: auto; width: 260px; font-size: 14px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; color: #555; }
  .totals .grand { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-size: 18px; color: #1a1a1a; }
  .foot { margin-top: 36px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 18px; }
  .badge { display: inline-block; border: 1px solid #b08d57; color: #8a6d3b; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 10px; border-radius: 2px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body onload="window.print()">
  <div class="wrap">
    <div class="head">
      <div class="brand">${SHOP.name}</div>
      <div class="tag">${SHOP.tagline}</div>
      <div class="muted" style="margin-top:8px;">${SHOP.address}<br/>${SHOP.contact}</div>
    </div>

    <div class="meta">
      <div>
        <h3>Billed to</h3>
        <div>${customer?.name ?? 'Customer'}</div>
        <div class="muted">${customer?.email ?? ''}</div>
        <div class="muted" style="margin-top:8px;max-width:240px;">${shipLine}</div>
      </div>
      <div style="text-align:right;">
        <h3>Receipt</h3>
        <div style="font-size:16px;letter-spacing:1px;">${order.orderNumber}</div>
        <div class="muted">${new Date(order.createdAt).toLocaleString()}</div>
        <div style="margin-top:8px;"><span class="badge">${order.status}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Item</th><th class="c">Qty</th><th class="r">Unit</th><th class="r">Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatMoney(subtotalCents)}</span></div>
      <div class="row"><span>${receiptDeliveryLabel(order)}</span><span>${order.deliveryFeeCents === 0 ? 'Free' : formatMoney(order.deliveryFeeCents)}</span></div>
      <div class="row grand"><span>Total</span><span>${formatMoney(order.totalCents)}</span></div>
    </div>

    <div style="margin-top:24px;font-size:13px;color:#555;">
      <strong>Payment:</strong> ${paymentLabel(order.paymentMethod)}${order.paymentConfirmed ? ' · confirmed' : ' · pending confirmation'}<br/>
      <strong>Delivery:</strong> ${receiptDeliveryLabel(order)}${order.courier ? ` · Courier: ${order.courier.name} (${order.courier.phone})` : ''}
    </div>

    <div class="foot">
      Thank you for your purchase. Keep this receipt for your records.<br/>
      ${SHOP.name} · ${SHOP.contact}
    </div>
  </div>
</body>
</html>`;
}

export function downloadReceipt(order: Order, productNames: Record<string, string>, customer?: Customer) {
  const html = buildReceiptHtml(order, productNames, customer);
  const win = window.open('', '_blank', 'width=720,height=900');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }
  // Pop-up blocked → fall back to a downloadable HTML file the customer can open & print.
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${order.orderNumber}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
