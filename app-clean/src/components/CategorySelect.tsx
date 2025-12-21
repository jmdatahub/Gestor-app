import { useState, useEffect } from 'react'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { getCategorySuggestions, type CategorySuggestion } from '../utils/categorySearch'
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
  required = false,
  autoFocus = false
}: CategorySelectProps) {
  const { t } = useI18n()
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      // If suggestions closed explicitly or empty value (unless focused logic handles it), skip
      // Actually we want to search whenever value changes if focused?
      // For simplicity, let's keep it similar: search if value exists
      
      if (!value.trim()) {
        setSuggestions([])
        return
      }

      const results = getCategorySuggestions(value, categories)
      setSuggestions(results)
      setActiveSuggestionIndex(0)
    }, 150)

    return () => clearTimeout(timer)
  }, [value, categories])

  const selectSuggestion = (catName: string) => {
    onChange(catName)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0 && suggestions[activeSuggestionIndex]) {
        selectSuggestion(suggestions[activeSuggestionIndex].category.name)
      } else if (value.trim()) {
        setShowSuggestions(false)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowSuggestions(true)
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => value.trim() && setShowSuggestions(true)}
        onBlur={() => {
          // Delayed hide to allow click
          setTimeout(() => setShowSuggestions(false), 200)
        }}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        autoFocus={autoFocus}
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && value.trim() && (
        <div className="suggestions-dropdown">
          {suggestions.length > 0 ? (
            suggestions.map((s, index) => (
              <div
                key={s.category.id}
                className={`suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                onClick={() => selectSuggestion(s.category.name)}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
              >
                <div className="flex flex-col">
                  <span className="suggestion-match">{s.category.name}</span>
                  <div className="suggestion-info">
                    {s.category.kind === 'income' ? (
                      <span className="text-success text-xs flex items-center gap-1">
                        <TrendingUp size={10} /> {t('movements.type.income')}
                      </span>
                    ) : (
                      <span className="text-danger text-xs flex items-center gap-1">
                        <TrendingDown size={10} /> {t('movements.type.expense')}
                      </span>
                    )}
                  </div>
                </div>
                {/* Color Dot if available */}
                {s.category.color && (
                  <div 
                    style={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: '50%', 
                      backgroundColor: s.category.color 
                    }} 
                  />
                )}
              </div>
            ))
          ) : (
            // No match -> Auto-create message (unless empty)
             <div className="p-3 text-sm text-gray-500 italic border-t border-gray-100 bg-gray-50/50">
               <div className="flex items-center gap-2">
                 <Plus size={14} />
                 <span>{t('categories.createAuto', { name: value })}</span>
               </div>
             </div>
          )}
          
          {suggestions.length > 0 && !suggestions.some(s => s.isStrongMatch) && (
            <div className="p-2 text-xs text-center text-gray-400 border-t border-gray-100">
               {t('categories.selectExisting')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
