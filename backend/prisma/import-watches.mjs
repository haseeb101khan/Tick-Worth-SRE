// Scans the project's `Watches/` folder, copies every image into the frontend's
// public assets, and generates `watches.generated.json` — a ready-to-seed catalogue
// where each "model" folder (M1, M2, "curren M1", "rolex 1", …) becomes one product
// with a primary image + a gallery of the remaining angles.
//
// Run from the backend dir:  node prisma/import-watches.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../'); // project root: "tick.worth SRE"
const SRC = path.join(ROOT, 'Watches');
const PUBLIC_DIR = path.join(ROOT, 'frontend', 'public', 'watches');
const MANIFEST = path.join(__dirname, 'watches.generated.json');

const IMG_RE = /\.(jpe?g|png|webp|avif)$/i;

// ---- Brand knowledge: display name, category, price band (cents), collections, blurb ----
const BRANDS = {
  rolex:            { display: 'Rolex',            category: 'Luxury Sport', price: [16000, 30000], collections: ['Oyster Perpetual', 'Datejust', 'Submariner', 'Daytona', 'GMT-Master', 'Sea-Dweller'], blurb: 'A name synonymous with achievement, Rolex has defined precision watchmaking for over a century.' },
  audemars:         { display: 'Audemars Piguet',  category: 'Luxury Sport', price: [18000, 32000], collections: ['Royal Oak', 'Royal Oak Offshore', 'Jules Audemars', 'Code 11.59'], blurb: 'In the hands of its founding families since 1875, Audemars Piguet remains a master of the luxury sports watch.' },
  patek:            { display: 'Patek Philippe',   category: 'Luxury',       price: [18000, 34000], collections: ['Nautilus', 'Aquanaut', 'Calatrava', 'Grand Complications', 'Twenty~4'], blurb: 'Patek Philippe crafts heirlooms — you never truly own one, you merely look after it for the next generation.' },
  hublot:           { display: 'Hublot',           category: 'Luxury Sport', price: [15000, 28000], collections: ['Big Bang', 'Classic Fusion', 'Spirit of Big Bang', 'MP Collection'], blurb: "Hublot's art of fusion marries unexpected materials into bold, contemporary statements." },
  tissot:           { display: 'Tissot',           category: 'Swiss Classic', price: [9000, 18000], collections: ['Le Locle', 'PRX', 'Gentleman', 'Chrono XL'], blurb: 'Swiss since 1853, Tissot pairs genuine watchmaking heritage with accessible elegance.' },
  seastar:          { display: 'Seastar',          category: 'Diver',        price: [8000, 14000], collections: ['Diver 300', 'Abyss', 'Reef'], blurb: 'Built for the water, Seastar dive watches balance rugged capability with clean design.' },
  benyar:           { display: 'Benyar',           category: 'Chronograph',  price: [5500, 9500],  collections: ['Aviator', 'Pilot Chrono', 'Skyhawk'], blurb: 'Benyar blends aviator-inspired styling with chronograph function for the modern adventurer.' },
  sveston:          { display: 'Sveston',          category: 'Chronograph',  price: [5500, 9500],  collections: ['Racer', 'Aviator', 'Velocity'], blurb: 'Sveston brings motorsport energy to the wrist with bold chronograph design.' },
  matturi:          { display: 'Matturi',          category: 'Luxury',       price: [7000, 13000], collections: ['Heritage', 'Imperial', 'Noir'], blurb: 'Matturi composes statement timepieces for those who dress with intent.' },
  universe:         { display: 'Universe Point',   category: 'Fashion',      price: [4500, 8500],  collections: ['Cosmos', 'Orbit', 'Stellar', 'Nova'], blurb: 'Universe Point explores contemporary design with a fashion-forward spirit.' },
  bestwin:          { display: 'Bestwin',          category: 'Fashion',      price: [4000, 7500],  collections: ['Classic', 'Urban', 'Sport'], blurb: 'Bestwin delivers clean, versatile design made for everyday rotation.' },
  forsinning:       { display: 'Forsinning',       category: 'Automatic',    price: [6000, 11000], collections: ['Skeleton', 'Openwork', 'Tourbillon'], blurb: 'Forsinning showcases the mechanical art of the skeleton dial, gears in open view.' },
  fitron:           { display: 'Fitron',           category: 'Classic',      price: [5000, 9000],  collections: ['Heritage', 'Royale'], blurb: 'Fitron offers classic dress sensibility with quiet, dependable charm.' },
  successway:       { display: 'Successway',       category: 'Fashion',      price: [4500, 8000],  collections: ['Executive', 'Metropolitan'], blurb: 'Successway dresses the ambitious wrist with sharp, executive lines.' },
  'x-tl.ok':        { display: 'X-TL.OK',          category: 'Sport',        price: [3500, 6500],  collections: ['Active', 'Tactical'], blurb: 'X-TL.OK is built for movement — sporty, resilient, ready for anything.' },
  reward:           { display: 'Reward',           category: 'Minimalist',   price: [4000, 7000],  collections: ['Minimal', 'Slate', 'Linea'], blurb: 'Reward strips watch design to its essentials: clean dials and honest proportions.' },
  curren:           { display: 'Curren',           category: 'Fashion',      price: [3000, 5500],  collections: ['Allure', 'Petite', 'Charm'], blurb: 'Curren designs elegant, on-trend timepieces with an eye for detail.' },
  guess:            { display: 'Guess',            category: 'Fashion',      price: [6000, 11000], collections: ['Glamour', 'Soirée', 'Sparkle'], blurb: 'Guess turns the everyday into a statement with glamorous, fashion-led design.' },
  ieke:             { display: 'IEKE',             category: 'Fashion',      price: [2500, 5000],  collections: ['Petite', 'Charm'], blurb: 'IEKE crafts delicate, feminine watches with refined detailing.' },
  jarvinia:         { display: 'Jarvinia',         category: 'Fashion',      price: [2500, 4500],  collections: ['Bloom', 'Grace'], blurb: 'Jarvinia celebrates graceful design made for the modern woman.' },
  swister:          { display: 'Swister',          category: 'Fashion',      price: [3500, 6000],  collections: ['Élan', 'Vivo'], blurb: 'Swister blends playful character with contemporary styling.' },
  skmei:            { display: 'SKMEI',            category: 'Digital',      price: [1800, 4000],  collections: ['Digital', 'Active', 'Tactical'], blurb: 'SKMEI fuses digital function with sporty, youthful design.' },
  alfajr:           { display: 'Al-Fajr',          category: 'Digital',      price: [3000, 6000],  collections: ['Prayer', 'Deluxe'], blurb: 'Al-Fajr is trusted worldwide for its prayer-time watches, blending faith and function.' },
};

// Rotating spec fragments — keep descriptions varied and on-brand without repeating.
const CASES = [
  'a 41mm case in surgical-grade stainless steel',
  'a 42mm case finished and brushed by hand',
  'a 40mm case beneath a sapphire-coated crystal',
  'a 44mm case with a screw-down crown',
  'a 39mm case in mirror-polished steel',
  'a 43mm case with an exhibition caseback',
  'a 36mm case with a slim, wearable profile',
];
const MOVES = [
  'Driven by a self-winding mechanical movement',
  'Powered by a precision quartz movement',
  'At its heart, an automatic movement with a visible rotor',
  'A dependable movement keeps faultless time',
];
const WR = [
  'water-resistant to 50 metres',
  'water-resistant to 100 metres',
  'sealed confidently against rain and splashes',
  'engineered to take everyday wear in its stride',
];
const CLOSERS = [
  'A piece that wears its confidence quietly.',
  'Considered, capable, and unmistakably modern.',
  'Equal parts instrument and statement.',
  'Made for the wrist that notices the details.',
  'Timeless proportions with a contemporary attitude.',
  'Designed to be lived in, not just admired.',
];

// Plausible demo colourways — each photo inside a model folder becomes one of
// these (staff rename to the true colour later). Ordered so the first few read well.
const COLORS = [
  'Classic Black', 'Silver Steel', 'Rose Gold', 'Two-Tone Gold', 'Midnight Blue',
  'Forest Green', 'Tan Leather', 'Gunmetal', 'Champagne', 'Ivory White',
  'Burgundy', 'Slate Grey', 'Royal Blue', 'Bronze', 'Pearl',
];

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function pick(arr, n) { return arr[(((n % arr.length) + arr.length) % arr.length)]; }
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function titleCase(s) { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }

// Walk a dir, return all image file paths (recursive).
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (IMG_RE.test(entry.name)) out.push(full);
  }
  return out;
}

// Natural sort so "1 (2)" comes before "1 (10)".
function natCmp(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// ---- Identify brand + collection from a top folder and a leaf token ----
function resolveBrandKey(token) {
  const t = token.toLowerCase();
  const compact = t.replace(/[^a-z0-9.]/g, ''); // "success way" -> "successway"
  for (const key of Object.keys(BRANDS)) {
    if (t.includes(key) || compact.includes(key)) return key;
  }
  if (compact.includes('alfajr')) return 'alfajr';
  if (compact.includes('matturi') || compact.includes('maturi')) return 'matturi';
  return null;
}

function topFolderToBrandKey(top) {
  // "Rolex watches" -> "rolex", "Patek philippe watches" -> "patek", etc.
  const cleaned = top.toLowerCase().replace(/watches?/g, '').trim();
  return resolveBrandKey(cleaned) ?? resolveBrandKey(top);
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`No Watches folder found at ${SRC}`);
    process.exit(1);
  }

  // Reset the public output folder.
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const files = walk(SRC);

  // ---- Group files into models ----
  /** @type {Map<string, {top:string, leaf:string, files:string[], forceCategory?:string}>} */
  const groups = new Map();

  for (const file of files) {
    const rel = path.relative(SRC, file);
    const segs = rel.split(path.sep);
    const top = segs[0];
    const parent = path.dirname(file);
    const base = path.basename(parent);

    let key, leaf, forceCategory;

    if (base.toLowerCase() === 'luxury watches') {
      // Loose cover images that duplicate the "luxury diff models" galleries — skip.
      continue;
    } else if (base.toLowerCase() === 'luxury diff models') {
      // Flat folder; subgroup by filename prefix e.g. "audemars 1 (3).jpeg" -> "audemars 1".
      const name = path.basename(file).replace(IMG_RE, '');
      const prefix = name.replace(/\s*\(\d+\)\s*$/, '').trim();
      key = parent + '::' + prefix;
      leaf = prefix;
      forceCategory = 'Luxury Sport';
    } else {
      key = parent;
      leaf = base;
      if (top.toLowerCase().startsWith('female')) forceCategory = "Women's";
      else if (top.toLowerCase().startsWith('automatic')) forceCategory = 'Automatic';
    }

    if (!groups.has(key)) groups.set(key, { top, leaf, files: [], forceCategory });
    groups.get(key).files.push(file);
  }

  // ---- Build products ----
  const products = [];
  const usedNames = new Set();
  const perBrandCount = {};

  for (const [, g] of [...groups.entries()].sort((a, b) => natCmp(a[0], b[0]))) {
    g.files.sort(natCmp);

    // Brand: from the leaf token for Female/Automatic/luxury, else from the top folder.
    let brandKey = resolveBrandKey(g.leaf) ?? topFolderToBrandKey(g.top);
    if (!brandKey) { console.warn(`! Could not resolve brand for "${g.top} / ${g.leaf}" — skipping`); continue; }
    const profile = BRANDS[brandKey];

    const idx = (perBrandCount[brandKey] = (perBrandCount[brandKey] ?? 0) + 1) - 1;
    const seed = hash(g.top + '|' + g.leaf);

    const collection = pick(profile.collections, idx);
    const category = g.forceCategory ?? profile.category;

    // Unique product name (brand + collection, deduped with a reference suffix).
    let name = collection;
    let n = 2;
    while (usedNames.has(brandKey + '|' + name)) name = `${collection} ${toRoman(n++)}`;
    usedNames.add(brandKey + '|' + name);

    // Price: deterministic within the brand's band, rounded to the nearest $5.
    const [lo, hi] = profile.price;
    const priceCents = Math.round((lo + (seed % (hi - lo + 1))) / 500) * 500;

    // Copy images into public/watches/<slug>/NN.ext
    const slug = slugify(`${profile.display}-${name}`);
    const destDir = path.join(PUBLIC_DIR, slug);
    fs.mkdirSync(destDir, { recursive: true });
    const urls = g.files.map((src, i) => {
      const ext = path.extname(src).toLowerCase();
      const fname = String(i + 1).padStart(2, '0') + ext;
      fs.copyFileSync(src, path.join(destDir, fname));
      return `/watches/${slug}/${fname}`;
    });

    // Each photo is a colour option for this model. Names are deduped so a model
    // with many photos doesn't repeat a colour label.
    const usedColors = new Set();
    const variants = urls.map((url, i) => {
      let color = COLORS[i % COLORS.length];
      let c = 2;
      while (usedColors.has(color)) color = `${COLORS[i % COLORS.length]} ${c++}`;
      usedColors.add(color);
      return { color, imageUrl: url, position: i };
    });

    const description =
      `${profile.blurb} The ${collection} presents ${pick(CASES, seed)}, ${pick(WR, seed >>> 3)}. ` +
      `${pick(MOVES, seed >>> 6)}, it is finished to a standard that belies its price. ${pick(CLOSERS, seed >>> 9)}`;

    products.push({
      slug,
      name,
      brand: profile.display,
      category,
      priceCents,
      description,
      imageUrl: urls[0],
      images: urls.slice(1),
      variants,
      imageCount: urls.length,
    });
  }

  products.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
  fs.writeFileSync(MANIFEST, JSON.stringify(products, null, 2));

  const totalImgs = products.reduce((s, p) => s + p.imageCount, 0);
  console.log(`Imported ${products.length} models / ${totalImgs} colour variants -> ${path.relative(ROOT, PUBLIC_DIR)}`);
  console.log(`Manifest -> ${path.relative(ROOT, MANIFEST)}`);
  const byBrand = {};
  for (const p of products) byBrand[p.brand] = (byBrand[p.brand] ?? 0) + 1;
  console.log('By brand:', Object.entries(byBrand).map(([b, c]) => `${b} (${c})`).join(', '));
}

function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

main();
