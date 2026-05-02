/**
 * Namespaced localStorage wrapper.
 *
 * Problem solved: when dev (localhost:5173) and prod (app.mipanel.com) are open
 * in the same browser they share the same localStorage origin. Without a
 * namespace they would read each other's auth tokens and settings.
 *
 * The namespace is derived from VITE_STORAGE_NS (set per environment in .env
 * files) and falls back to a hash of the current origin so it auto-separates
 * without any configuration.
 */

const NS = (import.meta.env.VITE_STORAGE_NS as string | undefined) ?? _defaultNs()

function _defaultNs(): string {
  // Deterministic short hash of the origin so different ports/domains never collide.
  const src = window.location.origin
  let h = 0
  for (let i = 0; i < src.length; i++) {
    h = (Math.imul(31, h) + src.charCodeAt(i)) >>> 0
  }
  return `mp_${h.toString(36)}`
}

export const storage = {
  ns: NS,

  key(k: string): string {
    return `${NS}:${k}`
  },

  get(k: string): string | null {
    try { return localStorage.getItem(`${NS}:${k}`) } catch { return null }
  },

  set(k: string, v: string): void {
    try { localStorage.setItem(`${NS}:${k}`, v) } catch { /* storage full */ }
  },

  remove(k: string): void {
    try { localStorage.removeItem(`${NS}:${k}`) } catch { /* ignore */ }
  },

  /** Convenience: read a string value and return it, or the fallback. */
  getOr<T extends string>(k: string, fallback: T): T {
    return (this.get(k) as T | null) ?? fallback
  },
}
