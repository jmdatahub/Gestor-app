import { useState, useRef, useId, useEffect } from 'react'
import { ChevronDown, Check, Search, Plus } from 'lucide-react'
import { UiPopover } from './UiPopover'
import { useI18n } from '../../hooks/useI18n'

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
  placeholder,
  disabled = false,
  error,
  searchable = false,
  creatable = false,
  onCreate,
  className = '',
  id
}: UiSelectProps) {
  const { t } = useI18n()
  const resolvedPlaceholder = placeholder ?? t('common.select')
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  // Index of the keyboard-focused option (-1 = none, -2 = "create" row)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const generatedId = useId()
  const computedId = id || generatedId
  const listboxId = `${computedId}-listbox`

  const selectedOption = options.find(o => o.value === value)

  const filteredOptions = searchable
    ? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options

  // Reset active index whenever the list changes
  useEffect(() => {
    setActiveIndex(-1)
  }, [filteredOptions.length, isOpen])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]')
    items[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
    setSearchTerm('')
    // Return focus to the trigger after selection
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleCreate = () => {
    if (!searchTerm.trim()) return
    onCreate?.(searchTerm)
    setIsOpen(false)
    setSearchTerm('')
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (e.key === 'Enter' || e.key === ' ') {
      // Only open the dropdown — never submit the parent form
      if (!isOpen) {
        e.preventDefault()
        setSearchTerm('')
        setIsOpen(true)
      }
      // When open, Enter selects the active item or closes
      else if (e.key === 'Enter') {
        e.preventDefault()
        if (activeIndex === -2) {
          handleCreate()
        } else if (activeIndex >= 0 && filteredOptions[activeIndex] && !filteredOptions[activeIndex].disabled) {
          handleSelect(filteredOptions[activeIndex].value)
        } else {
          setIsOpen(false)
        }
      }
      return
    }

    if (e.key === 'Escape') {
      setIsOpen(false)
      triggerRef.current?.focus()
      return
    }

    // Arrow navigation — open dropdown if closed, then move
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setSearchTerm('')
        setIsOpen(true)
        setActiveIndex(0)
        return
      }
      const max = filteredOptions.length - 1
      if (e.key === 'ArrowDown') {
        setActiveIndex(prev => (prev < max ? prev + 1 : 0))
      } else {
        setActiveIndex(prev => (prev > 0 ? prev - 1 : max))
      }
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex === -2) {
        handleCreate()
      } else if (activeIndex >= 0 && filteredOptions[activeIndex] && !filteredOptions[activeIndex].disabled) {
        handleSelect(filteredOptions[activeIndex].value)
      } else if (creatable && searchTerm.trim() && filteredOptions.length === 0) {
        handleCreate()
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }

  // When opening, reset search if needed
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disabled) {
      if (!isOpen) setSearchTerm('')
      setIsOpen(!isOpen)
    }
  }

  const showCreateRow = creatable && searchTerm.trim() && filteredOptions.length === 0

  return (
    <div className={`ui-select-container ${className}`}>
      <button
        ref={triggerRef}
        id={computedId}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        className={`ui-select-trigger ${error ? 'is-error' : ''} ${isOpen ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${computedId}-option-${activeIndex}` : undefined
        }
      >
        <span className="ui-select-value">
          {selectedOption?.icon && <span className="ui-option-icon">{selectedOption.icon}</span>}
          <span className={`${!selectedOption ? 'placeholder' : ''}`}>
            {selectedOption ? selectedOption.label : resolvedPlaceholder}
          </span>
        </span>
        <ChevronDown size={16} className={`ui-select-caret ${isOpen ? 'is-open' : ''}`} />
      </button>

      <UiPopover
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); setSearchTerm('') }}
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
                placeholder={t('common.search') + '...'}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setActiveIndex(-1) }}
                onKeyDown={handleSearchKeyDown}
                aria-label={t('common.searchOptions')}
              />
            </div>
          </div>
        )}

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="ui-option-list"
          aria-label={t('common.options')}
        >
          {filteredOptions.length === 0 ? (
            showCreateRow ? (
              <div
                id={`${computedId}-option-create`}
                role="option"
                aria-selected={false}
                tabIndex={-1}
                onClick={handleCreate}
                className={`ui-option ${activeIndex === -2 ? 'is-active' : ''}`}
                style={{ color: 'var(--primary)' }}
                onMouseEnter={() => setActiveIndex(-2)}
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
            filteredOptions.map((opt, idx) => (
              <div
                key={opt.value}
                id={`${computedId}-option-${idx}`}
                role="option"
                aria-selected={value === opt.value}
                aria-disabled={opt.disabled}
                tabIndex={-1}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`ui-option ${value === opt.value ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''} ${activeIndex === idx ? 'is-active' : ''}`}
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
