import { format, parseISO, isValid } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

// Default to device locale if available, or fallback to es/en based on simple check
// Ideally passed from the component which reads from context, but for 'formatHuman' helper we can accept locale string.

type LocaleCode = 'es' | 'en'

const locales: Record<LocaleCode, any> = {
  es,
  en: enUS
}

/**
 * Parses an ISO date string (YYYY-MM-DD) into a Date object.
 * Returns null if invalid or empty.
 * Note: parseISO handles timezones by treating "YYYY-MM-DD" as local time (usually desirable for date pickers)
 * or UTC depending on string format? 
 * Actually standard parseISO("2023-12-17") returns midnight local time.
 */
export function parseISODateString(dateString: string | undefined | null): Date | undefined {
  if (!dateString) return undefined
  const date = parseISO(dateString)
  return isValid(date) ? date : undefined
}

/**
 * Formats a Date object into "YYYY-MM-DD" string.
 * Returns empty string if date is invalid/null.
 */
export function formatISODateString(date: Date | undefined | null): string {
  if (!date || !isValid(date)) return ''
  return format(date, 'yyyy-MM-dd')
}

/**
 * Formats a Date object into a human-readable string (e.g. "17 dic 2025").
 */
export function formatHumanDate(date: Date | undefined | null, localeCode: LocaleCode = 'es'): string {
  if (!date || !isValid(date)) return ''
  return format(date, 'd MMM yyyy', { locale: locales[localeCode] })
}

/**
 * Formats a Date object into a full human-readable string (e.g. "Miércoles, 17 de diciembre").
 */
export function formatFullDate(date: Date | undefined | null, localeCode: LocaleCode = 'es'): string {
  if (!date || !isValid(date)) return ''
  return format(date, 'EEEE, d MMMM yyyy', { locale: locales[localeCode] })
}
