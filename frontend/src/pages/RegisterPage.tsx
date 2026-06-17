import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { resendVerification } from '../services/authService';
import { apiErrorMessage } from '../utils/apiError';
import { storyImage } from '../utils/images';

export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false); // registration done → verification email sent

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await register(name, email, password);
      if (result.needsVerification) {
        setSent(true); // show the "check your email" panel
      } else {
        // Auto-verified + signed in — go straight to the store.
        toast.success('Welcome to Tick Worth.');
        navigate('/', { replace: true });
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    try {
      await resendVerification(email);
      toast.success('Verification email re-sent');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={storyImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink/70" />
        <div className="absolute inset-0 flex flex-col justify-center px-16 text-ivory">
          <span className="eyebrow">Join the Maison</span>
          <h2 className="mt-5 max-w-sm font-serif text-5xl font-light leading-tight">
            Begin your horological journey.
          </h2>
        </div>
      </div>

      <div className="flex items-center justify-center bg-ivory px-6 py-24">
        <div className="w-full max-w-sm">
          <Link to="/" className="font-serif text-2xl tracking-[0.2em] text-ink">
            TICK WORTH
          </Link>
          {sent ? (
            <div className="mt-10">
              <h1 className="font-serif text-3xl font-light text-ink">Check your email</h1>
              <p className="mt-4 text-sm leading-relaxed text-stone">
                We've sent a verification link to <span className="font-medium text-ink">{email}</span>.
                Click it to activate your account, then sign in.
              </p>
              <button type="button" onClick={handleResend} className="btn-outline mt-6 w-full border-ink/30 text-ink hover:bg-ink hover:text-ivory">
                Resend the email
              </button>
              <p className="mt-6 text-center text-sm text-stone">
                Already verified?{' '}
                <Link to="/login" className="text-gold-dark hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
          <>
          <h1 className="mt-10 font-serif text-3xl font-light text-ink">Create your account</h1>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="label-luxe">Full name</label>
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-luxe"
              />
            </div>
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
              <label className="label-luxe">Password · min 6 characters</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-luxe"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-dark w-full">
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone">
            Already registered?{' '}
            <Link to="/login" className="text-gold-dark hover:underline">
              Sign in
            </Link>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
