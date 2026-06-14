import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { STAFF_ROLES } from '../components/ProtectedRoute';

const DEMO_STAFF: { label: string; email: string }[] = [
  { label: 'Shopkeeper', email: 'shop@tickworth.test' },
  { label: 'Warehouse Manager', email: 'warehouse@tickworth.test' },
  { label: 'Owner', email: 'owner@tickworth.test' },
];

/**
 * Internal staff portal — a separate door from the public storefront login.
 * No self-registration here: staff accounts are provisioned by the owner.
 */
export function StaffLoginPage() {
  const { login, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function doLogin(em: string, pw: string) {
    setBusy(true);
    try {
      const user = await login(em, pw);
      if (!STAFF_ROLES.includes(user.role)) {
        // A customer used the staff door — don't grant a staff session.
        logout();
        toast.error('This portal is for staff accounts only.');
        return;
      }
      navigate('/dashboard', { replace: true });
      toast.success(`Signed in as ${user.role.replace('_', ' ').toLowerCase()}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    doLogin(email, password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-semibold">⌚ Tick Worth — Staff Portal</h1>
          <p className="text-sm text-gray-400">Internal access for shop, warehouse, and owner.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow-xl">
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
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-xs text-gray-400">
            No staff account? Ask the owner to provision one — there is no staff self-registration.
          </p>
        </form>

        <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800 p-4 text-center">
          <p className="mb-2 text-sm font-medium text-gray-300">Demo staff (password: password123)</p>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO_STAFF.map((s) => (
              <button
                key={s.email}
                type="button"
                disabled={busy}
                onClick={() => doLogin(s.email, 'password123')}
                className="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-xs text-gray-100 hover:bg-gray-600 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          <Link to="/" className="hover:text-gray-300 hover:underline">
            ← Back to storefront
          </Link>
        </p>
      </div>
    </div>
  );
}
