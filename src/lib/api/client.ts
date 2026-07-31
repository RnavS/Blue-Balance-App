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

/**
 * A request that never returns is worse than one that fails: the UI spins
 * forever with no way out. React Native's fetch has no default timeout, so this
 * imposes one.
 *
 * Generous because a host that sleeps when idle (most free tiers) can take
 * ~30 seconds to answer the first request after waking.
 */
const REQUEST_TIMEOUT_MS = 45_000;

/** Transport-level failure — no HTTP response at all. */
const NETWORK_ERROR = 'network_error';

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      0,
      aborted
        ? 'The server took too long to respond. Check your connection and try again.'
        : 'Could not reach the server. Check your connection and try again.',
      NETWORK_ERROR,
    );
  } finally {
    clearTimeout(timeout);
  }
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

/** 502/503/504 are what a proxy returns while its backend is still waking up. */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiFetch<T = any>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean; retry?: boolean } = {},
): Promise<T> {
  const { auth = true, retry = true } = options;

  let lastTransientError: ApiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await rawRequest(path, init, auth);
    } catch (error) {
      // No response at all. Worth another try — a dropped connection or a host
      // that is still booting usually succeeds moments later.
      if (error instanceof ApiError && error.code === NETWORK_ERROR && attempt < MAX_ATTEMPTS) {
        lastTransientError = error;
        await sleep(attempt * 1000);
        continue;
      }
      throw error;
    }

    // One transparent refresh-and-retry on expiry.
    if (response.status === 401 && auth && retry && refreshToken) {
      const refreshed = await refreshSession();
      if (refreshed) {
        response = await rawRequest(path, init, true);
      }
    }

    if (TRANSIENT_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
      lastTransientError = new ApiError(
        response.status,
        'The server is starting up. Retrying...',
        'server_unavailable',
      );
      await sleep(attempt * 1000);
      continue;
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

  throw (
    lastTransientError ??
    new ApiError(0, 'Could not reach the server. Check your connection and try again.', NETWORK_ERROR)
  );
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
    // The server rejected the token — apiFetch has already cleared the session.
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    // Unreachable server (offline, or a host still waking up). Trust the stored
    // token for identity so the user is not thrown back to the login screen for
    // something that is not their fault. This grants no access: every real
    // request still carries the token and the server still verifies it.
    const claims = decodeTokenClaims(storedAccess);
    if (claims) {
      currentUser = claims;
      notify();
      return currentUser;
    }

    return null;
  }
}

/**
 * Reads the `sub` and `email` out of a JWT payload **without verifying it**.
 *
 * Only ever used to label the UI while the server is unreachable. Nothing is
 * authorised on the strength of this — the server verifies the signature on
 * every request, so a forged token gets a 401 the moment connectivity returns.
 */
function decodeTokenClaims(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const claims = JSON.parse(base64UrlToUtf8(payload));
    if (typeof claims?.sub !== 'string') return null;

    // An expired token will be refreshed or rejected on the next live request.
    return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };
  } catch {
    return null;
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodes base64url to a UTF-8 string.
 *
 * Written out rather than calling `atob` because Hermes does not reliably
 * provide it, and a missing global here would fail silently. Bytes are handed to
 * decodeURIComponent so multi-byte characters survive.
 */
function base64UrlToUtf8(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const bytes: number[] = [];

  for (let i = 0; i < padded.length; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(padded[i]!);
    const c1 = BASE64_ALPHABET.indexOf(padded[i + 1]!);
    const c2 = BASE64_ALPHABET.indexOf(padded[i + 2]!);
    const c3 = BASE64_ALPHABET.indexOf(padded[i + 3]!);

    if (c0 < 0 || c1 < 0) break;

    bytes.push((c0 << 2) | (c1 >> 4));
    // indexOf returns -1 for the '=' padding, marking the end of real data.
    if (c2 >= 0) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 3) << 6) | c3);
  }

  const percentEncoded = bytes
    .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');

  return decodeURIComponent(percentEncoded);
}
