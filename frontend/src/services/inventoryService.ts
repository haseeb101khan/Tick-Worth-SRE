import { api } from './api';
import { Location, StockRow } from '../types';

export async function getInventory(location?: Location): Promise<StockRow[]> {
  const { data } = await api.get<StockRow[]>('/inventory', {
    params: location ? { location } : undefined,
  });
  return data;
}

export async function getLowStock(): Promise<StockRow[]> {
  const { data } = await api.get<StockRow[]>('/inventory/low-stock');
  return data;
}

// Receive supplier stock into the warehouse (warehouse manager / owner).
export async function receiveStock(productId: string, quantity: number) {
  const { data } = await api.post('/inventory/receive', { productId, quantity });
  return data;
}
