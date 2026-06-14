import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { STAFF_ROLES } from '../components/ProtectedRoute';
import { ctaImage } from '../utils/images';

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function doLogin(em: string, pw: string) {
    setBusy(true);
    try {
      const user = await login(em, pw);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(STAFF_ROLES.includes(user.role) ? '/dashboard' : (from ?? '/'), { replace: true });
      toast.success('Welcome back to Tick Worth.');
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Visual side */}
      <div className="relative hidden lg:block">
        <img src={ctaImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink/70" />
        <div className="absolute inset-0 flex flex-col justify-center px-16 text-ivory">
          <span className="eyebrow">Tick Worth</span>
          <h2 className="mt-5 max-w-sm font-serif text-5xl font-light leading-tight">
            Your collection awaits.
          </h2>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center bg-ivory px-6 py-24">
        <div className="w-full max-w-sm">
          <Link to="/" className="font-serif text-2xl tracking-[0.2em] text-ink">
            TICK WORTH
          </Link>
          <h1 className="mt-10 font-serif text-3xl font-light text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-stone">Access your orders and pre-bookings.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="label-luxe">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-luxe"
              />
            </div>
            <div>
              <label className="label-luxe">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-luxe"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-dark w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone">
            New to Tick Worth?{' '}
            <Link to="/register" className="text-gold-dark hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-8 border-t border-ink/10 pt-6 text-center">
            <p className="eyebrow-muted mb-3">Demo customer · password123</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => doLogin('customer@tickworth.test', 'password123')}
              className="text-[0.7rem] uppercase tracking-wide2 text-ink underline-offset-4 hover:text-gold hover:underline"
            >
              Enter as a customer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
