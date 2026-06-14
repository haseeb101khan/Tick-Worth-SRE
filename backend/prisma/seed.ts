import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Roles/locations are stored as strings (validated at the API layer instead of as
// Prisma enums). Allowed values are documented in prisma/schema.prisma and enforced
// by Zod in src/utils/validators.ts.
type Role = 'CUSTOMER' | 'SHOPKEEPER' | 'WAREHOUSE_MANAGER' | 'OWNER';

const prisma = new PrismaClient();

// Demo password for ALL seeded accounts (document this in the README).
const DEMO_PASSWORD = 'password123';

async function main() {
  console.log('Seeding database...');

  // --- Clear existing data (safe to re-run) ---
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

  // --- Couriers (delivery personnel — contact records, not login accounts) ---
  await prisma.courier.createMany({
    data: [
      { name: 'Dan Wheeler', phone: '+1-555-0101', email: 'dan.wheeler@swiftship.test' },
      { name: 'Priya Nair', phone: '+1-555-0102', email: 'priya.nair@swiftship.test' },
      { name: 'Marco Reyes', phone: '+1-555-0103', email: 'marco.reyes@swiftship.test' },
    ],
  });

  // --- Users: one of every role ---
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: { name: string; email: string; role: Role }[] = [
    { name: 'Alice Customer', email: 'customer@tickworth.test', role: 'CUSTOMER' },
    { name: 'Sam Shopkeeper', email: 'shop@tickworth.test', role: 'SHOPKEEPER' },
    { name: 'Wendy Warehouse', email: 'warehouse@tickworth.test', role: 'WAREHOUSE_MANAGER' },
    { name: 'Olivia Owner', email: 'owner@tickworth.test', role: 'OWNER' },
  ];
  for (const u of users) {
    await prisma.user.create({ data: { ...u, passwordHash } });
  }

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
    variants: Variant[];
  }
  const catalog: CatalogEntry[] = JSON.parse(
    readFileSync(join(__dirname, 'watches.generated.json'), 'utf-8'),
  );

  // Demo the two out-of-stock flows on real products (prices/quantities are
  // placeholders — staff adjust them in the dashboard later):
  //  - PREBOOK: out in the SHOP but stocked in the WAREHOUSE (can be pulled in).
  //  - REQUEST: out everywhere (interest only — no promise).
  const prebookSlug = catalog.find((p) => p.brand === 'Seastar')?.slug ?? catalog[0]?.slug;
  const requestSlug = catalog.find((p) => p.brand === 'SKMEI')?.slug ?? catalog[1]?.slug;

  const firstProductByBrand = new Map<string, string>(); // brand -> a productId (for demo reviews)

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
        variants: { create: p.variants },
      },
    });

    if (!firstProductByBrand.has(p.brand)) firstProductByBrand.set(p.brand, product.id);

    // Deterministic-but-varied starting stock so the storefront looks alive.
    const seed = product.id.charCodeAt(product.id.length - 1);
    let warehouse = 8 + (seed % 18);
    let shop = 2 + (seed % 7);
    if (p.slug === prebookSlug) { warehouse = 15; shop = 0; }
    else if (p.slug === requestSlug) { warehouse = 0; shop = 0; }

    await prisma.stock.createMany({
      data: [
        { productId: product.id, location: 'WAREHOUSE', quantity: warehouse, reorderLevel: 5 },
        { productId: product.id, location: 'SHOP', quantity: shop, reorderLevel: 3 },
        { productId: product.id, location: 'REPAIR', quantity: 0, reorderLevel: 0 },
      ],
    });
  }
  const variantTotal = catalog.reduce((s, p) => s + p.variants.length, 0);
  console.log(`Seeded ${catalog.length} models with ${variantTotal} colour variants.`);

  // --- Demo reviews ---------------------------------------------------------
  // Display-only reviewers so the storefront shows star ratings out of the box.
  // Real customer reviews are gated behind a DELIVERED order (see review.service);
  // these are seeded directly purely for preview.
  const reviewers = [
    { name: 'James Whitfield', email: 'james.whitfield@example.com' },
    { name: 'Sofia Marin', email: 'sofia.marin@example.com' },
    { name: 'Daniel Osei', email: 'daniel.osei@example.com' },
    { name: 'Priya Kapoor', email: 'priya.kapoor@example.com' },
  ];
  const reviewerIds: string[] = [];
  for (const r of reviewers) {
    const u = await prisma.user.create({ data: { ...r, role: 'CUSTOMER', passwordHash } });
    reviewerIds.push(u.id);
  }

  const reviewLines: [number, string][] = [
    [5, 'Exceptional craftsmanship — feels far above its price. Wears beautifully every day.'],
    [4, 'Gorgeous on the wrist and keeps great time. The strap took a few days to break in.'],
    [5, 'Arrived impeccably packaged. The dial detail is stunning in person.'],
    [4, 'Solid weight and clean finishing. Very happy with the purchase.'],
    [5, 'Compliments everywhere I go. Would absolutely buy from Tick Worth again.'],
    [5, 'Better than I expected from the photos. Crisp, legible, and elegant.'],
  ];
  const reviewBrands = ['Rolex', 'Hublot', 'Patek Philippe', 'Audemars Piguet'];
  let li = 0;
  let reviewCount = 0;
  for (const brand of reviewBrands) {
    const productId = firstProductByBrand.get(brand);
    if (!productId) continue;
    const n = 2 + (reviewCount % 2); // 2–3 reviews per featured model
    for (let k = 0; k < n; k++) {
      const [rating, comment] = reviewLines[li % reviewLines.length];
      await prisma.review.create({
        data: { productId, customerId: reviewerIds[li % reviewerIds.length], rating, comment },
      });
      li++;
      reviewCount++;
    }
  }
  console.log(`Seeded ${reviewCount} demo reviews from ${reviewers.length} reviewers.`);

  console.log('Seed complete.');
  console.log(`Demo accounts (password: "${DEMO_PASSWORD}"):`);
  users.forEach((u) => console.log(`  ${u.role.padEnd(18)} ${u.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
