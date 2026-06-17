import axios from 'axios';
import { trackRequest } from '../utils/wake';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
});

// Attach the JWT (stored in localStorage) to every request, and start the cold-start
// timer (see utils/wake) so a slow backend wake-up surfaces the "waking up" banner.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  (config as { __wakeDone?: () => void }).__wakeDone = trackRequest();
  return config;
});

// Clear the timer when the request settles — on both success and error.
api.interceptors.response.use(
  (res) => {
    (res.config as { __wakeDone?: () => void }).__wakeDone?.();
    return res;
  },
  (err) => {
    (err.config as { __wakeDone?: () => void } | undefined)?.__wakeDone?.();
    return Promise.reject(err);
  },
);
