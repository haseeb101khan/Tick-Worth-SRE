import { Request, Response } from 'express';
import * as inventoryService from '../services/inventory.service';
import { inventoryQuerySchema, receiveStockSchema } from '../utils/validators';

export async function list(req: Request, res: Response) {
  const { location } = inventoryQuerySchema.parse(req.query);
  const stock = await inventoryService.listStock(location);
  res.json(stock);
}

export async function lowStock(_req: Request, res: Response) {
  const stock = await inventoryService.listLowStock();
  res.json(stock);
}

export async function receive(req: Request, res: Response) {
  const { productId, quantity } = receiveStockSchema.parse(req.body);
  const movement = await inventoryService.receiveStock(productId, quantity, req.user!.id);
  res.status(201).json(movement);
}
