import { Request, Response } from 'express';
import * as transferService from '../services/transfer.service';
import { transferSchema } from '../utils/validators';
import { ForbiddenError } from '../utils/errors';

export async function create(req: Request, res: Response) {
  const input = transferSchema.parse(req.body);

  // Moving stock OUT of the warehouse is restricted to warehouse manager/owner;
  // shop↔repair moves are any staff (the route already requires staff).
  if (input.from === 'WAREHOUSE' && !['WAREHOUSE_MANAGER', 'OWNER'].includes(req.user!.role)) {
    throw new ForbiddenError('Warehouse transfers require WAREHOUSE_MANAGER or OWNER');
  }

  const movement = await transferService.transferStock(input, req.user!.id);
  res.status(201).json(movement);
}
