const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || ''

function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

/** Redirect to login and clear stored token on 401. */
function handle401(): void {
  localStorage.removeItem('auth_token')
  // Avoid redirect loops if we are already on the auth page.
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.href = '/auth'
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${API_URL}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v))
    })
  }

  const token = getToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (res.status === 401) {
    handle401()
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, body: err })
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    request<T>('GET', path, undefined, params, signal),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('POST', path, body, undefined, signal),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('PATCH', path, body, undefined, signal),
  delete: <T>(path: string, signal?: AbortSignal) => request<T>('DELETE', path, undefined, undefined, signal),
}
