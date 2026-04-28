import { useState, useEffect, useMemo, useCallback } from 'react'
import { UiSelect, UiSelectOption } from '../ui/UiSelect'
import { UiField } from '../ui/UiField'
import { supabase } from '../../lib/supabaseClient'
import { normalizeText, getCategorySuggestions } from '../../utils/categorySearch'

interface Category {
  id: string
  name: string
  color?: string
  type: 'income' | 'expense'
  usage_count?: number
  last_used_at?: string
}

export interface CategoryAutocompleteProps {
  value: string | null // category_id or "__new__:name" for new categories
  onChange: (value: string) => void
  type?: 'expense' | 'income' | 'investment' // Filter by type
  label?: string
  error?: string
  placeholder?: string
  disabled?: boolean
}

/**
 * CategoryAutocomplete - Sistema inteligente de categorías
 * 
 * Features:
 * - Muestra categorías al focus (sin escribir)
 * - Filtra en tiempo real desde la primera letra
 * - Ranking: uso reciente + frecuencia
 * - Permite crear nueva categoría con confirmación
 */
export function CategoryAutocomplete({ 
  value, 
  onChange, 
  type = 'expense', 
  label = 'Categoría', 
  error,
  placeholder,
  disabled = false
}: CategoryAutocompleteProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm] = useState('')
  
  useEffect(() => {
    loadCategories()
  }, [type])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const { data, error: loadError } = await supabase
        .from('categories')
        .select('*')
        .order('name')
      
      if (loadError) throw loadError
      
      // Filter by type
      const filtered = (data || []).filter(c => 
        c.type === type || type === 'investment'
      )
      
      setCategories(filtered as Category[])
    } catch (err) {
      console.error('[CategoryAutocomplete] Error loading categories:', err)
    } finally {
      setLoading(false)
    }
  }

  // Rank categories by usage + recency
  const rankedCategories = useMemo(() => {
    if (!categories.length) return []
    
    const now = new Date().getTime()
    
    return [...categories].sort((a, b) => {
      // Calculate recency score (decay over time)
      const recencyA = a.last_used_at 
        ? Math.max(0, 1 - (now - new Date(a.last_used_at).getTime()) / (30 * 24 * 60 * 60 * 1000)) 
        : 0
      const recencyB = b.last_used_at 
        ? Math.max(0, 1 - (now - new Date(b.last_used_at).getTime()) / (30 * 24 * 60 * 60 * 1000)) 
        : 0
      
      // Combined score: usage (40%) + recency (40%) + alphabetic (20%)
      const scoreA = (a.usage_count || 0) * 0.4 + recencyA * 100 * 0.4
      const scoreB = (b.usage_count || 0) * 0.4 + recencyB * 100 * 0.4
      
      if (Math.abs(scoreB - scoreA) > 0.1) return scoreB - scoreA
      return a.name.localeCompare(b.name)
    })
  }, [categories])

  // Build options with intelligent ordering
  const options = useMemo((): UiSelectOption[] => {
    const cats = searchTerm 
      ? getCategorySuggestions(searchTerm, categories as any, 10).map(s => s.category as unknown as Category)
      : rankedCategories.slice(0, 15) // Top 15 by ranking
    
    return cats.map(c => ({
      value: c.id,
      label: c.name,
      icon: (
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: c.color || '#9ca3af' }} 
        />
      )
    }))
  }, [rankedCategories, searchTerm, categories])

  // Handle creating new category
  const handleCreate = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    
    // Check if already exists (case insensitive)
    const normalized = normalizeText(trimmed)
    const exists = categories.find(c => normalizeText(c.name) === normalized)
    
    if (exists) {
      // Select existing instead of creating
      onChange(exists.id)
      return
    }
    
    // Mark as new category to be created
    onChange(`__new__:${trimmed}`)
  }, [categories, onChange])

  // Resolve display value
  const displayValue = useMemo(() => {
    if (!value) return null
    if (value.startsWith('__new__:')) {
      return value // Keep as is for new category
    }
    return value
  }, [value])

  const computedPlaceholder = loading 
    ? 'Cargando categorías...' 
    : placeholder || 'Busca o selecciona categoría'

  return (
    <UiField label={label} error={error}>
      <UiSelect 
        value={displayValue} 
        onChange={onChange} 
        options={options}
        searchable={true}
        creatable={true}
        onCreate={handleCreate}
        placeholder={computedPlaceholder}
        disabled={disabled || loading}
      />
    </UiField>
  )
}

/**
 * Helper: Create category in database if value starts with __new__
 * Call this when submitting the form
 */
export async function resolveNewCategory(
  value: string, 
  type: 'income' | 'expense'
): Promise<string | null> {
  if (!value.startsWith('__new__:')) {
    return value // Already an ID
  }
  
  const name = value.replace('__new__:', '')
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuario no autenticado')
  
  // Create category
  const { data, error } = await supabase
    .from('categories')
    .insert([{
      user_id: user.id,
      name,
      type,
      color: generateRandomColor()
    }])
    .select()
    .single()
  
  if (error) throw error
  return data.id
}

function generateRandomColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', 
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
