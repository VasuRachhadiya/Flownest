const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

const TOKEN_STORAGE_KEY = 'flownest_access_token';
const ORG_STORAGE_KEY = 'flownest_active_org_id';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  getToken: () => sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY),
  setToken: (token: string | null) => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  },
  getOrgId: () => localStorage.getItem(ORG_STORAGE_KEY),
  setOrgId: (orgId: string | null) => {
    if (orgId) localStorage.setItem(ORG_STORAGE_KEY, orgId);
    else localStorage.removeItem(ORG_STORAGE_KEY);
  },
};

function buildHeaders(extra?: Record<string, string>, isMultipart = false): HeadersInit {
  const headers: Record<string, string> = { ...extra };
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  const token = tokenStore.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const orgId = tokenStore.getOrgId();
  if (orgId) {
    headers['X-Organization-Id'] = orgId;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.error || data?.title || data?.message || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export function toQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      search.set(k, String(v));
    }
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const apiClient = {
  get: async <T>(path: string, params?: Record<string, unknown>): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}${toQueryString(params)}`, {
      method: 'GET',
      headers: buildHeaders(),
    });
    return handleResponse<T>(res);
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  put: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  patch: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  delete: async <T = void>(path: string): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return handleResponse<T>(res);
  },

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: buildHeaders(undefined, true),
      body: formData,
    });
    return handleResponse<T>(res);
  },

  downloadBlob: async (path: string, filename: string): Promise<void> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: buildHeaders(undefined, true),
    });
    if (!res.ok) {
      throw new ApiError('Failed to download file.', res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
