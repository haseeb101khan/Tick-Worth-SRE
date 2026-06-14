import { api } from './api';
import {
  FullReport,
  MonthlyReport,
  OrderStatusReport,
  ReportPreview,
  SentReportSummary,
} from '../types';

export async function getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  const { data } = await api.get<MonthlyReport>('/reports/monthly', { params: { year, month } });
  return data;
}

export async function getOrderStatusReport(year: number, month: number): Promise<OrderStatusReport> {
  const { data } = await api.get<OrderStatusReport>('/reports/order-status', {
    params: { year, month },
  });
  return data;
}

// Staff: preview the pending report (everything since their last send) without persisting it.
export async function getReportPreview(): Promise<ReportPreview> {
  const { data } = await api.get<ReportPreview>('/reports/preview');
  return data;
}

// Staff: persist + send the pending report to the owner.
export async function sendReportToOwner(): Promise<FullReport> {
  const { data } = await api.post<FullReport>('/reports/send-owner');
  return data;
}

// Staff: this sender's own report history (full rows, so they can re-download).
export async function getMyReports(): Promise<FullReport[]> {
  const { data } = await api.get<FullReport[]>('/reports/mine');
  return data;
}

// Owner: archive list (metadata + summary) and full detail.
export async function getSentReports(): Promise<SentReportSummary[]> {
  const { data } = await api.get<SentReportSummary[]>('/reports/sent');
  return data;
}

export async function getSentReport(id: string): Promise<FullReport> {
  const { data } = await api.get<FullReport>(`/reports/sent/${id}`);
  return data;
}

// Owner: remove an accidental/unwanted report from the archive.
export async function deleteSentReport(id: string): Promise<void> {
  await api.delete(`/reports/sent/${id}`);
}
