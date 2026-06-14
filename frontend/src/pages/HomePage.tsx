import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { getProducts } from '../services/productService';
import { ProductCard } from '../components/ProductCard';
import { Reveal } from '../components/Reveal';
import { heroImage, storyImage, ctaImage } from '../utils/images';
import { summariseBrands } from '../utils/brands';

const VALUES = [
  { title: 'Certified Authentic', body: 'Every timepiece is inspected and guaranteed genuine.' },
  { title: 'Insured Worldwide Delivery', body: 'Fully insured, white-glove shipping to your door.' },
  { title: 'Two-Year Warranty', body: 'Comprehensive cover on movement and craftsmanship.' },
  { title: 'Private Concierge', body: 'Personal guidance from our horology specialists.' },
];

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
  }

  // "Reach at your nearest location" — try the visitor's location, then open
  // Google Maps searching for nearby watch boutiques; fall back to our brand.
  function handleNearest() {
    const fallback = 'https://www.google.com/maps/search/Tick+Worth+watch+store+Pakistan';
    if (!navigator.geolocation) {
      window.open(fallback, '_blank', 'noopener');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        window.open(
          `https://www.google.com/maps/search/watch+store/@${pos.coords.latitude},${pos.coords.longitude},13z`,
          '_blank',
          'noopener',
        ),
      () => window.open(fallback, '_blank', 'noopener'),
      { timeout: 8000 },
    );
  }

  useEffect(() => {
    getProducts().then(setProducts).catch(() => undefined);
  }, []);

  // Allow /#brands (from the navbar) to scroll to the Shop by Brand section once
  // the products — and therefore the brand cards — have loaded.
  useEffect(() => {
    if (window.location.hash === '#brands' && products.length > 0) {
      document.getElementById('brands')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [products]);

  const featured = products.slice(0, 4);
  const brands = summariseBrands(products);

  return (
    <div className="bg-ivory">
      {/* HERO */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/55 to-ink/85" />
        <div className="section relative z-10 flex flex-col items-center text-center text-ivory animate-fadeUp">
          <span className="eyebrow">Maison of Fine Watchmaking</span>
          <h1 className="mt-6 max-w-4xl font-serif text-5xl font-light leading-[1.05] sm:text-6xl lg:text-7xl">
            The Art of Measured Time
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-ivory/70 sm:text-base">
            A curated collection of the world's most coveted timepieces — sourced, authenticated and
            presented for the discerning collector.
          </p>
          <form onSubmit={handleSearch} className="mt-10 flex w-full max-w-xl items-stretch gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by watch, brand or style…"
              aria-label="Search watches"
              className="flex-1 border border-ivory/30 bg-ivory/10 px-5 py-3 text-sm text-ivory placeholder:text-ivory/50 focus:border-gold focus:outline-none"
            />
            <button type="submit" className="btn-gold whitespace-nowrap">
              Search
            </button>
          </form>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link to="/shop" className="btn-ghost-light">
              Explore the Collection
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-[0.65rem] uppercase tracking-luxe text-ivory/50">
          Scroll to discover
        </div>
      </section>

      {/* VALUES */}
      <section className="border-b border-ink/10 bg-ivory">
        <div className="section grid grid-cols-2 gap-px lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 90} className="px-4 py-10 text-center">
              <p className="font-serif text-lg text-ink">{v.title}</p>
              <p className="mx-auto mt-2 max-w-[14rem] text-xs leading-relaxed text-stone">{v.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* BRAND MARQUEE */}
      {brands.length > 0 && (
        <section className="overflow-hidden border-y border-gold/20 bg-ink py-5">
          <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap pr-10 [animation-play-state:running] hover:[animation-play-state:paused]">
            {[...brands, ...brands].map((b, i) => (
              <Link
                key={`${b.slug}-${i}`}
                to={`/brand/${b.slug}`}
                className="flex items-center gap-10 font-serif text-xl tracking-[0.18em] text-ivory/55 transition-colors hover:text-gold"
              >
                {b.name}
                <span className="text-gold/60">✦</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* SHOP BY BRAND */}
      {brands.length > 0 && (
        <section id="brands" className="scroll-mt-20 bg-ink py-20 sm:py-28">
          <div className="section">
            <Reveal className="mb-14 flex flex-col items-center text-center text-ivory">
              <span className="eyebrow">By Maison</span>
              <h2 className="mt-4 font-serif text-4xl font-light sm:text-5xl">Shop by Brand</h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-ivory/60">
                From haute horology to everyday companions — explore each maison and the models it offers.
              </p>
            </Reveal>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {brands.map((b, i) => (
                <Reveal key={b.slug} delay={(i % 4) * 80}>
                <Link
                  to={`/brand/${b.slug}`}
                  className="card-lift img-zoom relative block aspect-square bg-charcoal"
                >
                  {b.image && (
                    <img
                      src={b.image}
                      alt={b.name}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-90"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-transparent" />
                  <div className="absolute inset-0 flex flex-col items-center justify-end p-4 text-center text-ivory">
                    <span className="font-serif text-lg leading-tight sm:text-xl">{b.name}</span>
                    <span className="mt-1 text-[0.55rem] uppercase tracking-wide2 text-gold/80">
                      {b.modelCount} {b.modelCount > 1 ? 'models' : 'model'}
                    </span>
                  </div>
                </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FEATURED */}
      <section className="section py-20 sm:py-28">
        <Reveal className="mb-14 flex flex-col items-center text-center">
          <span className="eyebrow">Curated Selection</span>
          <h2 className="mt-4 font-serif text-4xl font-light text-ink sm:text-5xl">Featured Timepieces</h2>
          <div className="rule-gold mt-6" />
        </Reveal>
        <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 90}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link to="/shop" className="btn-outline border-ink/30 text-ink hover:bg-ink hover:text-ivory">
            View the Full Collection
          </Link>
        </div>
      </section>

      {/* REACH — nearest location, over the Pakistan landmarks skyline */}
      <section className="overflow-hidden bg-white pt-20 pb-12 sm:pt-24">
        <div className="section">
          <Reveal className="flex flex-col items-center text-center">
            <span className="eyebrow">Across Pakistan</span>
            <h2 className="mt-4 font-serif text-4xl font-light text-ink sm:text-5xl">
              Reach at your nearest location
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone">
              From Karachi to Lahore to Islamabad — find Tick Worth at a boutique near you.
            </p>
            <button type="button" onClick={handleNearest} className="btn-dark mt-8">
              GO
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
            </button>
          </Reveal>
        </div>
        <Reveal className="mt-10" delay={120}>
          <img
            src="/pakistan-skyline.jpeg"
            alt="Pakistan — land of beauty, heritage & pride"
            loading="lazy"
            className="mx-auto w-full max-w-7xl px-5 sm:px-8"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </Reveal>
      </section>

      {/* STORY */}
      <section className="grid items-stretch lg:grid-cols-2">
        <div className="min-h-[26rem] bg-charcoal">
          <img src={storyImage} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="flex items-center bg-ink px-8 py-20 text-ivory sm:px-16">
          <Reveal className="max-w-lg">
            <span className="eyebrow">Our Promise</span>
            <h2 className="mt-5 font-serif text-4xl font-light leading-tight sm:text-5xl">
              Every second, considered.
            </h2>
            <p className="mt-6 text-sm leading-relaxed text-ivory/65">
              At Tick Worth, a watch is never merely a purchase. Each piece is hand-selected by our
              specialists, verified for authenticity, and accompanied by a complete service history —
              so the only thing you inherit is its story.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ivory/65">
              From the warehouse to the boutique floor, every movement is cared for by people who
              love watches as much as you do.
            </p>
            <Link to="/shop" className="btn-outline mt-10">
              Begin Your Collection
            </Link>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <img src={ctaImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink/75" />
        <Reveal className="section relative z-10 flex flex-col items-center py-24 text-center text-ivory">
          <h2 className="max-w-2xl font-serif text-4xl font-light sm:text-5xl">
            Find the watch that keeps your time.
          </h2>
          <Link to="/shop" className="btn-gold mt-10">
            Explore the Collection
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
