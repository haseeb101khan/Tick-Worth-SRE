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

// Registration normally emails a verification link first (needsVerification: true).
// While auto-verify is enabled on the server (host blocks SMTP), it instead returns a
// token + user so the customer is signed in immediately.
export interface RegisterResult {
  needsVerification: boolean;
  email: string;
  token?: string;
  user?: User;
}
export async function register(
  name: string,
  email: string,
  password: string,
): Promise<RegisterResult> {
  const { data } = await api.post<RegisterResult>('/auth/register', {
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
