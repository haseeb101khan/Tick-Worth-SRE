import { Request, Response } from 'express';
import * as courierService from '../services/courier.service';
import { createCourierSchema, updateCourierSchema } from '../utils/validators';

export async function list(req: Request, res: Response) {
  const activeOnly = req.query.active === 'true';
  const couriers = await courierService.listCouriers(activeOnly);
  res.json(couriers);
}

export async function create(req: Request, res: Response) {
  const input = createCourierSchema.parse(req.body);
  const courier = await courierService.createCourier(input);
  res.status(201).json(courier);
}

export async function update(req: Request, res: Response) {
  const input = updateCourierSchema.parse(req.body);
  const courier = await courierService.updateCourier(req.params.id, input);
  res.json(courier);
}
