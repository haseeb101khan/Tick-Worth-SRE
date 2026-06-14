import { api } from './api';
import { StockRequest } from '../types';

export async function createStockRequest(
  productId: string,
  quantity = 1,
  note?: string,
): Promise<StockRequest> {
  const { data } = await api.post<StockRequest>('/stock-requests', { productId, quantity, note });
  return data;
}

export async function getMyRequests(): Promise<StockRequest[]> {
  const { data } = await api.get<StockRequest[]>('/stock-requests/my');
  return data;
}

export async function getAllRequests(): Promise<StockRequest[]> {
  const { data } = await api.get<StockRequest[]>('/stock-requests');
  return data;
}

export async function cancelMyRequest(id: string): Promise<StockRequest> {
  const { data } = await api.post<StockRequest>(`/stock-requests/${id}/cancel`);
  return data;
}

export async function resolveStockRequest(
  id: string,
  action: 'FULFILL' | 'DECLINE',
): Promise<StockRequest> {
  const { data } = await api.patch<StockRequest>(`/stock-requests/${id}`, { action });
  return data;
}
