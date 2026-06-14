import { Request, Response } from 'express';
import * as damageService from '../services/damage.service';
import { createDamageReportSchema, updateDamageReportSchema } from '../utils/validators';

export async function create(req: Request, res: Response) {
  const input = createDamageReportSchema.parse(req.body);
  const report = await damageService.createDamageReport(input, req.user!.id);
  res.status(201).json(report);
}

export async function list(_req: Request, res: Response) {
  const reports = await damageService.listDamageReports();
  res.json(reports);
}

export async function update(req: Request, res: Response) {
  const { status } = updateDamageReportSchema.parse(req.body);
  const report = await damageService.updateDamageReport(req.params.id, status, req.user!.id);
  res.json(report);
}
