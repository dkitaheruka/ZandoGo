import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const baseURL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');
export const isRealApiMode = Boolean(import.meta.env.VITE_API_URL);

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken: string | null = null;
let refreshRequest: Promise<string | null> | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  tokenListeners.forEach((listener) => listener(token));
}

export function onAccessTokenChanged(listener: (token: string | null) => void) {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const requestUrl = config?.url ?? '';
    const shouldRefresh =
      error.response?.status === 401 &&
      config !== undefined &&
      !config._retried &&
      !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some((path) =>
        requestUrl.includes(path),
      );

    if (!shouldRefresh || !config) throw error;

    config._retried = true;
    refreshRequest ??= axios
      .post<{ accessToken: string }>(
        `${baseURL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshRequest = null;
      });

    const token = await refreshRequest;
    if (!token) throw error;
    config.headers.set('Authorization', `Bearer ${token}`);
    return api(config);
  },
);
