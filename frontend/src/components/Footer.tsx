import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { CONTACT } from '../utils/contact';

export function Footer() {
  const toast = useToast();
  const [email, setEmail] = useState('');

  function subscribe(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setEmail('');
    toast.success('Thank you — welcome to the Tick Worth circle.');
  }

  return (
    <footer className="bg-ink text-ivory">
      {/* Newsletter */}
      <div className="border-b border-ivory/10">
        <div className="section flex flex-col items-center gap-6 py-16 text-center">
          <span className="eyebrow">The Tick Worth Circle</span>
          <h3 className="max-w-2xl font-serif text-3xl font-light sm:text-4xl">
            Receive private previews, new arrivals and horological stories.
          </h3>
          <form onSubmit={subscribe} className="flex w-full max-w-md gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="w-full border border-ivory/25 bg-transparent px-4 py-3 text-sm text-ivory placeholder:text-ivory/40 focus:border-gold focus:outline-none"
            />
            <button type="submit" className="btn-gold whitespace-nowrap">
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* Columns */}
      <div className="section grid grid-cols-2 gap-8 py-14 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <p className="font-serif text-2xl tracking-[0.2em]">TICK WORTH</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory/60">
            A curated house of fine Swiss and luxury timepieces — sourced, authenticated and
            delivered with the care each movement deserves.
          </p>
        </div>

        <FooterCol title="Collection">
          <FooterLink to="/shop">All watches</FooterLink>
          <FooterLink to="/shop?category=Diver">Diver</FooterLink>
          <FooterLink to="/shop?category=Chronograph">Chronograph</FooterLink>
          <FooterLink to="/shop?category=Dress">Dress</FooterLink>
        </FooterCol>

        <FooterCol title="Maison">
          <FooterLink to="/shop">New arrivals</FooterLink>
          <FooterLink to="/orders">My orders</FooterLink>
          <li className="text-ivory/60">Authenticity promise</li>
          <li className="text-ivory/60">Worldwide delivery</li>
        </FooterCol>

        <FooterCol title="Contact">
          <li>
            <a
              href={CONTACT.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ivory/60 transition-colors hover:text-gold"
            >
              WhatsApp · {CONTACT.phoneDisplay}
            </a>
          </li>
          <li>
            <a
              href={CONTACT.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ivory/60 transition-colors hover:text-gold"
            >
              Instagram · {CONTACT.instagramHandle}
            </a>
          </li>
          <li>
            <a
              href={CONTACT.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ivory/60 transition-colors hover:text-gold"
            >
              Facebook · {CONTACT.facebookHandle}
            </a>
          </li>
          <li>
            <Link to="/staff/login" className="text-ivory/40 transition-colors hover:text-gold">
              Staff portal
            </Link>
          </li>
        </FooterCol>
      </div>

      <div className="border-t border-ivory/10">
        <div className="section flex flex-col items-center justify-between gap-3 py-6 text-[0.7rem] uppercase tracking-wide2 text-ivory/40 sm:flex-row">
          <span>© {new Date().getFullYear()} Tick Worth Watches</span>
          <span>Swiss-sourced · Authenticated · Insured delivery</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-4 text-[0.7rem] uppercase tracking-wide2 text-gold">{title}</p>
      <ul className="space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-ivory/60 transition-colors hover:text-gold">
        {children}
      </Link>
    </li>
  );
}
