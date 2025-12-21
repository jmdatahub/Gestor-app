import React, { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { UiSelect, UiSelectOption } from '../ui/UiSelect'
import { UiField } from '../ui/UiField'



interface CategoryPickerProps {
  value: string | null // category_id
  onChange: (value: string) => void
  type?: 'expense' | 'income' // Filter by type if needed
  label?: string
  error?: string
}

export function CategoryPicker({ value, onChange, type = 'expense', label = 'Categoría', error }: CategoryPickerProps) {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<UiSelectOption[]>([])
  
  useEffect(() => {
    loadCategories()
  }, [type])

  const loadCategories = async () => {
     try {
         setLoading(true)
         const { data, error } = await supabase
           .from('categories')
           .select('*')
           .eq('type', type)
           .order('name')
         
         if (error) throw error
         
         setCategories(data || [])
         mapOptions(data || [])
     } catch (err) {
         console.error('Error loading categories:', err)
     } finally {
         setLoading(false)
     }
  }

  const mapOptions = (cats: any[]) => {
      const opts: UiSelectOption[] = cats.map(c => ({
          value: c.id,
          label: c.name,
          icon: <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#9ca3af' }} />
      }))
      setOptions(opts)
  }

  // Handle "Create New" logic 
  const handleCreate = (text: string) => {
      // Add temporary option so it can be selected
      const newValue = `__new__:${text}`
      const newOption: UiSelectOption = {
          value: newValue,
          label: text,
          icon: <Plus className="w-3 h-3 text-primary" />,
          meta: 'New'
      }
      setOptions(prev => [...prev, newOption])
      onChange(newValue)
  }
  
  return (
    <UiField label={label} error={error}>
        <UiSelect 
           value={value} 
           onChange={onChange} 
           options={options}
           searchable={true}
           creatable={true}
           onCreate={handleCreate}
           placeholder={loading ? "Cargando..." : "Selecciona una categoría"}
           disabled={loading}
        />
    </UiField>
  )
}
