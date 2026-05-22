// ============================================================
// OPERACIONAL5 Mobile — API Service
// ============================================================
// Serviço de comunicação com o backend.
// Em produção: usa Supabase JS client.
// Em desenvolvimento: pode apontar para demo data.
// ============================================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Cliente HTTP para comunicação com o backend.
 * Usado como fallback quando Supabase client não está disponível.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, data: null, error };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, data: null, error: String(error) };
  }
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // Presence
  confirmPresence: (input: Record<string, unknown>) =>
    request('/presence/confirm', { method: 'POST', body: JSON.stringify(input) }),

  // Occurrences
  createOccurrence: (input: Record<string, unknown>) =>
    request('/occurrences', { method: 'POST', body: JSON.stringify(input) }),

  // SOS
  triggerSOS: (input: Record<string, unknown>) =>
    request('/sos/trigger', { method: 'POST', body: JSON.stringify(input) }),
  closeSOS: (id: string, input: Record<string, unknown>) =>
    request(`/sos/${id}/close`, { method: 'POST', body: JSON.stringify(input) }),

  // Ronda
  confirmRondaPoint: (input: Record<string, unknown>) =>
    request('/ronda/confirm', { method: 'POST', body: JSON.stringify(input) }),

  // Handover
  createHandover: (input: Record<string, unknown>) =>
    request('/handovers', { method: 'POST', body: JSON.stringify(input) }),

  // Sync offline events
  syncOfflineEvent: (input: Record<string, unknown>) =>
    request('/sync/offline-event', { method: 'POST', body: JSON.stringify(input) }),

  // Upload evidence
  uploadEvidence: (file: Blob, path: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    return request('/storage/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Não setar Content-Type para FormData
    });
  },
};
