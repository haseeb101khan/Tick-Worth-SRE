import { Request, Response } from 'express';
import * as restockRequestService from '../services/restockRequest.service';
import { createRestockRequestSchema, resolveRestockRequestSchema } from '../utils/validators';

export async function create(req: Request, res: Response) {
  const input = createRestockRequestSchema.parse(req.body);
  const requests = await restockRequestService.createRestockRequests(req.user!.id, input);
  res.status(201).json(requests);
}

export async function list(_req: Request, res: Response) {
  const requests = await restockRequestService.listRestockRequests();
  res.json(requests);
}

export async function resolve(req: Request, res: Response) {
  const { action, quantity } = resolveRestockRequestSchema.parse(req.body);
  const request = await restockRequestService.resolveRestockRequest(
    req.params.id,
    action,
    quantity,
    req.user!.id,
  );
  res.json(request);
}

export async function cancel(req: Request, res: Response) {
  const request = await restockRequestService.cancelMyRestockRequest(req.user!.id, req.params.id);
  res.json(request);
}
