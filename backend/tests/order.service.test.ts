import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/prisma';
import { placeOrder, cancelOrder, updateOrderStatus } from '../src/services/order.service';
import { transferStock } from '../src/services/transfer.service';
import { createDamageReport, updateDamageReport } from '../src/services/damage.service';
import { BadRequestError, ConflictError } from '../src/utils/errors';

let customerId: string;
let staffId: string;
let productId: string;
let courierId: string;

async function qty(location: string) {
  const stock = await prisma.stock.findUnique({
    where: { productId_location: { productId, location } },
  });
  return stock!.quantity;
}

beforeEach(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.damageReport.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const customer = await prisma.user.create({
    data: { name: 'Cust', email: 'c@test.local', passwordHash: 'x', role: 'CUSTOMER' },
  });
  const staff = await prisma.user.create({
    data: { name: 'Staff', email: 's@test.local', passwordHash: 'x', role: 'SHOPKEEPER' },
  });
  const product = await prisma.product.create({
    data: { name: 'Test Watch', brand: 'Acme', category: 'Diver', priceCents: 10000 },
  });
  await prisma.stock.createMany({
    data: [
      { productId: product.id, location: 'WAREHOUSE', quantity: 10, reorderLevel: 5 },
      { productId: product.id, location: 'SHOP', quantity: 5, reorderLevel: 2 },
      { productId: product.id, location: 'REPAIR', quantity: 0, reorderLevel: 0 },
    ],
  });
  const courier = await prisma.courier.create({
    data: { name: 'Test Rider', phone: '+1-555-0000' },
  });
  customerId = customer.id;
  staffId = staff.id;
  productId = product.id;
  courierId = courier.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('placeOrder', () => {
  it('decrements SHOP stock, computes server-side total, writes a SALE movement', async () => {
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      shippingAddress: '1 Test St',
      items: [{ productId, quantity: 2 }],
    });

    expect(order.status).toBe('PENDING');
    expect(order.totalCents).toBe(20000); // 2 × 10000, never from client input
    expect(await qty('SHOP')).toBe(3);

    const movements = await prisma.stockMovement.findMany({ where: { referenceId: order.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'SALE', fromLocation: 'SHOP', quantity: 2 });
  });

  it('throws ConflictError and rolls back everything when stock is insufficient', async () => {
    await expect(
      placeOrder(customerId, {
        channel: 'ONLINE',
        paymentMethod: 'COD',
        items: [{ productId, quantity: 99 }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await qty('SHOP')).toBe(5);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it('rolls back earlier line decrements if a later line fails', async () => {
    const second = await prisma.product.create({
      data: { name: 'Out of Stock', brand: 'Acme', category: 'Dress', priceCents: 5000 },
    });
    await prisma.stock.create({
      data: { productId: second.id, location: 'SHOP', quantity: 0, reorderLevel: 1 },
    });

    await expect(
      placeOrder(customerId, {
        channel: 'ONLINE',
        paymentMethod: 'COD',
        items: [
          { productId, quantity: 2 }, // would succeed alone
          { productId: second.id, quantity: 1 }, // fails — whole tx must roll back
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await qty('SHOP')).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });

  it('creates STORE orders as DELIVERED with payment confirmed', async () => {
    const order = await placeOrder(customerId, {
      channel: 'STORE',
      paymentMethod: 'COD',
      items: [{ productId, quantity: 1 }],
    });
    expect(order.status).toBe('DELIVERED');
    expect(order.paymentConfirmed).toBe(true);
  });

  it('emits a LOW_STOCK notification to staff when crossing the reorder level', async () => {
    // SHOP 5, reorder 2: ordering 3 lands exactly on the level (5→2, crossing).
    await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      items: [{ productId, quantity: 3 }],
    });
    const notifs = await prisma.notification.findMany({ where: { userId: staffId } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('LOW_STOCK');

    // A further sale while already below must NOT re-alert.
    await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      items: [{ productId, quantity: 1 }],
    });
    expect(await prisma.notification.count({ where: { userId: staffId } })).toBe(1);
  });
});

describe('order status + cancel', () => {
  it('follows PENDING→PAID→DISPATCHED→DELIVERED and rejects skips', async () => {
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      items: [{ productId, quantity: 1 }],
    });

    await expect(updateOrderStatus(order.id, 'DELIVERED')).rejects.toBeInstanceOf(ConflictError);

    const paid = await updateOrderStatus(order.id, 'PAID');
    expect(paid!.paymentConfirmed).toBe(true);
    const dispatched = await updateOrderStatus(order.id, 'DISPATCHED', courierId);
    expect(dispatched!.courierId).toBe(courierId);
    const done = await updateOrderStatus(order.id, 'DELIVERED');
    expect(done!.status).toBe('DELIVERED');
  });

  it('cancel restores SHOP stock and writes a RETURN movement', async () => {
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      items: [{ productId, quantity: 2 }],
    });
    expect(await qty('SHOP')).toBe(3);

    const cancelled = await cancelOrder(order.id, { id: customerId, role: 'CUSTOMER' });
    expect(cancelled!.status).toBe('CANCELLED');
    expect(await qty('SHOP')).toBe(5);

    const returns = await prisma.stockMovement.findMany({
      where: { referenceId: order.id, type: 'RETURN' },
    });
    expect(returns).toHaveLength(1);
    expect(returns[0]).toMatchObject({ toLocation: 'SHOP', quantity: 2 });
  });

  it('refuses to cancel after DISPATCHED and refuses double-cancel', async () => {
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      items: [{ productId, quantity: 1 }],
    });
    await updateOrderStatus(order.id, 'PAID');
    await updateOrderStatus(order.id, 'DISPATCHED', courierId);

    await expect(cancelOrder(order.id, { id: staffId, role: 'SHOPKEEPER' })).rejects.toBeInstanceOf(
      ConflictError,
    );

    const order2 = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      items: [{ productId, quantity: 1 }],
    });
    await cancelOrder(order2.id, { id: customerId, role: 'CUSTOMER' });
    await expect(
      cancelOrder(order2.id, { id: customerId, role: 'CUSTOMER' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("blocks customers from cancelling someone else's order", async () => {
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      items: [{ productId, quantity: 1 }],
    });
    const stranger = await prisma.user.create({
      data: { name: 'Other', email: 'o@test.local', passwordHash: 'x', role: 'CUSTOMER' },
    });
    await expect(cancelOrder(order.id, { id: stranger.id, role: 'CUSTOMER' })).rejects.toThrow(
      /own orders/,
    );
    expect(await qty('SHOP')).toBe(4); // nothing restored
  });
});

describe('delivery + couriers', () => {
  it('assigns a sequential order number and adds the EXPRESS delivery fee', async () => {
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      deliveryMethod: 'EXPRESS',
      shippingAddress: '1 Fast Ln',
      items: [{ productId, quantity: 1 }],
    });
    expect(order.orderNumber).toMatch(/^TW-\d{6}$/);
    expect(order.deliveryFeeCents).toBeGreaterThan(0);
    // total = item price (10000) + delivery fee
    expect(order.totalCents).toBe(10000 + order.deliveryFeeCents);
  });

  it('blocks dispatch of a delivery order without a courier, then attaches one', async () => {
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      deliveryMethod: 'STANDARD',
      shippingAddress: '1 Test St',
      items: [{ productId, quantity: 1 }],
    });
    await updateOrderStatus(order.id, 'PAID');
    await expect(updateOrderStatus(order.id, 'DISPATCHED')).rejects.toBeInstanceOf(BadRequestError);

    const dispatched = await updateOrderStatus(order.id, 'DISPATCHED', courierId);
    expect(dispatched!.courierId).toBe(courierId);
  });

  it('refuses to dispatch with an inactive courier', async () => {
    await prisma.courier.update({ where: { id: courierId }, data: { active: false } });
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      deliveryMethod: 'STANDARD',
      shippingAddress: '1 Test St',
      items: [{ productId, quantity: 1 }],
    });
    await updateOrderStatus(order.id, 'PAID');
    await expect(updateOrderStatus(order.id, 'DISPATCHED', courierId)).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('lets a PICKUP order dispatch without a courier', async () => {
    const order = await placeOrder(customerId, {
      channel: 'ONLINE',
      paymentMethod: 'COD',
      deliveryMethod: 'PICKUP',
      items: [{ productId, quantity: 1 }],
    });
    expect(order.deliveryFeeCents).toBe(0);
    await updateOrderStatus(order.id, 'PAID');
    const dispatched = await updateOrderStatus(order.id, 'DISPATCHED');
    expect(dispatched!.status).toBe('DISPATCHED');
    expect(dispatched!.courierId).toBeNull();
  });
});

describe('transferStock', () => {
  it('moves quantity between locations and writes one TRANSFER movement', async () => {
    await transferStock({ productId, from: 'WAREHOUSE', to: 'SHOP', qty: 4 }, staffId);

    expect(await qty('WAREHOUSE')).toBe(6);
    expect(await qty('SHOP')).toBe(9);

    const movements = await prisma.stockMovement.findMany({ where: { type: 'TRANSFER' } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ fromLocation: 'WAREHOUSE', toLocation: 'SHOP', quantity: 4 });
  });

  it('rejects transfers that exceed available stock (guarded decrement)', async () => {
    await expect(
      transferStock({ productId, from: 'SHOP', to: 'REPAIR', qty: 99 }, staffId),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await qty('SHOP')).toBe(5);
    expect(await qty('REPAIR')).toBe(0);
    expect(await prisma.stockMovement.count()).toBe(0);
  });
});

describe('damage / repair lifecycle', () => {
  it('damage report moves units SHOP→REPAIR with a DAMAGE movement', async () => {
    const report = await createDamageReport(
      { productId, location: 'SHOP', quantity: 2, description: 'cracked crystal' },
      staffId,
    );
    expect(report.status).toBe('REPORTED');
    expect(await qty('SHOP')).toBe(3);
    expect(await qty('REPAIR')).toBe(2);

    const movements = await prisma.stockMovement.findMany({ where: { referenceId: report.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'DAMAGE', fromLocation: 'SHOP', toLocation: 'REPAIR' });
  });

  it('REPAIRED moves units back REPAIR→SHOP with a REPAIR_DONE movement', async () => {
    const report = await createDamageReport(
      { productId, location: 'SHOP', quantity: 2, description: 'cracked crystal' },
      staffId,
    );
    await updateDamageReport(report.id, 'IN_REPAIR', staffId);
    const done = await updateDamageReport(report.id, 'REPAIRED', staffId);

    expect(done!.status).toBe('REPAIRED');
    expect(await qty('REPAIR')).toBe(0);
    expect(await qty('SHOP')).toBe(5);

    const repairDone = await prisma.stockMovement.findMany({
      where: { referenceId: report.id, type: 'REPAIR_DONE' },
    });
    expect(repairDone).toHaveLength(1);
  });

  it('SCRAPPED writes the units off (they leave REPAIR and land nowhere)', async () => {
    const report = await createDamageReport(
      { productId, location: 'SHOP', quantity: 1, description: 'beyond repair' },
      staffId,
    );
    await updateDamageReport(report.id, 'SCRAPPED', staffId);

    expect(await qty('REPAIR')).toBe(0);
    expect(await qty('SHOP')).toBe(4);
  });

  it('rejects invalid repair transitions', async () => {
    const report = await createDamageReport(
      { productId, location: 'SHOP', quantity: 1, description: 'scratch' },
      staffId,
    );
    await expect(updateDamageReport(report.id, 'REPAIRED', staffId)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
