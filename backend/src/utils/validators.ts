import { z } from 'zod';

// Shared Zod schemas. Reuse these on the frontend too if you copy the file across.

// Public self-registration is ALWAYS a customer — there is intentionally no `role`
// field here. Staff accounts are provisioned by the owner (see createStaffSchema).
export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

// Roles the owner can assign when provisioning an internal account. CUSTOMER is
// excluded — customers self-register; the owner only creates staff.
export const staffRoleSchema = z.enum(['SHOPKEEPER', 'WAREHOUSE_MANAGER', 'OWNER']);

export const createStaffSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: staffRoleSchema,
});

export const updateStaffSchema = z
  .object({
    role: staffRoleSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.active !== undefined, {
    message: 'Provide role and/or active',
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

// An image is either an http(s) link or an uploaded image as a data: URL.
const imageUrlSchema = z
  .string()
  .refine((v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v), {
    message: 'Image must be an http(s) link or an uploaded image',
  });

export const createProductSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  imageUrl: imageUrlSchema.optional(),
});

// A customer leaving (or updating) a product review: 1–5 stars + an optional comment.
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

// Editing an existing product: every field optional, but at least one required.
// imageUrl accepts a link/upload, or an empty string to clear it back to the fallback art.
export const updateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    description: z.string().optional(),
    priceCents: z.number().int().positive().optional(),
    imageUrl: z.union([imageUrlSchema, z.literal('')]).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

// Replace a product's full set of colour variants. The catalog colour manager sends the whole
// list; the array order becomes each colour's display position (0 = primary). Each colour needs
// its own image (an uploaded image or a link).
export const setVariantsSchema = z.object({
  variants: z
    .array(
      z.object({
        color: z.string().min(1),
        imageUrl: imageUrlSchema,
      }),
    )
    .max(30),
});

export const deliveryMethodSchema = z.enum(['STANDARD', 'EXPRESS', 'PICKUP']);

export const placeOrderSchema = z
  .object({
    channel: z.enum(['ONLINE', 'STORE']),
    paymentMethod: z.enum(['COD', 'ONLINE']),
    deliveryMethod: deliveryMethodSchema.default('STANDARD'),
    shippingAddress: z.string().optional(),
    // EasyPaisa proof (required for online payment — see refine below).
    paymentProofUrl: imageUrlSchema.optional(),
    paymentSenderName: z.string().trim().min(1).max(120).optional(),
    paymentReference: z.string().trim().max(120).optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().positive(),
          color: z.string().min(1).optional(),
        }),
      )
      .min(1),
  })
  // A shipping address is required unless the customer is collecting in store.
  .refine((d) => d.deliveryMethod === 'PICKUP' || (d.shippingAddress?.trim().length ?? 0) > 0, {
    message: 'Shipping address is required for delivery',
    path: ['shippingAddress'],
  })
  // Online (EasyPaisa) orders must include the payment screenshot + sender name.
  .refine((d) => d.paymentMethod !== 'ONLINE' || !!d.paymentProofUrl, {
    message: 'Upload your EasyPaisa payment screenshot',
    path: ['paymentProofUrl'],
  })
  .refine((d) => d.paymentMethod !== 'ONLINE' || (d.paymentSenderName?.trim().length ?? 0) > 0, {
    message: 'Enter the name on the account you paid from',
    path: ['paymentSenderName'],
  });

export const transferSchema = z
  .object({
    productId: z.string().min(1),
    from: z.enum(['WAREHOUSE', 'SHOP', 'REPAIR']),
    to: z.enum(['WAREHOUSE', 'SHOP', 'REPAIR']),
    qty: z.number().int().positive(),
  })
  .refine((d) => d.from !== d.to, { message: 'from and to must be different locations' });

// CANCELLED is set via POST /orders/:id/cancel (it restores stock); PENDING is never set manually.
// courierId may accompany a DISPATCHED transition (required for non-PICKUP orders).
export const updateOrderStatusSchema = z.object({
  status: z.enum(['PAID', 'DISPATCHED', 'DELIVERED']),
  courierId: z.string().min(1).optional(),
});

export const createCourierSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional(),
});

export const updateCourierSchema = z
  .object({
    name: z.string().min(2).optional(),
    phone: z.string().min(5).optional(),
    email: z.string().email().optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

export const inventoryQuerySchema = z.object({
  location: z.enum(['WAREHOUSE', 'SHOP', 'REPAIR']).optional(),
});

// Receiving new stock from a supplier (purchase-in) — always lands in the WAREHOUSE.
export const receiveStockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

// Damage is reported from a sellable location; damaged units move into REPAIR.
export const createDamageReportSchema = z.object({
  productId: z.string().min(1),
  location: z.enum(['WAREHOUSE', 'SHOP']),
  quantity: z.number().int().positive(),
  description: z.string().min(1),
});

export const updateDamageReportSchema = z.object({
  status: z.enum(['IN_REPAIR', 'REPAIRED', 'SCRAPPED']),
});

export const monthlyReportSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

// Customer raises this for an out-of-stock watch. The REQUEST vs PREBOOK type is
// decided server-side from warehouse stock — never sent by the client.
export const createStockRequestSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(20).default(1),
  note: z.string().max(500).optional(),
});

// Staff resolution of a request: fulfil it (prebook also pulls stock to the shop) or decline.
export const resolveStockRequestSchema = z.object({
  action: z.enum(['FULFILL', 'DECLINE']),
});

// Shopkeeper/owner asks the warehouse to refill the SHOP. One submit can carry several
// lines (the "request all low/out items" button) or a single line (a specific item).
export const createRestockRequestSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(500),
      }),
    )
    .min(1),
  note: z.string().max(500).optional(),
});

// Warehouse manager/owner resolution: FULFILL sends stock (optionally fewer units than
// requested — defaults to the full requested quantity), DECLINE just closes it.
export const resolveRestockRequestSchema = z.object({
  action: z.enum(['FULFILL', 'DECLINE']),
  quantity: z.number().int().positive().max(500).optional(),
});

// Optional reason captured when an order is cancelled (by staff or the customer).
export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type CreateCourierInput = z.infer<typeof createCourierSchema>;
export type UpdateCourierInput = z.infer<typeof updateCourierSchema>;
export type CreateStockRequestInput = z.infer<typeof createStockRequestSchema>;
export type CreateRestockRequestInput = z.infer<typeof createRestockRequestSchema>;
export type ResolveRestockRequestInput = z.infer<typeof resolveRestockRequestSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type CreateDamageReportInput = z.infer<typeof createDamageReportSchema>;
export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
