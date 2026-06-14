import { api } from './api';
import { Role, StaffUser } from '../types';

export async function getStaff(): Promise<StaffUser[]> {
  const { data } = await api.get<StaffUser[]>('/users');
  return data;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: Exclude<Role, 'CUSTOMER'>;
}

export async function createStaff(input: CreateStaffInput): Promise<StaffUser> {
  const { data } = await api.post<StaffUser>('/users', input);
  return data;
}

export async function updateStaff(
  id: string,
  changes: { role?: Exclude<Role, 'CUSTOMER'>; active?: boolean },
): Promise<StaffUser> {
  const { data } = await api.patch<StaffUser>(`/users/${id}`, changes);
  return data;
}
