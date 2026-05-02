/**
 * Tests for client-side pure utility functions:
 * - date.ts    (parseISODateString, formatISODateString, formatHumanDate, formatFullDate)
 * - format.ts  (toDate, formatDate, formatNumber, formatEUR)
 * - categoryColors.ts (getDefaultCategoryColor, getLuminance, getTextColorClass)
 * - categorySearch.ts (normalizeText, getCategorySuggestions, isStrongMatch)
 * - errorUtils.ts (formatSupabaseError, mapSupabaseErrorToSpanish, getFriendlyErrorMessage)
 */
import { describe, it, expect } from 'vitest'

// ─── date.ts ──────────────────────────────────────────────────────────────────
import {
  parseISODateString,
  formatISODateString,
  formatHumanDate,
  formatFullDate,
} from './date'

describe('parseISODateString', () => {
  it('parses a valid ISO date string', () => {
    const date = parseISODateString('2025-06-15')
    expect(date).toBeInstanceOf(Date)
    expect(date!.getFullYear()).toBe(2025)
  })

  it('returns undefined for null', () => {
    expect(parseISODateString(null)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(parseISODateString(undefined)).toBeUndefined()
  })

  it('returns undefined for an invalid string', () => {
    expect(parseISODateString('not-a-date')).toBeUndefined()
  })
})

describe('formatISODateString', () => {
  it('formats a valid Date to YYYY-MM-DD', () => {
    const date = new Date(2025, 5, 15) // June 15 2025 (month is 0-indexed)
    expect(formatISODateString(date)).toBe('2025-06-15')
  })

  it('returns empty string for null', () => {
    expect(formatISODateString(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatISODateString(undefined)).toBe('')
  })
})

describe('formatHumanDate', () => {
  it('returns a non-empty human readable string', () => {
    const date = new Date(2025, 0, 17) // Jan 17
    const result = formatHumanDate(date, 'es')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('2025')
  })

  it('returns empty string for null', () => {
    expect(formatHumanDate(null)).toBe('')
  })
})

describe('formatFullDate', () => {
  it('returns a formatted string containing the year', () => {
    const date = new Date(2025, 11, 25) // Dec 25
    const result = formatFullDate(date, 'es')
    expect(result).toContain('2025')
  })

  it('returns empty string for null', () => {
    expect(formatFullDate(null)).toBe('')
  })
})

// ─── format.ts ────────────────────────────────────────────────────────────────
import { toDate, formatDate, formatNumber, formatEUR } from './format'
import type { AppSettings } from '../context/SettingsContext'

const baseSettings: AppSettings = {
  theme: 'light',
  dateFormat: 'dd/MM/yyyy',
  decimalSeparator: 'dot',
  currency: 'EUR',
  language: 'es',
}

describe('toDate', () => {
  it('returns the same Date if given a Date', () => {
    const d = new Date(2025, 0, 1)
    expect(toDate(d)).toBe(d)
  })

  it('parses an ISO string', () => {
    const d = toDate('2025-03-10T00:00:00Z')
    expect(d).toBeInstanceOf(Date)
    expect(d.getUTCFullYear()).toBe(2025)
  })

  it('falls back to "now" for an invalid string', () => {
    const before = Date.now()
    const d = toDate('totally-invalid')
    const after = Date.now()
    expect(d.getTime()).toBeGreaterThanOrEqual(before)
    expect(d.getTime()).toBeLessThanOrEqual(after)
  })
})

describe('formatDate', () => {
  it('formats with dd/MM/yyyy by default', () => {
    const result = formatDate(new Date(2025, 5, 15), baseSettings)
    expect(result).toBe('15/06/2025')
  })

  it('formats with MM/dd/yyyy when setting is set', () => {
    const s = { ...baseSettings, dateFormat: 'MM/dd/yyyy' as const }
    const result = formatDate(new Date(2025, 5, 15), s)
    expect(result).toBe('06/15/2025')
  })
})

describe('formatNumber', () => {
  it('formats a number with dot decimal separator', () => {
    const result = formatNumber(1234.56, baseSettings)
    // dot separator: decimal = '.', thousands = ','
    expect(result).toBe('1,234.56')
  })

  it('formats with comma decimal separator', () => {
    const s = { ...baseSettings, decimalSeparator: 'comma' as const }
    const result = formatNumber(1234.56, s)
    // comma separator: decimal = ',', thousands = '.'
    expect(result).toBe('1.234,56')
  })

  it('handles string values', () => {
    const result = formatNumber('999.9', baseSettings)
    expect(result).toBe('999.90')
  })

  it('handles non-finite values as 0', () => {
    const result = formatNumber(NaN, baseSettings)
    expect(result).toBe('0.00')
  })

  it('respects decimals parameter', () => {
    const result = formatNumber(100, baseSettings, 0)
    expect(result).toBe('100')
  })
})

describe('formatEUR', () => {
  it('appends euro sign', () => {
    const result = formatEUR(50, baseSettings)
    expect(result).toContain('€')
    expect(result).toContain('50')
  })
})

// ─── categoryColors.ts ────────────────────────────────────────────────────────
import {
  getDefaultCategoryColor,
  getLuminance,
  getTextColorClass,
  categoryColorPalette,
} from './categoryColors'

describe('getDefaultCategoryColor', () => {
  it('returns a hex color string', () => {
    const color = getDefaultCategoryColor(0)
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('wraps around the palette on overflow', () => {
    const len = categoryColorPalette.length
    expect(getDefaultCategoryColor(len)).toBe(getDefaultCategoryColor(0))
    expect(getDefaultCategoryColor(len + 1)).toBe(getDefaultCategoryColor(1))
  })
})

describe('getLuminance', () => {
  it('returns a value between 0 and 1', () => {
    const l = getLuminance('#818cf8')
    expect(l).toBeGreaterThanOrEqual(0)
    expect(l).toBeLessThanOrEqual(1)
  })

  it('returns ~1 for white', () => {
    expect(getLuminance('#ffffff')).toBeCloseTo(1, 1)
  })

  it('returns ~0 for black', () => {
    expect(getLuminance('#000000')).toBeCloseTo(0, 1)
  })
})

describe('getTextColorClass', () => {
  it('returns dark class for a light background', () => {
    expect(getTextColorClass('#ffffff')).toBe('category-pill--light')
  })

  it('returns dark class for a dark background', () => {
    // Dark red — luminance < 0.5 → should be "dark" text
    expect(getTextColorClass('#1a0000')).toBe('category-pill--dark')
  })

  it('returns light class for null/undefined', () => {
    expect(getTextColorClass(null)).toBe('category-pill--light')
    expect(getTextColorClass(undefined)).toBe('category-pill--light')
  })
})

// ─── categorySearch.ts ────────────────────────────────────────────────────────
import {
  normalizeText,
  getCategorySuggestions,
  isStrongMatch,
} from './categorySearch'
import type { Category } from '../services/movementService'

function makeCategory(id: string, name: string): Category {
  return { id, name, kind: 'expense', user_id: 'u1', color: undefined }
}

const categories: Category[] = [
  makeCategory('1', 'Alimentación'),
  makeCategory('2', 'Transporte'),
  makeCategory('3', 'Restaurantes'),
  makeCategory('4', 'Salud'),
  makeCategory('5', 'Ocio'),
]

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('HELLO')).toBe('hello')
  })

  it('removes diacritics', () => {
    expect(normalizeText('Alimentación')).toBe('alimentacion')
  })

  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello')
  })
})

describe('getCategorySuggestions', () => {
  it('returns empty array for empty query', () => {
    expect(getCategorySuggestions('', categories)).toEqual([])
  })

  it('returns exact match with score 1.0', () => {
    const results = getCategorySuggestions('Salud', categories)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBe(1.0)
    expect(results[0].category.name).toBe('Salud')
  })

  it('returns prefix matches', () => {
    const results = getCategorySuggestions('Ali', categories)
    expect(results.some(r => r.category.name === 'Alimentación')).toBe(true)
  })

  it('marks exact matches as strong', () => {
    const results = getCategorySuggestions('Ocio', categories)
    expect(results[0].isStrongMatch).toBe(true)
  })

  it('respects the limit parameter', () => {
    const results = getCategorySuggestions('a', categories, 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('returns fuzzy match for typo', () => {
    // "Salid" is close to "Salud"
    const results = getCategorySuggestions('Salid', categories)
    const names = results.map(r => r.category.name)
    expect(names).toContain('Salud')
  })
})

describe('isStrongMatch', () => {
  it('returns true for exact match (case insensitive, diacritics ignored)', () => {
    expect(isStrongMatch('alimentacion', 'Alimentación')).toBe(true)
  })

  it('returns false for partial match', () => {
    expect(isStrongMatch('Alim', 'Alimentación')).toBe(false)
  })
})

// ─── errorUtils.ts ────────────────────────────────────────────────────────────
import {
  formatSupabaseError,
  mapSupabaseErrorToSpanish,
  getFriendlyErrorMessage,
} from './errorUtils'

describe('formatSupabaseError', () => {
  it('extracts message from error object', () => {
    const err = formatSupabaseError({ message: 'Something failed', code: 'XX999' })
    expect(err.message).toBe('Something failed')
    expect(err.code).toBe('XX999')
  })

  it('wraps a plain string', () => {
    const err = formatSupabaseError('plain error')
    expect(err.message).toBe('plain error')
  })

  it('returns fallback message for unknown types', () => {
    const err = formatSupabaseError(42)
    expect(err.message).toBe('Ha ocurrido un error inesperado')
  })
})

describe('mapSupabaseErrorToSpanish', () => {
  it('maps RLS violation to friendly message', () => {
    const result = mapSupabaseErrorToSpanish({ message: 'violates row-level security', code: '42501' })
    expect(result.title).toMatch(/permisos/i)
  })

  it('maps duplicate key to friendly message', () => {
    const result = mapSupabaseErrorToSpanish({ message: 'duplicate key value', code: '23505' })
    expect(result.title).toMatch(/duplicado/i)
  })

  it('maps foreign key violation', () => {
    const result = mapSupabaseErrorToSpanish({ message: 'foreign key', code: '23503' })
    expect(result.title).toMatch(/dependencia/i)
  })

  it('maps not-null violation', () => {
    const result = mapSupabaseErrorToSpanish({ message: 'not null', code: '23502' })
    expect(result.title).toMatch(/incompletos/i)
  })

  it('returns default fallback for unknown errors', () => {
    const result = mapSupabaseErrorToSpanish({ message: 'something went wrong' })
    expect(result.title).toBeTruthy()
    expect(result.description).toContain('something went wrong')
  })
})

describe('getFriendlyErrorMessage', () => {
  it('returns a non-empty string combining title and description', () => {
    const result = getFriendlyErrorMessage({ message: 'duplicate key value', code: '23505' })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain(':')
  })
})
