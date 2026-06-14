import { api } from './api';
import { DamageReport, RepairStatus } from '../types';

export interface CreateDamageReportInput {
  productId: string;
  location: 'WAREHOUSE' | 'SHOP';
  quantity: number;
  description: string;
}

export async function createDamageReport(input: CreateDamageReportInput): Promise<DamageReport> {
  const { data } = await api.post<DamageReport>('/damage-reports', input);
  return data;
}

export async function getDamageReports(): Promise<DamageReport[]> {
  const { data } = await api.get<DamageReport[]>('/damage-reports');
  return data;
}

export async function updateDamageReport(id: string, status: RepairStatus): Promise<DamageReport> {
  const { data } = await api.patch<DamageReport>(`/damage-reports/${id}`, { status });
  return data;
}
