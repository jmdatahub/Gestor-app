/**
 * API Client - Wrapper para mutaciones de Supabase
 * 
 * Proporciona:
 * - Timeout automático
 * - Normalización de errores
 * - Telemetría local
 * - Manejo consistente de loading states
 */

import { normalizeSupabaseError, type NormalizedError } from '../utils/errorCatalog'
import { logEvent } from './telemetryService'

export interface MutationResult<T> {
  ok: boolean
  data: T | null
  error: NormalizedError | null
  durationMs: number
}

export interface MutationOptions {
  timeout?: number  // ms, default 15000
  context?: string  // Spanish description for errors
}

const DEFAULT_TIMEOUT = 15000 // 15 seconds

/**
 * Execute a mutation with timeout, error normalization, and telemetry
 * 
 * @example
 * const result = await runMutation('crear movimiento', async () => {
 *   const { data, error } = await supabase.from('movements').insert([...]).select().single()
 *   if (error) throw error
 *   return data
 * })
 * 
 * if (!result.ok) {
 *   showError(result.error)
 * }
 */
export async function runMutation<T>(
  actionName: string,
  fn: () => Promise<T>,
  options: MutationOptions = {}
): Promise<MutationResult<T>> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const context = options.context ?? actionName
  const startTime = performance.now()
  
  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`TIMEOUT: La operación "${actionName}" tardó más de ${timeout/1000}s`))
      }, timeout)
    })
    
    // Race between mutation and timeout
    const data = await Promise.race([fn(), timeoutPromise])
    
    const durationMs = Math.round(performance.now() - startTime)
    
    // Log success
    logEvent({
      actionName,
      ok: true,
      code: 'SUCCESS',
      durationMs
    })
    
    return {
      ok: true,
      data,
      error: null,
      durationMs
    }
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime)
    
    // Check if it's a timeout
    const isTimeout = err instanceof Error && err.message.startsWith('TIMEOUT:')
    
    // Normalize error
    const normalizedError = isTimeout 
      ? {
          userMessageES: `La operación tardó demasiado. Verifica tu conexión e intenta de nuevo.`,
          code: 'TIMEOUT' as const,
          debug: {
            originalMessage: err.message,
            context
          },
          suggestedFixChecklist: [
            'Comprueba tu conexión a internet',
            'El servidor puede estar lento, intenta en unos minutos',
            'Si el problema persiste, recarga la página'
          ]
        }
      : normalizeSupabaseError(err, context)
    
    // Log failure
    logEvent({
      actionName,
      ok: false,
      code: normalizedError.code,
      durationMs,
      errorMessage: normalizedError.debug.originalMessage
    })
    
    console.error(`[runMutation] ${actionName} failed:`, normalizedError)
    
    return {
      ok: false,
      data: null,
      error: normalizedError,
      durationMs
    }
  }
}

/**
 * Helper to throw if Supabase returns an error
 * Use inside runMutation to properly propagate errors
 */
export function throwIfError<T>(response: { data: T | null; error: unknown }): T {
  if (response.error) {
    throw response.error
  }
  if (response.data === null) {
    throw new Error('No data returned from operation')
  }
  return response.data
}

/**
 * Convenience wrapper for Supabase insert operations
 */
export async function runInsert<T>(
  tableName: string,
  insertFn: () => Promise<{ data: T | null; error: unknown }>,
  options: MutationOptions = {}
): Promise<MutationResult<T>> {
  const actionName = options.context || `insertar en ${tableName}`
  
  return runMutation(actionName, async () => {
    const response = await insertFn()
    return throwIfError(response)
  }, options)
}

/**
 * Convenience wrapper for Supabase update operations
 */
export async function runUpdate<T>(
  tableName: string,
  updateFn: () => Promise<{ data: T | null; error: unknown }>,
  options: MutationOptions = {}
): Promise<MutationResult<T>> {
  const actionName = options.context || `actualizar ${tableName}`
  
  return runMutation(actionName, async () => {
    const response = await updateFn()
    return throwIfError(response)
  }, options)
}

/**
 * Convenience wrapper for Supabase delete operations
 */
export async function runDelete(
  tableName: string,
  deleteFn: () => Promise<{ error: unknown }>,
  options: MutationOptions = {}
): Promise<MutationResult<void>> {
  const actionName = options.context || `eliminar de ${tableName}`
  
  return runMutation(actionName, async () => {
    const response = await deleteFn()
    if (response.error) throw response.error
  }, options)
}
