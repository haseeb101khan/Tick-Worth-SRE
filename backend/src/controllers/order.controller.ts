import { Request, Response } from 'express';
import * as orderService from '../services/order.service';
import { cancelOrderSchema, placeOrderSchema, updateOrderStatusSchema } from '../utils/validators';

export async function place(req: Request, res: Response) {
  const input = placeOrderSchema.parse(req.body);
  const order = await orderService.placeOrder(req.user!.id, input);
  res.status(201).json(order);
}

export async function myOrders(req: Request, res: Response) {
  const orders = await orderService.listMyOrders(req.user!.id);
  res.json(orders);
}

export async function allOrders(_req: Request, res: Response) {
  const orders = await orderService.listAllOrders();
  res.json(orders);
}

export async function updateStatus(req: Request, res: Response) {
  const { status, courierId } = updateOrderStatusSchema.parse(req.body);
  const order = await orderService.updateOrderStatus(req.params.id, status, courierId);
  res.json(order);
}

export async function cancel(req: Request, res: Response) {
  const { reason } = cancelOrderSchema.parse(req.body ?? {});
  const order = await orderService.cancelOrder(req.params.id, req.user!, reason);
  res.json(order);
}
