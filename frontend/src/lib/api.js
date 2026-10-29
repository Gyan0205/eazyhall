// Override with VITE_API_BASE (e.g. in .env.production) when the backend is hosted elsewhere
export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

// FastAPI returns validation errors (422) as a list of objects rather than a string
export const errorMessage = (err, fallback) => {
  if (typeof err?.detail === 'string') return err.detail;
  if (Array.isArray(err?.detail)) return err.detail.map(d => d.msg).join('; ');
  return fallback;
};

/**
 * Small fetch wrapper. Returns { ok, status, data }, never throws for HTTP errors.
 * A 401 calls onUnauthorized so an expired token signs the user out.
 */
export async function request(path, { token, method = 'GET', body, onUnauthorized } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: { detail: "Can't reach the server. It may be waking up; try again in a moment." } };
  }

  if (response.status === 401 && token && onUnauthorized) onUnauthorized();
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}
