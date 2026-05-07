const base = (import.meta.env.VITE_API_URL ?? "") + "/api";

function getToken() { return localStorage.getItem('adminToken') ?? ''; }

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${getToken()}`,
      ...init?.headers,
    },
    ...init,
  });
  if (res.status === 401) {
    localStorage.removeItem('adminToken');
    window.location.reload();
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  screens: {
    list: () => apiFetch<unknown[]>("/screens"),
    get: (id: string) => apiFetch<unknown>(`/screens/${id}`),
    create: (body: { name: string; location?: string }) =>
      apiFetch("/screens", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      apiFetch(`/screens/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch(`/screens/${id}`, { method: "DELETE" }),
    command: (id: string, action: string, payload?: unknown) =>
      apiFetch(`/screens/${id}/command`, {
        method: "POST",
        body: JSON.stringify({ action, payload }),
      }),
  },
  media: {
    list: () => apiFetch<unknown[]>("/media"),
    upload: async (file: File): Promise<unknown> => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${base}/media/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        window.location.reload();
        throw new Error('Session expired');
      }
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    addUrl: (body: { name: string; url: string; duration_seconds?: number }) =>
      apiFetch("/media/url", { method: "POST", body: JSON.stringify(body) }),
    addTimer: (body: { name: string; duration_seconds: number }) =>
      apiFetch("/media/timer", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch(`/media/${id}`, { method: "DELETE" }),
  },
  playlists: {
    list: () => apiFetch<unknown[]>("/playlists"),
    get: (id: string) => apiFetch<unknown>(`/playlists/${id}`),
    create: (body: { name: string; loop?: boolean }) =>
      apiFetch("/playlists", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      apiFetch(`/playlists/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: string) => apiFetch(`/playlists/${id}`, { method: "DELETE" }),
    addItem: (pid: string, body: unknown) =>
      apiFetch(`/playlists/${pid}/items`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    removeItem: (pid: string, itemId: string) =>
      apiFetch(`/playlists/${pid}/items/${itemId}`, { method: "DELETE" }),
  },
  schedules: {
    list: () => apiFetch<unknown[]>("/schedules"),
    create: (body: unknown) =>
      apiFetch("/schedules", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch(`/schedules/${id}`, { method: "DELETE" }),
  },
};
