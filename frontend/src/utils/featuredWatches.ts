// Curated luxury pieces shown in the cold-start promo showcase (ServerWakeBanner).
// Images live in frontend/public/watches/<slug>/01.jpeg and are served by the frontend
// host (Vercel), so they load instantly even while the backend is still waking up.

export interface FeaturedWatch {
  slug: string;
  brand: string;
  name: string;
  tagline: string;
}

export const FEATURED_WATCHES: FeaturedWatch[] = [
  {
    slug: 'rolex-daytona',
    brand: 'Rolex',
    name: 'Cosmograph Daytona',
    tagline: 'The legendary chronograph born for the racetrack — engineered for those who measure life in seconds.',
  },
  {
    slug: 'patek-philippe-nautilus',
    brand: 'Patek Philippe',
    name: 'Nautilus',
    tagline: 'An icon of understated luxury since 1976. You never actually own one — you look after it for the next generation.',
  },
  {
    slug: 'audemars-piguet-royal-oak',
    brand: 'Audemars Piguet',
    name: 'Royal Oak',
    tagline: 'The watch that redefined haute horlogerie in steel, crowned by its unmistakable octagonal bezel.',
  },
  {
    slug: 'rolex-submariner',
    brand: 'Rolex',
    name: 'Submariner',
    tagline: 'The reference dive watch — equally at home in the deep and the boardroom.',
  },
  {
    slug: 'hublot-big-bang',
    brand: 'Hublot',
    name: 'Big Bang',
    tagline: 'A bold fusion of ceramic, rubber and audacious design — the art of standing apart.',
  },
  {
    slug: 'patek-philippe-calatrava',
    brand: 'Patek Philippe',
    name: 'Calatrava',
    tagline: 'Timeless round elegance — the very essence of the dress watch, refined to its purest form.',
  },
  {
    slug: 'rolex-gmt-master',
    brand: 'Rolex',
    name: 'GMT-Master',
    tagline: 'Two timezones, one unmistakable icon — built for the pilot and the perpetual traveller.',
  },
  {
    slug: 'hublot-classic-fusion',
    brand: 'Hublot',
    name: 'Classic Fusion',
    tagline: 'Minimalist sophistication with an avant-garde soul — restraint, beautifully engineered.',
  },
];
