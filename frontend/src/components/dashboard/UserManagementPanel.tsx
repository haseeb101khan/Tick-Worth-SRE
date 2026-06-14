import { FormEvent, useEffect, useState } from 'react';
import { Role, StaffUser } from '../../types';
import { createStaff, getStaff, updateStaff } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';

type StaffRole = Exclude<Role, 'CUSTOMER'>;
const ROLES: StaffRole[] = ['SHOPKEEPER', 'WAREHOUSE_MANAGER', 'OWNER'];

/** Owner-only: provision, re-role, and (de)activate internal staff accounts. */
export function UserManagementPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('SHOPKEEPER');
  const [busy, setBusy] = useState(false);

  function refresh() {
    getStaff()
      .then(setStaff)
      .catch((e) => toast.error(apiErrorMessage(e)));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createStaff({ name, email, password, role });
      toast.success(`${role.replace('_', ' ').toLowerCase()} account created`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('SHOPKEEPER');
      refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(s: StaffUser) {
    try {
      const updated = await updateStaff(s.id, { active: !s.active });
      setStaff((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      toast.success(updated.active ? 'Account reactivated' : 'Account deactivated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleRoleChange(s: StaffUser, newRole: StaffRole) {
    try {
      const updated = await updateStaff(s.id, { role: newRole });
      setStaff((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      toast.success(`Role updated to ${newRole.replace('_', ' ').toLowerCase()}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <form onSubmit={handleCreate} className="h-fit space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Provision staff account</h3>
        <p className="text-xs text-gray-500">
          Internal accounts are created here — there is no staff self-registration.
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
          <label className="mb-1 block text-sm font-medium">Work email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Temporary password (min 6)</label>
          <input
            type="text"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {staff.map((s) => {
              const isSelf = s.id === user?.id;
              return (
                <tr key={s.id} className={s.active ? '' : 'bg-gray-50 text-gray-400'}>
                  <td className="px-4 py-3 font-medium">
                    {s.name}
                    {isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3">{s.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={s.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(s, e.target.value as StaffRole)}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {s.active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={isSelf}
                      onClick={() => handleToggleActive(s)}
                      className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title={isSelf ? 'You cannot deactivate your own account' : ''}
                    >
                      {s.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
