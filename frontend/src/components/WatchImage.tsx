import { useState } from 'react';
import { productImage } from '../utils/images';

interface Props {
  name: string;
  brand: string;
  /** The product's own image from the database. Takes precedence when present. */
  imageUrl?: string | null;
  /** Rendered width hint for the curated fallback image. */
  width?: number;
  className?: string;
  imgClassName?: string;
}

/**
 * Watch photography with a graceful, on-brand fallback: an ivory-on-charcoal
 * card showing the maker + model. The real photo fades in over it once loaded,
 * and removes itself on error — so the catalogue never shows a broken image.
 *
 * Source priority: the product's own `imageUrl` from the database → a curated
 * stock photo keyed by name → the text card. This keeps images data-driven:
 * whatever staff set on the product is what shows.
 */
export function WatchImage({ name, brand, imageUrl, width = 800, className = '', imgClassName = '' }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const src = imageUrl?.trim() ? imageUrl : productImage(name, width);

  return (
    <div className={`relative overflow-hidden bg-charcoal ${className}`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-charcoal to-ink px-4 text-center">
        <span className="font-serif text-3xl text-gold/70">{brand}</span>
        <span className="mt-2 text-[0.6rem] uppercase tracking-luxe text-stone">{name}</span>
      </div>
      {!failed && (
        <img
          key={src}
          src={src}
          alt={`${brand} ${name}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`relative h-full w-full object-cover transition-opacity duration-700 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
        />
      )}
    </div>
  );
}
