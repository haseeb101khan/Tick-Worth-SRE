import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { createStaffSchema, updateStaffSchema } from '../utils/validators';

export async function list(_req: Request, res: Response) {
  const staff = await userService.listStaff();
  res.json(staff);
}

export async function create(req: Request, res: Response) {
  const input = createStaffSchema.parse(req.body);
  const user = await userService.createStaff(input, req.user!.id);
  res.status(201).json(user);
}

export async function update(req: Request, res: Response) {
  const input = updateStaffSchema.parse(req.body);
  const user = await userService.updateStaff(req.params.id, input, req.user!.id);
  res.json(user);
}
