import { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';

export async function listMine(req: Request, res: Response) {
  const notifications = await notificationService.listMine(req.user!.id);
  res.json(notifications);
}

export async function markRead(req: Request, res: Response) {
  const notification = await notificationService.markRead(req.user!.id, req.params.id);
  res.json(notification);
}
