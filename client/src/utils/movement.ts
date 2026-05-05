// Centralized accessors for movement rows returned by /api/v1/movements.
// The server's mapOut emits `category: { id, name, color }` and `account: { id, name }`
// and DELETES the flat fields (`category_name`, `category_color`, `account_name`).
// Always read through these helpers so a future server-side rename surfaces here only.
// Legacy flat-field fallbacks are kept as a safety net for any non-standard caller.

type MaybeNamed = { name?: string | null } | null | undefined
type MaybeColored = { color?: string | null } | null | undefined

export interface MovementLike {
  category?: ({ id?: string; name?: string; color?: string | null } & MaybeNamed & MaybeColored) | string | null
  account?: ({ id?: string; name?: string } & MaybeNamed) | null
  // Legacy fields (should not appear in current API responses, kept for resilience)
  categoryName?: string | null
  category_name?: string | null
  categoryColor?: string | null
  category_color?: string | null
  accountName?: string | null
  account_name?: string | null
}

export function getCategoryName(m: MovementLike, fallback = 'Sin categoría'): string {
  const c = m.category
  if (c && typeof c === 'object' && 'name' in c && c.name) return String(c.name)
  if (typeof c === 'string' && c) return c
  return m.categoryName || m.category_name || fallback
}

export function getCategoryColor(m: MovementLike): string | undefined {
  const c = m.category
  if (c && typeof c === 'object' && 'color' in c && c.color) return String(c.color)
  return m.categoryColor || m.category_color || undefined
}

export function getAccountName(m: MovementLike, fallback = 'Sin cuenta'): string {
  const a = m.account
  if (a && typeof a === 'object' && 'name' in a && a.name) return String(a.name)
  return m.accountName || m.account_name || fallback
}
