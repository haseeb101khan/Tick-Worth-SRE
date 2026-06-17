import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../utils/validators';

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

export async function verifyEmail(req: Request, res: Response) {
  const { token } = verifyEmailSchema.parse(req.body);
  const result = await authService.verifyEmail(token);
  res.json(result);
}

export async function resendVerification(req: Request, res: Response) {
  const { email } = resendVerificationSchema.parse(req.body);
  const result = await authService.resendVerification(email);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
