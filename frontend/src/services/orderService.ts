import { api } from './api';
import { DeliveryMethod, Order, OrderStatus } from '../types';

export interface PlaceOrderInput {
  channel: 'ONLINE' | 'STORE';
  paymentMethod: 'COD' | 'ONLINE';
  deliveryMethod: DeliveryMethod;
  shippingAddress?: string;
  paymentProofUrl?: string;
  paymentSenderName?: string;
  paymentReference?: string;
  items: { productId: string; quantity: number; color?: string }[];
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const { data } = await api.post<Order>('/orders', input);
  return data;
}

export async function getMyOrders(): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/orders/my');
  return data;
}

export async function getAllOrders(): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/orders/all');
  return data;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  courierId?: string,
): Promise<Order> {
  const { data } = await api.patch<Order>(`/orders/${id}/status`, { status, courierId });
  return data;
}

export async function cancelOrder(id: string, reason?: string): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${id}/cancel`, { reason });
  return data;
}
