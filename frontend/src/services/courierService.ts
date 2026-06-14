import { api } from './api';
import { Courier } from '../types';

export async function getCouriers(activeOnly = false): Promise<Courier[]> {
  const { data } = await api.get<Courier[]>('/couriers', {
    params: activeOnly ? { active: 'true' } : undefined,
  });
  return data;
}

export interface CreateCourierInput {
  name: string;
  phone: string;
  email?: string;
}

export async function createCourier(input: CreateCourierInput): Promise<Courier> {
  const { data } = await api.post<Courier>('/couriers', input);
  return data;
}

export async function updateCourier(
  id: string,
  changes: Partial<CreateCourierInput> & { active?: boolean },
): Promise<Courier> {
  const { data } = await api.patch<Courier>(`/couriers/${id}`, changes);
  return data;
}
