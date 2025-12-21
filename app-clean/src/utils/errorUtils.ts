export interface AppError {
  message: string
  details?: string
  hint?: string
  code?: string
  // Enhanced fields
  title?: string
  action?: string
}

export interface FriendlyError {
  title: string
  description: string
  action?: string
}

export function formatSupabaseError(error: any): AppError {
  // It's already an AppError-like shape
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      message: error.message || 'Error desconocido',
      details: error.details || error.description || undefined,
      hint: error.hint || undefined,
      code: error.code || undefined
    }
  }

  // It's a string
  if (typeof error === 'string') {
    return { message: error }
  }

  // It's something else
  return { 
    message: 'Ha ocurrido un error inesperado',
    details: JSON.stringify(error)
  }
}

export function mapSupabaseErrorToSpanish(error: AppError): FriendlyError {
  // 1. Column not found (Schema mismatch)
  if (error.message?.includes("Could not find the 'category' column") || error.message?.includes("column \"category\" does not exist")) {
    return {
      title: 'Desajuste de Base de Datos',
      description: 'La aplicación intenta guardar un dato ("category") que no existe en la estructura actual de la base de datos.',
      action: 'Es necesario ejecutar la migración SQL para añadir la columna "category_id" o actualizar el caché del esquema.'
    }
  }

  // 2. RLS / Permissions
  if (error.code === '42501' || error.message?.includes('violates row-level security')) {
    return {
      title: 'Permisos insuficientes',
      description: 'No tienes permiso para realizar esta acción. Puede deberse a una sesión caducada o restricciones de seguridad.',
      action: 'Prueba a cerrar sesión y volver a entrar.'
    }
  }

  // 3. Unique violation
  if (error.code === '23505' || error.message?.includes('duplicate key value')) {
    return {
      title: 'Registro duplicado',
      description: 'Ya existe un elemento con estos mismos datos (probablemente el nombre o identificador).',
      action: 'Intenta usar otro nombre o verifica si ya lo creaste.'
    }
  }

  // 4. Foreign Key violation
  if (error.code === '23503') {
    return {
      title: 'Dependencia no encontrada',
      description: 'Estás intentando asociar este elemento a algo que ya no existe (por ejemplo, una cuenta o categoría eliminada).',
      action: 'Recarga la página para actualizar las listas.'
    }
  }

  // 5. Not Null violation
  if (error.code === '23502') {
    return {
      title: 'Datos incompletos',
      description: 'Falta un campo obligatorio que no se ha enviado.',
      action: 'Revisa el formulario y asegúrate de rellenar todos los campos requeridos.'
    }
  }

  // Default fallback
  return {
    title: 'Error al realizar la acción',
    description: error.message || 'Ha ocurrido un error inesperado.',
    action: error.hint || 'Inténtalo de nuevo más tarde.'
  }
}

export function getFriendlyErrorMessage(error: AppError): string {
  const friendly = mapSupabaseErrorToSpanish(error)
  return `${friendly.title}: ${friendly.description}`
}
