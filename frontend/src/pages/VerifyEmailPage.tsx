import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiErrorMessage } from '../utils/apiError';

// Landing page for the link in the verification email: /verify-email?token=...
// Confirms the token, signs the user in, and sends them to the storefront.
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'ok' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const ran = useRef(false); // guard against React 18 StrictMode double-invoke

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('This link is missing its verification token.');
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus('ok');
        setTimeout(() => navigate('/', { replace: true }), 1500);
      })
      .catch((e) => {
        setStatus('error');
        setMessage(apiErrorMessage(e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-6">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="font-serif text-2xl tracking-[0.2em] text-ink">
          TICK WORTH
        </Link>
        {status === 'verifying' && <p className="mt-10 text-stone">Verifying your email…</p>}
        {status === 'ok' && (
          <>
            <h1 className="mt-10 font-serif text-3xl font-light text-ink">Email verified</h1>
            <p className="mt-3 text-sm text-stone">You're signed in — taking you to the collection…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="mt-10 font-serif text-3xl font-light text-ink">Verification failed</h1>
            <p className="mt-3 text-sm text-stone">{message}</p>
            <Link
              to="/login"
              className="btn-outline mt-6 inline-block border-ink/30 text-ink hover:bg-ink hover:text-ivory"
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
