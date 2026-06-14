import { api } from './api';
import { AppNotification } from '../types';

export async function getNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>('/notifications');
  return data;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const { data } = await api.patch<AppNotification>(`/notifications/${id}/read`);
  return data;
}
