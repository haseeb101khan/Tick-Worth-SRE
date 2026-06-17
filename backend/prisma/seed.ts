import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Roles/locations are stored as strings (validated at the API layer instead of as
// Prisma enums). Allowed values are documented in prisma/schema.prisma and enforced
// by Zod in src/utils/validators.ts.
type Role = 'CUSTOMER' | 'SHOPKEEPER' | 'WAREHOUSE_MANAGER' | 'OWNER';

const prisma = new PrismaClient();

// LIVE baseline seed. This wipes any prior demo/test data and stands up the real
// store: the owner account + the photographed catalogue. NOTE: this is intended to
// be run ONCE at go-live. Once the shop is operating on live data, do NOT re-run it —
// it would erase real orders, stock changes, reviews, and accounts. To change the
// catalogue later, update products in place instead.
//
// The owner account below covers owner + warehouse + shopkeeper duties (the OWNER
// role's dashboard includes every panel). The owner should change this password
// after first sign-in; we'll move secrets to env during the security phase.
const OWNER = {
  name: 'Haseeb Khan Asghar',
  email: 'haseeb.khanasghar100@gmail.com',
  role: 'OWNER' as Role,
  password: 'Haseeb@100$',
};

async function main() {
  console.log('Seeding LIVE baseline (removing any prior test data)...');

  // --- Clear ALL prior data (demo accounts, demo reviews, test orders, etc.) ---
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.stockRequest.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.damageReport.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // --- Owner account (real login) ---
  // Customers self-register on the storefront; staff are provisioned by the owner
  // from the User Management panel — so no other accounts are seeded.
  const passwordHash = await bcrypt.hash(OWNER.password, 10);
  await prisma.user.create({
    data: { name: OWNER.name, email: OWNER.email, role: OWNER.role, passwordHash, emailVerified: true },
  });

  // --- Products with starting stock ---
  // The real store catalogue is generated from the photographed inventory by
  // `prisma/import-watches.mjs`, which copies images into frontend/public/watches/
  // and writes watches.generated.json. imageUrl/images are served by the frontend
  // at /watches/<slug>/NN.jpeg. Re-run that script whenever the photo set changes.
  interface Variant {
    color: string;
    imageUrl: string;
    position: number;
  }
  interface CatalogEntry {
    slug: string;
    name: string;
    brand: string;
    category: string;
    priceCents: number;
    description: string;
    imageUrl: string;
    images: string[];
    specs: string[];
    variants: Variant[];
  }
  const catalog: CatalogEntry[] = JSON.parse(
    readFileSync(join(__dirname, 'watches.generated.json'), 'utf-8'),
  );

  for (const p of catalog) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        brand: p.brand,
        category: p.category,
        description: p.description,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        images: p.images,
        specs: p.specs,
        variants: { create: p.variants },
      },
    });

    // Modest starting inventory so the store is sellable at launch — the owner
    // adjusts real counts from the dashboard (Receive Stock / Transfers).
    const seed = product.id.charCodeAt(product.id.length - 1);
    const warehouse = 8 + (seed % 18);
    const shop = 2 + (seed % 7);

    await prisma.stock.createMany({
      data: [
        { productId: product.id, location: 'WAREHOUSE', quantity: warehouse, reorderLevel: 5 },
        { productId: product.id, location: 'SHOP', quantity: shop, reorderLevel: 3 },
        { productId: product.id, location: 'REPAIR', quantity: 0, reorderLevel: 0 },
      ],
    });
  }

  const variantTotal = catalog.reduce((s, p) => s + p.variants.length, 0);
  console.log(`Seeded ${catalog.length} products (${variantTotal} colour variants).`);
  console.log('Seed complete — LIVE baseline, no test data.');
  console.log(`Owner login: ${OWNER.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
