import { Request, Response } from 'express';
import * as stockRequestService from '../services/stockRequest.service';
import { createStockRequestSchema, resolveStockRequestSchema } from '../utils/validators';

export async function create(req: Request, res: Response) {
  const input = createStockRequestSchema.parse(req.body);
  const request = await stockRequestService.createStockRequest(req.user!.id, input);
  res.status(201).json(request);
}

export async function myRequests(req: Request, res: Response) {
  const requests = await stockRequestService.listMyRequests(req.user!.id);
  res.json(requests);
}

export async function allRequests(_req: Request, res: Response) {
  const requests = await stockRequestService.listAllRequests();
  res.json(requests);
}

export async function cancel(req: Request, res: Response) {
  const request = await stockRequestService.cancelMyRequest(req.user!.id, req.params.id);
  res.json(request);
}

export async function resolve(req: Request, res: Response) {
  const { action } = resolveStockRequestSchema.parse(req.body);
  const request = await stockRequestService.resolveStockRequest(req.params.id, action, req.user!.id);
  res.json(request);
}
