import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search, Plus } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  // Optional extra data (e.g. for rich rendering of categories)
  meta?: any 
}

export interface SelectSearchProps {
  label?: string
  value: string // For controlled input, this might be the selected ID
  // If we want to allow "creating" new values, value might be the text typed if no match?
  // Or usually we have 'inputValue' vs 'selectedValue'.
  // For simplicity, let's behave like common Select: value is the ID.
  // But for Category, user types text.
  // The User Request says: "En 'Categoría'... Al escribir, filtrar y sugerir... Si no existe, opción 'Crear X'".
  // This implies it's a Combobox where you can type freely OR select.
  // If strictly "SelectSearch", usually it's "Search to Filter Options".
  // If "Combobox", it's "Type value or Select".
  
  // Let's implement as "Searchable Select" primarily, but with "Creatable" support.
  onChange: (value: string) => void
  onSearchChange?: (text: string) => void // If we want to capture typing for external filtering
  options: SelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  width?: string | number
  id?: string
  className?: string
  error?: string
  creatable?: boolean // If true, shows "Create 'X'" if no match
  onCreate?: (text: string) => void // Callback when creating
}

interface DropdownPosition {
  top?: number
  bottom?: number
  left: number
  width: number
  direction: 'up' | 'down'
}

export function SelectSearch({
  label,
  value,
  onChange,
  onSearchChange,
  options,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  disabled = false,
  width,
  id,
  className = '',
  error,
  creatable = false,
  onCreate
}: SelectSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [position, setPosition] = useState<DropdownPosition | null>(null)

  const selectedOption = options.find(opt => opt.value === value)
  const computedId = id || `select-search-${Math.random().toString(36).substr(2, 9)}`

  // Filter options
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const showCreateOption = creatable && searchTerm.trim().length > 0 && filteredOptions.length === 0

  // Calculate position logic (Same as Select.tsx)
  const calculatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const GAP = 4
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const fitsBelow = spaceBelow >= 200 
      
      let direction: 'up' | 'down' = 'down'
      if (!fitsBelow && spaceAbove > spaceBelow) {
        direction = 'up'
      }

      const calculated: DropdownPosition = {
         left: rect.left,
         width: rect.width,
         direction
      }

      if (direction === 'down') {
        calculated.top = rect.bottom + GAP
      } else {
         calculated.bottom = window.innerHeight - rect.top + GAP
      }
      setPosition(calculated)
    }
  }

  useEffect(() => {
    if (isOpen) {
      calculatePosition()
      window.addEventListener('scroll', calculatePosition, { capture: true })
      window.addEventListener('resize', calculatePosition)
      // Focus search input
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchTerm('') // Reset search on close? Or keep it? Usually reset.
      window.removeEventListener('scroll', calculatePosition, { capture: true })
      window.removeEventListener('resize', calculatePosition)
    }
    return () => {
       window.removeEventListener('scroll', calculatePosition, { capture: true })
       window.removeEventListener('resize', calculatePosition)
    }
  }, [isOpen])

  // Scroll to highlighted
  useEffect(() => {
      if (isOpen && dropdownRef.current) {
         const items = dropdownRef.current.querySelectorAll('.select-option')
         if (items[highlightedIndex]) {
             items[highlightedIndex].scrollIntoView({ block: 'nearest' })
         }
      }
  }, [highlightedIndex])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const handleCreate = () => {
    if (onCreate) {
      onCreate(searchTerm)
      setIsOpen(false)
      triggerRef.current?.focus()
    }
  }

  const navLimit = filteredOptions.length + (showCreateOption ? 1 : 0)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
       if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault()
          setIsOpen(true)
       }
       return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => (prev < navLimit - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        e.preventDefault()
        if (showCreateOption && highlightedIndex === filteredOptions.length) {
            handleCreate()
        } else if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        triggerRef.current?.focus()
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  return (
    <div className={`select-container ${className}`} style={{ width: width || '100%' }}>
      {label && <label htmlFor={computedId} className="label">{label}</label>}
      
      {/* Trigger Button (Same look as Select) */}
      <button
        ref={triggerRef}
        id={computedId}
        type="button"
        className={`select-trigger ${error ? 'select-trigger--error' : ''} ${isOpen ? 'is-open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown} // Keydown on trigger opens menu
        disabled={disabled}
      >
        <span className={`select-value ${!selectedOption ? 'placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={16} 
          className={`select-chevron ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {error && <span className="form-error">{error}</span>}

      {/* Portal Menu */}
      {isOpen && position && createPortal(
        <div
          ref={dropdownRef}
          className={`select-menu select-menu--${position.direction}`}
          style={{
            position: 'fixed',
            top: position.top !== undefined ? position.top : 'auto',
            bottom: position.bottom !== undefined ? position.bottom : 'auto',
            left: position.left,
            width: position.width,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Search Input Sticky Top */}
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
             <div className="relative">
                <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setHighlightedIndex(0)
                      if (onSearchChange) onSearchChange(e.target.value)
                  }}
                  onKeyDown={handleKeyDown} // Delegate key nav to parent handler logic
                  onClick={(e) => e.stopPropagation()}
                />
             </div>
          </div>

          <div className="overflow-y-auto flex-1 max-h-[200px]">
            {filteredOptions.length === 0 && !showCreateOption ? (
               <div className="p-3 text-sm text-gray-500 text-center">No hay resultados</div>
            ) : (
               filteredOptions.map((option, index) => {
                 const isSelected = option.value === value
                 const isHighlighted = index === highlightedIndex
                 
                 return (
                   <div
                     key={option.value}
                     className={`select-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''} ${option.disabled ? 'disabled' : ''}`}
                     onClick={() => handleSelect(option)}
                     onMouseEnter={() => setHighlightedIndex(index)}
                   >
                     <span className="truncate">{option.label}</span>
                     {isSelected && <Check size={14} className="text-primary" />}
                   </div>
                 )
               })
            )}

            {showCreateOption && (
                <div
                    className={`select-option text-primary ${highlightedIndex === filteredOptions.length ? 'highlighted' : ''}`}
                    onClick={handleCreate}
                    onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                >
                    <Plus size={14} className="mr-2" />
                    Crear "{searchTerm}"
                </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
