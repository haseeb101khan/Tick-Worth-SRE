import { FormEvent, useEffect, useState } from 'react';
import { Courier } from '../../types';
import { createCourier, getCouriers, updateCourier } from '../../services/courierService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';

/** Order admins (shopkeeper / owner) manage the delivery roster. */
export function CourierPanel() {
  const toast = useToast();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  function refresh() {
    getCouriers()
      .then(setCouriers)
      .catch((e) => toast.error(apiErrorMessage(e)));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createCourier({ name, phone, email: email || undefined });
      toast.success('Courier added');
      setName('');
      setPhone('');
      setEmail('');
      refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Courier) {
    try {
      const updated = await updateCourier(c.id, { active: !c.active });
      setCouriers((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      toast.success(updated.active ? 'Courier reactivated' : 'Courier deactivated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <form onSubmit={handleCreate} className="h-fit space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Add courier</h3>
        <p className="text-xs text-gray-500">
          Delivery personnel assigned to orders at dispatch. Their contact shows on the order.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Phone</label>
          <input
            required
            minLength={5}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="+1-555-0100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add courier'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {couriers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-gray-500">
                  No couriers yet.
                </td>
              </tr>
            )}
            {couriers.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'bg-gray-50 text-gray-400'}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">{c.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {c.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleActive(c)}
                    className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    {c.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
