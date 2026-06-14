import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { NotificationsBell } from './NotificationsBell';
import { STAFF_ROLES } from './ProtectedRoute';

export function Navbar() {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const overHero = location.pathname === '/' && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-[0.7rem] uppercase tracking-wide2 transition-colors hover:text-gold ${
      isActive ? 'text-gold' : 'text-ivory/80'
    }`;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        overHero ? 'bg-transparent py-5' : 'bg-ink/95 py-3.5 shadow-lg backdrop-blur'
      }`}
    >
      <div className="section flex items-center justify-between gap-4">
        <Link to="/" className="font-serif text-xl tracking-[0.22em] text-ivory sm:text-2xl">
          TICK&nbsp;WORTH
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          <NavLink to="/" className={linkClass} end>
            Home
          </NavLink>
          <NavLink to="/shop" className={linkClass}>
            Collection
          </NavLink>
          <Link to="/#brands" className={linkClass({ isActive: false })}>
            Brands
          </Link>
          {user && !isStaff && (
            <NavLink to="/orders" className={linkClass}>
              My Orders
            </NavLink>
          )}
          {isStaff && (
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-4 text-ivory">
          {user && <NotificationsBell />}
          {!isStaff && (
            <Link
              to="/cart"
              className="relative text-[0.7rem] uppercase tracking-wide2 text-ivory/80 hover:text-gold"
            >
              Cart
              {cartCount > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] font-semibold text-ink">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
          {user ? (
            <button
              onClick={handleLogout}
              className="hidden text-[0.7rem] uppercase tracking-wide2 text-ivory/80 hover:text-gold sm:inline"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden text-[0.7rem] uppercase tracking-wide2 text-ivory/80 hover:text-gold sm:inline"
            >
              Sign in
            </Link>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="text-ivory md:hidden"
            aria-label="Menu"
          >
            <span className="text-lg">☰</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mt-3 border-t border-ivory/10 bg-ink/95 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <NavLink to="/" className={linkClass} end>
              Home
            </NavLink>
            <NavLink to="/shop" className={linkClass}>
              Collection
            </NavLink>
            <Link to="/#brands" className={linkClass({ isActive: false })}>
              Brands
            </Link>
            {user && !isStaff && (
              <NavLink to="/orders" className={linkClass}>
                My Orders
              </NavLink>
            )}
            {isStaff && (
              <NavLink to="/dashboard" className={linkClass}>
                Dashboard
              </NavLink>
            )}
            {user ? (
              <button onClick={handleLogout} className="text-left text-[0.7rem] uppercase tracking-wide2 text-ivory/80">
                Logout
              </button>
            ) : (
              <Link to="/login" className="text-[0.7rem] uppercase tracking-wide2 text-ivory/80">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
