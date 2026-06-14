import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { registerSchema, loginSchema } from '../utils/validators';

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
