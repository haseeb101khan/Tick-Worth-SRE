import { useEffect, useState } from 'react';
import { Location, StockRow } from '../../types';
import { getInventory, getLowStock } from '../../services/inventoryService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { formatMoney } from '../../utils/format';

const ALL_LOCATIONS: Location[] = ['WAREHOUSE', 'SHOP', 'REPAIR'];

// `locations` lets a role-specific dashboard show only the columns it cares about
// (e.g. the shopkeeper sees SHOP + REPAIR, not the warehouse).
export function StockOverview({
  refreshKey,
  locations = ALL_LOCATIONS,
}: {
  refreshKey: number;
  locations?: Location[];
}) {
  const toast = useToast();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getInventory(), getLowStock()])
      .then(([inv, low]) => {
        setStock(inv);
        setLowStock(low);
      })
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Group rows: productId → { product, WAREHOUSE, SHOP, REPAIR }
  const byProduct = new Map<string, { name: string; priceCents: number; qty: Record<string, StockRow | undefined> }>();
  for (const row of stock) {
    const entry = byProduct.get(row.productId) ?? {
      name: `${row.product.brand} ${row.product.name}`,
      priceCents: row.product.priceCents,
      qty: {},
    };
    entry.qty[row.location] = row;
    byProduct.set(row.productId, entry);
  }
  const lowKeys = new Set(lowStock.map((s) => `${s.productId}:${s.location}`));

  if (loading) return <p className="text-gray-500">Loading stock…</p>;

  return (
    <div className="space-y-6">
      {lowStock.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 font-semibold text-red-700">⚠ Low-stock alerts ({lowStock.length})</h3>
          <ul className="space-y-1 text-sm text-red-800">
            {lowStock.map((s) => (
              <li key={s.id}>
                {s.product.brand} {s.product.name} at <b>{s.location}</b>: {s.quantity} left (reorder
                level {s.reorderLevel})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Price</th>
              {locations.map((loc) => (
                <th key={loc} className="px-4 py-3 text-center">
                  {loc.charAt(0) + loc.slice(1).toLowerCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...byProduct.entries()].map(([productId, p]) => (
              <tr key={productId}>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{formatMoney(p.priceCents)}</td>
                {locations.map((loc) => {
                  const row = p.qty[loc];
                  const isLow = lowKeys.has(`${productId}:${loc}`);
                  return (
                    <td
                      key={loc}
                      className={`px-4 py-3 text-center ${isLow ? 'font-bold text-red-600' : ''}`}
                    >
                      {row?.quantity ?? '—'}
                      {isLow && ' ⚠'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
