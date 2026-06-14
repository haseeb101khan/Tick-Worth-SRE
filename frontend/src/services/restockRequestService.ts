import { api } from './api';
import { RestockRequest } from '../types';

export interface RestockLine {
  productId: string;
  quantity: number;
}

// Shopkeeper/owner raises one or more restock asks in a single submit.
export async function createRestockRequests(
  items: RestockLine[],
  note?: string,
): Promise<RestockRequest[]> {
  const { data } = await api.post<RestockRequest[]>('/restock-requests', { items, note });
  return data;
}

export async function getRestockRequests(): Promise<RestockRequest[]> {
  const { data } = await api.get<RestockRequest[]>('/restock-requests');
  return data;
}

// Warehouse manager/owner resolves: FULFILL (optionally sending fewer units) or DECLINE.
export async function resolveRestockRequest(
  id: string,
  action: 'FULFILL' | 'DECLINE',
  quantity?: number,
): Promise<RestockRequest> {
  const { data } = await api.patch<RestockRequest>(`/restock-requests/${id}`, { action, quantity });
  return data;
}

export async function cancelRestockRequest(id: string): Promise<RestockRequest> {
  const { data } = await api.post<RestockRequest>(`/restock-requests/${id}/cancel`);
  return data;
}
