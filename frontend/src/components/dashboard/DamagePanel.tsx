import { FormEvent, useEffect, useState } from 'react';
import { DamageReport, Product, RepairStatus } from '../../types';
import {
  createDamageReport,
  getDamageReports,
  updateDamageReport,
} from '../../services/damageService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { StatusBadge } from '../StatusBadge';

// Next allowed repair statuses, mirroring the backend's REPAIR_FLOW.
const NEXT: Record<string, RepairStatus[]> = {
  REPORTED: ['IN_REPAIR', 'SCRAPPED'],
  IN_REPAIR: ['REPAIRED', 'SCRAPPED'],
};

export function DamagePanel({ products, onStockChange }: { products: Product[]; onStockChange: () => void }) {
  const toast = useToast();
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [productId, setProductId] = useState('');
  const [location, setLocation] = useState<'WAREHOUSE' | 'SHOP'>('SHOP');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  function refresh() {
    getDamageReports()
      .then(setReports)
      .catch((e) => toast.error(apiErrorMessage(e)));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createDamageReport({ productId, location, quantity, description });
      toast.success('Damage reported — units moved to REPAIR');
      setDescription('');
      setQuantity(1);
      refresh();
      onStockChange();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(report: DamageReport, status: RepairStatus) {
    try {
      await updateDamageReport(report.id, status);
      toast.success(
        status === 'REPAIRED'
          ? 'Repair complete — units moved back to SHOP'
          : `Report marked ${status.replace('_', ' ')}`,
      );
      refresh();
      onStockChange();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={handleSubmit} className="h-fit space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Report damage</h3>
        <div>
          <label className="mb-1 block text-sm font-medium">Product</label>
          <select
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Found at</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as 'WAREHOUSE' | 'SHOP')}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option>SHOP</option>
              <option>WAREHOUSE</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Qty</label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="e.g. cracked crystal, bent lugs…"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? 'Reporting…' : 'Report damage'}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="font-semibold">Repair tracking</h3>
        {reports.length === 0 && <p className="text-sm text-gray-500">No damage reports yet.</p>}
        {reports.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {r.product ? `${r.product.brand} ${r.product.name}` : r.productId} × {r.quantity}
              </p>
              <StatusBadge status={r.status} />
            </div>
            <p className="mb-2 text-sm text-gray-600">{r.description}</p>
            <p className="mb-2 text-xs text-gray-400">
              Reported {new Date(r.createdAt).toLocaleString()}
            </p>
            <div className="flex gap-2">
              {(NEXT[r.status] ?? []).map((next) => (
                <button
                  key={next}
                  onClick={() => handleStatus(r, next)}
                  className={`rounded border px-3 py-1 text-xs hover:bg-gray-50 ${
                    next === 'SCRAPPED' ? 'border-red-300 text-red-600 hover:bg-red-50' : ''
                  }`}
                >
                  Mark {next.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
