import { api } from './api';
import { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

// Registration no longer logs you in — it emails a verification link first.
export async function register(
  name: string,
  email: string,
  password: string,
): Promise<{ needsVerification: boolean; email: string }> {
  const { data } = await api.post<{ needsVerification: boolean; email: string }>('/auth/register', {
    name,
    email,
    password,
  });
  return data;
}

// Confirm the email from the link — the server returns a token, signing the user in.
export async function verifyEmail(token: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/verify', { token });
  return data;
}

export async function resendVerification(email: string): Promise<void> {
  await api.post('/auth/resend-verification', { email });
}
