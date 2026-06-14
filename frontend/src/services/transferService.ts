import { api } from './api';
import { Location } from '../types';

export interface TransferInput {
  productId: string;
  from: Location;
  to: Location;
  qty: number;
}

export async function createTransfer(input: TransferInput) {
  const { data } = await api.post('/transfers', input);
  return data;
}
