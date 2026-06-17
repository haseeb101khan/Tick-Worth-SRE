import { Request, Response } from 'express';
import { z } from 'zod';
import * as uploadService from '../services/upload.service';

const uploadSchema = z.object({
  image: z
    .string()
    .refine((v) => /^data:image\//i.test(v) || /^https?:\/\//i.test(v), 'Provide an image file or link'),
});

// Staff-only: upload a catalogue/colour image and get back its hosted URL.
export async function image(req: Request, res: Response) {
  const { image: img } = uploadSchema.parse(req.body);
  const url = await uploadService.uploadImage(img);
  res.json({ url });
}

// Any signed-in customer: upload their EasyPaisa payment screenshot for an order.
export async function paymentProof(req: Request, res: Response) {
  const { image: img } = uploadSchema.parse(req.body);
  const url = await uploadService.uploadImage(img, 'tickworth/payment-proofs');
  res.json({ url });
}
