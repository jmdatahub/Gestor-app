import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, Plus, X } from 'lucide-react'
import { UiPopover } from './UiPopover'

export interface UiComboboxOption {
  value: string
  label: string
  icon?: React.ReactNode
  meta?: string
  disabled?: boolean
}

interface UiComboboxProps {
  value: string | null
  onChange: (value: string) => void
  options: UiComboboxOption[]
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  creatable?: boolean
  onCreate?: (inputValue: string) => void
  className?: string
}

export function UiCombobox({
  value,
  onChange,
  options = [],
  // label is in props interface but not currently used in component
  placeholder = 'Seleccionar o escribir...',
  error,
  disabled = false,
  creatable = false,
  onCreate,
  className = ''
}: UiComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Find selected option to initialize text
  const selectedOption = options.find(o => o.value === value)
  const [searchTerm, setSearchTerm] = useState(selectedOption?.label || '')
  
  // Update text when value changes externally (e.g. initial load or reset)
  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption.label)
    } else if (!value) {
      setSearchTerm('')
    }
  }, [value, selectedOption])

  const triggerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter options
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options
    return options.filter(o => 
      o.label.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [options, searchTerm])

  const showCreateOption = creatable && searchTerm.trim().length > 0 && !filteredOptions.some(o => o.label.toLowerCase() === searchTerm.toLowerCase())

  const handleSelect = (option: UiComboboxOption) => {
    onChange(option.value)
    setSearchTerm(option.label)
    setIsOpen(false)
  }

  const handleCreate = () => {
    if (onCreate) {
      onCreate(searchTerm)
      setIsOpen(false)
      // The parent should handle setting the value to the new ID/tempID
      // But we keep the text
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) setIsOpen(true)
      // Focus logic would go here ideally (using a list index)
    }
    
    if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen) {
         if (filteredOptions.length > 0) {
             handleSelect(filteredOptions[0]) // Auto-select first match on Enter? Or only if focused?
             // Simplest: Select first match if exact or similar? 
             // Better: close if exact match, else nothing or create?
         } else if (showCreateOption) {
             handleCreate()
         }
      } else {
        setIsOpen(true)
      }
    }

    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  // Clear selection
  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange('')
      setSearchTerm('')
      inputRef.current?.focus()
  }

  const toggleOpen = () => {
    if (disabled) return
    setIsOpen(!isOpen)
    if (!isOpen) {
       inputRef.current?.focus()
    }
  }

  return (
    <div className={`ui-input-container ${className}`}>
      {/* Trigger Area (Input + Icons) */}
      <div 
         ref={triggerRef}
         className={`
           relative flex items-center bg-white dark:bg-slate-900 border transition-all duration-200 rounded-xl
           ${error ? 'border-red-400 focus-within:ring-red-100' : 'border-gray-200 dark:border-gray-700 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10'}
           ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}
         `}
         onClick={() => !isOpen && setIsOpen(true)}
      >
        <div className="pl-3 text-gray-400">
           {selectedOption?.icon} 
           {/* If typing no match, maybe show generic icon? */}
        </div>
        
        <input 
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
              setSearchTerm(e.target.value)
              if (!isOpen) setIsOpen(true)
              // Optional: Clear value if text mismatch? 
              // Usually yes, if typing -> value is undefined until selection.
              // But user asked for "autocomplete categories".
              if (selectedOption && e.target.value !== selectedOption.label) {
                 // User modified text of a selected item -> Deselect value, but keep text
                 // This might trigger parent to clear ID
                 // onChange('') // Maybe not, depends on UX.
              }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent border-none outline-none py-3 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 placeholder-opacity-70"
          autoComplete="off"
        />

        <div className="flex items-center gap-1 pr-2">
           {value && !disabled && (
              <button 
                type="button" 
                onClick={handleClear}
                className="p-1 text-gray-300 hover:text-gray-500 rounded-full transition-colors"
              >
                  <X size={14} />
              </button>
           )}
           <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
              className={`p-1 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
           >
              <ChevronDown size={18} />
           </button>
        </div>
      </div>
      
      {/* Error Message */}
      {error && <div className="text-[11px] font-medium text-red-500 mt-1.5 ml-1">{error}</div>}

      {/* Popover List */}
      <UiPopover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        matchWidth={true}
        className="flex flex-col max-h-60 overflow-y-auto py-1"
      >
         {filteredOptions.length === 0 && !showCreateOption ? (
            <div className="py-3 px-4 text-sm text-gray-400 text-center italic">
               No hay coincidencias
            </div>
         ) : (
             <>
                {filteredOptions.map((opt) => (
                   <div
                     key={opt.value}
                     onClick={() => handleSelect(opt)}
                     className={`
                        flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm transition-colors
                        ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'}
                     `}
                   >
                      <div className="flex items-center gap-3">
                         {opt.icon && <span className="opacity-80">{opt.icon}</span>}
                         <span>{opt.label}</span>
                      </div>
                      {value === opt.value && <Check size={14} />}
                   </div>
                ))}

                {showCreateOption && (
                   <div
                      onClick={handleCreate}
                      className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5 cursor-pointer text-sm text-primary hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-medium flex items-center gap-2"
                   >
                      <Plus size={14} />
                      Crear "{searchTerm}"
                   </div>
                )}
             </>
         )}
      </UiPopover>
    </div>
  )
}
