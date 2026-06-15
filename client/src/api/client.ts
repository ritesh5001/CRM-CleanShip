import axios from 'axios';
import { useAuthStore } from '@/store/auth';

// Resolves the API base URL. In local dev VITE_API_URL is unset and requests
// go through the Vite proxy at `/api/v1`. In production set VITE_API_URL to the
// deployed API — either the origin (https://api.example.com) or the full path
// (https://api.example.com/api/v1); the `/api/v1` suffix is added if missing.
function resolveBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) return '/api/v1';
  const base = raw.replace(/\/+$/, '');
  return /\/api\/v\d+$/.test(base) ? base : `${base}/api/v1`;
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
});

// Attach JWT to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, log the user out.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

/** Extracts a human-readable message from an axios error. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message;
  }
  return 'Something went wrong';
}
