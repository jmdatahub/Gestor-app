import { useState, useEffect, useRef } from 'react'
import { ChevronDown, X, Check, Plus } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { type Category } from '../services/movementService'

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  categories: Category[]
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
}

export function CategorySelect({ 
  value, 
  onChange, 
  categories, 
  placeholder,
}: CategorySelectProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Filter categories based on search (case-insensitive, accent-insensitive)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }

  const filteredCategories = categories.filter(cat => {
    if (!search.trim()) return true
    const normalizedSearch = normalizeText(search)
    const normalizedName = normalizeText(cat.name)
    return normalizedName.includes(normalizedSearch)
  })

  // Find selected category
  const selectedCategory = categories.find(c => c.name === value)

  const handleSelect = (category: Category) => {
    onChange(category.name)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearch('')
  }

  const handleCreateNew = () => {
    onChange(search.trim())
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Main Button/Display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 cursor-pointer hover:border-primary transition-colors"
        style={{ minHeight: '48px' }}
      >
        {selectedCategory ? (
          <div className="flex items-center gap-3 flex-1">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selectedCategory.color || '#6b7280' }}
            />
            <span className="text-gray-800 dark:text-gray-200 font-medium">
              {selectedCategory.name}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">
            {placeholder || t('categories.select')}
          </span>
        )}
        
        <div className="flex items-center gap-2">
          {selectedCategory && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown 
            size={18} 
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden"
          style={{ maxHeight: '300px' }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('categories.placeholder')}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Category List */}
          <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
            {filteredCategories.length > 0 ? (
              filteredCategories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => handleSelect(cat)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                    cat.name === value 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color || '#6b7280' }}
                    />
                    <span className={`font-medium ${cat.name === value ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}`}>
                      {cat.name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      cat.kind === 'income' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {cat.kind === 'income' ? t('movements.type.income') : t('movements.type.expense')}
                    </span>
                  </div>
                  {cat.name === value && <Check size={16} className="text-primary" />}
                </div>
              ))
            ) : search.trim() ? (
              // Create new option
              <div
                onClick={handleCreateNew}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 text-primary"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus size={16} />
                </div>
                <div>
                  <div className="font-medium">Crear "{search}"</div>
                  <div className="text-xs text-gray-500">Nueva categoría</div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm">
                No hay categorías
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
