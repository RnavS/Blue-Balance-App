import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = (
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  ''
).replace(/\/$/, '');

// EXPO_PUBLIC_* is inlined at bundle time, so a missing .env produces an app that
// builds fine and then fails on every screen. Say so once, loudly, at startup
// rather than only as a per-request error.
if (!API_URL) {
  console.error(
    '[Blue Balance] EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env, ' +
      'point it at your API, then restart the bundler with `npm run start:clear`. ' +
      'Every network request will fail until this is set.',
  );
}

const ACCESS_TOKEN_KEY = 'blueBalance_accessToken';
const REFRESH_TOKEN_KEY = 'blueBalance_refreshToken';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/** Thrown for any non-2xx response; `code` carries the server's `error` field. */
export class ApiError extends Error {
  status: number;
  code: string | null;
  body: any;

  constructor(status: number, message: string, code: string | null = null, body: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

type SessionListener = (user: AuthUser | null) => void;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: AuthUser | null = null;
const listeners = new Set<SessionListener>();

// Concurrent 401s must not each fire their own refresh, or all but one of the
// rotated tokens gets revoked and the user is signed out spuriously.
let refreshInFlight: Promise<boolean> | null = null;

function notify() {
  listeners.forEach((listener) => listener(currentUser));
}

export function onAuthStateChange(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentUser() {
  return currentUser;
}

export function getAccessToken() {
  return accessToken;
}

async function persistSession(user: AuthUser | null, session: Session | null) {
  currentUser = user;
  accessToken = session?.accessToken ?? null;
  refreshToken = session?.refreshToken ?? null;

  if (session) {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, session.accessToken],
      [REFRESH_TOKEN_KEY, session.refreshToken],
    ]);
  } else {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  }

  notify();
}

export async function setSession(payload: { user: AuthUser; session: Session }) {
  await persistSession(payload.user, payload.session);
}

export async function clearSession() {
  await persistSession(null, null);
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, body: any) {
  const message =
    (typeof body?.message === 'string' && body.message) ||
    (typeof body?.error === 'string' && body.error) ||
    'Something went wrong. Please try again.';
  const code = typeof body?.error === 'string' ? body.error : null;
  return new ApiError(status, message, code, body);
}

async function rawRequest(path: string, init: RequestInit, withAuth: boolean) {
  if (!API_URL) {
    throw new ApiError(
      0,
      'The app is not configured to reach a server. Set EXPO_PUBLIC_API_URL in .env and restart the bundler.',
      'api_not_configured',
    );
  }

  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (withAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return await fetch(`${API_URL}${path}`, { ...init, headers });
}

/** Rotates the refresh token. Returns false when the session is unrecoverable. */
async function refreshSession(): Promise<boolean> {
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await rawRequest(
          '/auth/refresh',
          { method: 'POST', body: JSON.stringify({ refreshToken }) },
          false,
        );

        if (!response.ok) {
          await clearSession();
          return false;
        }

        const body = await parseBody(response);
        await persistSession(body.user, body.session);
        return true;
      } catch {
        // A network blip should not destroy the stored session — the next call
        // will try again.
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

export async function apiFetch<T = any>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean; retry?: boolean } = {},
): Promise<T> {
  const { auth = true, retry = true } = options;

  let response = await rawRequest(path, init, auth);

  // One transparent refresh-and-retry on expiry.
  if (response.status === 401 && auth && retry && refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await rawRequest(path, init, true);
    }
  }

  const body = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      await clearSession();
    }
    throw toApiError(response.status, body);
  }

  return body as T;
}

/**
 * Restores a session from storage on cold start and verifies it is still valid.
 * Returns the signed-in user, or null.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  const [[, storedAccess], [, storedRefresh]] = await AsyncStorage.multiGet([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
  ]);

  if (!storedAccess || !storedRefresh) {
    await clearSession();
    return null;
  }

  accessToken = storedAccess;
  refreshToken = storedRefresh;

  try {
    const body = await apiFetch<{ user: AuthUser }>('/auth/me', { method: 'GET' });
    currentUser = body.user;
    notify();
    return currentUser;
  } catch (error) {
    // Offline: keep the stored tokens so the app recovers when connectivity
    // returns. Only an actual auth rejection clears them (handled in apiFetch).
    if (error instanceof ApiError && error.status === 0) {
      return null;
    }
    return null;
  }
}
