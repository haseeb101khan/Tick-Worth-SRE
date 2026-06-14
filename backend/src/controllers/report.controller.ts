import { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { monthlyReportSchema } from '../utils/validators';

// ── Owner live views ────────────────────────────────────────────────────────────────────
export async function monthly(req: Request, res: Response) {
  const input = monthlyReportSchema.parse(req.query);
  const report = await reportService.monthlyReport(input);
  res.json(report);
}

export async function orderStatus(req: Request, res: Response) {
  const input = monthlyReportSchema.parse(req.query);
  const report = await reportService.orderStatusReport(input);
  res.json(report);
}

// ── Persisted reports ───────────────────────────────────────────────────────────────────

// What this staff member would send right now (period since their last report) — not stored.
export async function preview(req: Request, res: Response) {
  const report = await reportService.previewReport(req.user!);
  res.json(report);
}

// Persist the pending report as a frozen snapshot and notify the owner(s).
export async function sendOwner(req: Request, res: Response) {
  const report = await reportService.createReport(req.user!);
  res.status(201).json(report);
}

// A sender's own report history.
export async function mine(req: Request, res: Response) {
  const reports = await reportService.listMyReports(req.user!.id);
  res.json(reports);
}

// Owner archive: list + detail.
export async function sent(_req: Request, res: Response) {
  const reports = await reportService.listSentReports();
  res.json(reports);
}

export async function sentDetail(req: Request, res: Response) {
  const report = await reportService.getSentReport(req.params.id);
  res.json(report);
}

export async function deleteSent(req: Request, res: Response) {
  const result = await reportService.deleteReport(req.params.id);
  res.json(result);
}
