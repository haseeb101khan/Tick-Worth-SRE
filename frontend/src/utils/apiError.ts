import { AxiosError } from 'axios';

// Pull the backend's { error: "..." } message out of an axios failure.
export function apiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string; details?: unknown } | undefined;
    if (data?.error) return data.error;
    return err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
