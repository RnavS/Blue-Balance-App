import {
  apiFetch,
  clearSession,
  setSession,
  type AuthUser,
  type Session,
} from './client';

export {
  ApiError,
  getAccessToken,
  getCurrentUser,
  onAuthStateChange,
  restoreSession,
  type AuthUser,
} from './client';

type SessionResponse = { user: AuthUser; session: Session };

function query(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

export const auth = {
  async signUp(email: string, password: string) {
    const body = await apiFetch<SessionResponse>(
      '/auth/signup',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      { auth: false },
    );
    await setSession(body);
    return body.user;
  },

  async signIn(email: string, password: string) {
    const body = await apiFetch<SessionResponse>(
      '/auth/signin',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      { auth: false },
    );
    await setSession(body);
    return body.user;
  },

  async signOut() {
    // Revoking server-side is best effort; the local session always clears.
    await apiFetch('/auth/signout', { method: 'POST', body: JSON.stringify({}) }).catch(() => null);
    await clearSession();
  },

  async resetPassword(email: string) {
    return await apiFetch<{ success: boolean; resetToken?: string }>(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ email }) },
      { auth: false },
    );
  },

  async confirmPasswordReset(token: string, password: string) {
    return await apiFetch<{ success: boolean }>(
      '/auth/reset-password/confirm',
      { method: 'POST', body: JSON.stringify({ token, password }) },
      { auth: false },
    );
  },

  async deleteAccount() {
    const body = await apiFetch<{ deleted: boolean; billingWarnings: string[] }>('/account', {
      method: 'DELETE',
    });
    await clearSession();
    return body;
  },
};

export const profiles = {
  list: () => apiFetch<{ data: any[] }>('/profiles').then((body) => body.data),
  create: (input: Record<string, unknown>) =>
    apiFetch<{ data: any }>('/profiles', { method: 'POST', body: JSON.stringify(input) }).then(
      (body) => body.data,
    ),
  update: (id: string, updates: Record<string, unknown>) =>
    apiFetch<{ data: any }>(`/profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }).then((body) => body.data),
  remove: (id: string) => apiFetch(`/profiles/${id}`, { method: 'DELETE' }),
};

export const waterLogs = {
  list: (profileId: string, since?: string) =>
    apiFetch<{ data: any[] }>(`/water-logs${query({ profile_id: profileId, since })}`).then(
      (body) => body.data,
    ),
  create: (input: Record<string, unknown>) =>
    apiFetch<{ data: any }>('/water-logs', { method: 'POST', body: JSON.stringify(input) }).then(
      (body) => body.data,
    ),
  remove: (id: string) => apiFetch(`/water-logs/${id}`, { method: 'DELETE' }),
};

export const beverages = {
  list: (profileId: string) =>
    apiFetch<{ data: any[] }>(`/beverages${query({ profile_id: profileId })}`).then(
      (body) => body.data,
    ),
  create: (input: Record<string, unknown>) =>
    apiFetch<{ data: any }>('/beverages', { method: 'POST', body: JSON.stringify(input) }).then(
      (body) => body.data,
    ),
  remove: (id: string) => apiFetch(`/beverages/${id}`, { method: 'DELETE' }),
};

export const scannedBeverages = {
  list: (profileId: string) =>
    apiFetch<{ data: any[] }>(`/scanned-beverages${query({ profile_id: profileId })}`).then(
      (body) => body.data,
    ),
  create: (input: Record<string, unknown>) =>
    apiFetch<{ data: any }>('/scanned-beverages', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((body) => body.data),
  remove: (id: string) => apiFetch(`/scanned-beverages/${id}`, { method: 'DELETE' }),
};

export const chatMessages = {
  list: (profileId: string) =>
    apiFetch<{ data: any[] }>(`/chat-messages${query({ profile_id: profileId })}`).then(
      (body) => body.data,
    ),
  create: (input: Record<string, unknown>) =>
    apiFetch<{ data: any }>('/chat-messages', { method: 'POST', body: JSON.stringify(input) }).then(
      (body) => body.data,
    ),
  clear: (profileId: string) =>
    apiFetch(`/chat-messages${query({ profile_id: profileId })}`, { method: 'DELETE' }),
};

/** Replaces supabase.functions.invoke(...) — same names, same payloads. */
export const functions = {
  syncPremiumStatus: () => apiFetch<any>('/functions/sync-premium-status', { method: 'POST', body: '{}' }),
  barcodeLookup: (body: Record<string, unknown>) =>
    apiFetch<any>('/functions/barcode-lookup', { method: 'POST', body: JSON.stringify(body) }),
  aiCoach: (body: Record<string, unknown>) =>
    apiFetch<any>('/functions/ai-coach', { method: 'POST', body: JSON.stringify(body) }),
  createCheckoutSession: (body: Record<string, unknown>) =>
    apiFetch<{ url?: string }>('/functions/create-stripe-checkout-session', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createPortalSession: (body: Record<string, unknown>) =>
    apiFetch<{ url?: string }>('/functions/create-stripe-portal-session', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
