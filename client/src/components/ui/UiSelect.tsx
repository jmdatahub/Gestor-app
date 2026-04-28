import { useState, useRef } from 'react'
import { ChevronDown, Check, Search, Plus } from 'lucide-react'
import { UiPopover } from './UiPopover'

export interface UiSelectOption {
  value: string
  label: string
  icon?: React.ReactNode
  meta?: string
  disabled?: boolean
}

export interface UiSelectProps {
  value: string | null
  onChange: (value: string) => void
  options: UiSelectOption[]
  placeholder?: string
  label?: string
  disabled?: boolean
  error?: string
  searchable?: boolean
  creatable?: boolean
  onCreate?: (inputValue: string) => void
  className?: string
  id?: string
}

export function UiSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  disabled = false,
  error,
  searchable = false,
  creatable = false,
  onCreate,
  className = '',
  id
}: UiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)

  const computedId = id || `ui-select-${Math.random().toString(36).substr(2, 9)}`

  const selectedOption = options.find(o => o.value === value)

  const filteredOptions = searchable 
    ? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!isOpen) { 
              setIsOpen(true)
          }
      }
      if (e.key === 'Escape') {
          setIsOpen(false)
          triggerRef.current?.focus()
      }
  }

  const handleSelect = (val: string) => {
      onChange(val)
      setIsOpen(false)
  }

  // When opening, reset search if needed
  const handleToggle = (e: React.MouseEvent) => {
     e.stopPropagation()
     if (!disabled) {
        if (!isOpen) setSearchTerm('')
        setIsOpen(!isOpen)
     }
  }

  return (
    <div className={`ui-select-container ${className}`}>
      <button
        ref={triggerRef}
        id={computedId}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`ui-select-trigger ${error ? 'is-error' : ''} ${isOpen ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="ui-select-value">
           {selectedOption?.icon && <span className="ui-option-icon">{selectedOption.icon}</span>}
           <span className={`${!selectedOption ? 'placeholder' : ''}`}>
             {selectedOption ? selectedOption.label : placeholder}
           </span>
        </span>
        <ChevronDown size={16} className={`ui-select-caret ${isOpen ? 'is-open' : ''}`} />
      </button>

      <UiPopover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        matchWidth={true}
        className="flex flex-col"
      >
          {searchable && (
             <div className="ui-popover-search">
                <div style={{ position: 'relative' }}>
                    <Search className="ui-popover-search-icon" />
                    <input 
                      autoFocus
                      type="text"
                      className="ui-popover-search-input"
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
             </div>
          )}

          <div className="ui-option-list">
             {filteredOptions.length === 0 ? (
                 creatable && searchTerm.trim() ? (
                    <div
                      role="option"
                      onClick={() => {
                          onCreate?.(searchTerm)
                          setIsOpen(false)
                          setSearchTerm('')
                      }}
                      className="ui-option"
                      style={{ color: 'var(--primary)' }}
                    >
                        <div className="ui-option-content">
                            <Plus size={14} />
                            <span>Crear "{searchTerm}"</span>
                        </div>
                    </div>
                 ) : (
                    <div className="ui-option" style={{ cursor: 'default', opacity: 0.7, justifyContent: 'center' }}>
                        No hay opciones
                    </div>
                 )
             ) : (
                 filteredOptions.map((opt) => (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={value === opt.value}
                      onClick={() => !opt.disabled && handleSelect(opt.value)}
                      className={`ui-option ${value === opt.value ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''}`}
                    >
                       <div className="ui-option-content">
                          {opt.icon && <span className="ui-option-icon">{opt.icon}</span>}
                          <span>{opt.label}</span>
                       </div>
                       {value === opt.value && <Check size={14} />}
                    </div>
                 ))
             )}
          </div>
      </UiPopover>
    </div>
  )
}
