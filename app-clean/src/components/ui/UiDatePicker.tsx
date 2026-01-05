import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, useDayPicker } from 'react-day-picker'
import { es, enUS } from 'date-fns/locale'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { formatHumanDate, parseISODateString } from '../../utils/date'
import { useI18n } from '../../hooks/useI18n'
import 'react-day-picker/style.css'
import { UiSelect } from './UiSelect'

export interface UiDatePickerProps {
  label?: string
  value: string | Date | null 
  onChange: (date: Date | null) => void
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  placeholder?: string
  required?: boolean
  id?: string
  error?: string
  className?: string
}

interface DropdownPosition {
  top?: number
  bottom?: number
  left: number
  width?: number
  direction: 'up' | 'down'
}

function CustomCaption() {
  const { goToMonth, months } = useDayPicker()
  const displayMonth = months?.[0]?.date || new Date()
  
  const currentYear = displayMonth.getFullYear()
  const currentMonth = displayMonth.getMonth()
  
  // Year Range: 1900 to 2050
  const fromYear = 1900
  const toYear = 2050
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i)

  // Month Names (Capitalized)
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const handleChangeYear = (val: string) => {
     const newYear = parseInt(val)
     goToMonth(new Date(newYear, currentMonth))
  }

  const handleChangeMonth = (val: string) => {
     const newMonth = parseInt(val)
     goToMonth(new Date(currentYear, newMonth))
  }

  return (
    <div className="d-flex items-center gap-2 p-2 mb-2 bg-gray-50 rounded-lg border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
         <div className="w-[140px]">
             <UiSelect 
               value={currentMonth.toString()} 
               onChange={handleChangeMonth}
               options={monthNames.map((m, i) => ({ value: i.toString(), label: m }))}
               className="ui-select-small"
             />
         </div>
         <div className="w-[100px]">
             <UiSelect 
               value={currentYear.toString()} 
               onChange={handleChangeYear}
               options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
               className="ui-select-small"
             />
         </div>
    </div>
  )
}

export function UiDatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  placeholder = 'Select date...',
  required = false,
  id,
  error,
  className = ''
}: UiDatePickerProps) {
  const { t, language } = useI18n()
  const lang = language 
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<DropdownPosition | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const computedId = id || `ui-datepicker-${Math.random().toString(36).substr(2, 9)}`
  const selectedDate = typeof value === 'string' ? parseISODateString(value) : value
  
  const localeMap: Record<string, any> = { es: es, en: enUS }
  const currentLocale = localeMap[language] || es

  // Position Calculation
  const calculatePosition = () => {
    if (window.innerWidth < 640) {
        setIsMobile(true)
        return 
    }
    setIsMobile(false)

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const fitsBelow = spaceBelow >= 350 
      
      let direction: 'up' | 'down' = 'down'
      if (!fitsBelow && spaceAbove > spaceBelow) {
        direction = 'up'
      }

      const calculated: DropdownPosition = {
         left: rect.left,
         direction
      }

      if (direction === 'down') {
        calculated.top = rect.bottom + 4
      } else {
         calculated.bottom = window.innerHeight - rect.top + 4
      }
      
      // Prevent overflow right
      if (rect.left + 320 > window.innerWidth) {
          calculated.left = Math.max(0, window.innerWidth - 320 - 20)
      }
      
      setPosition(calculated)
    }
  }

  useEffect(() => {
    if (isOpen) {
      calculatePosition()
      window.addEventListener('scroll', calculatePosition, { capture: true })
      window.addEventListener('resize', calculatePosition)
    } else {
      window.removeEventListener('scroll', calculatePosition, { capture: true })
      window.removeEventListener('resize', calculatePosition)
    }
    return () => {
       window.removeEventListener('scroll', calculatePosition, { capture: true })
       window.removeEventListener('resize', calculatePosition)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking inside UiSelect portals
      if ((event.target as HTMLElement).closest('.ui-popover')) return

      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (date: Date | undefined) => {
    onChange(date || null)
    if (date) setTimeout(() => setIsOpen(false), 150)
  }

  return (
    <div className={`date-picker-container ${className}`}>
      {label && <label htmlFor={computedId} className="label">{label}</label>}
      
      <button
        ref={triggerRef}
        id={computedId}
        type="button"
        className={`select-trigger ${error ? 'border-danger' : ''} ${isOpen ? 'is-open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={`select-value ${!selectedDate ? 'text-muted' : ''}`}>
           <div className="d-flex items-center gap-2">
              <CalendarIcon size={16} className="text-secondary" />
              <span>{selectedDate ? formatHumanDate(selectedDate, lang as 'es'|'en') : placeholder}</span>
           </div>
        </span>
        
        {selectedDate && !disabled && !required && (
            <div 
                role="button"
                className="p-1 hover:bg-gray-100 rounded-full mr-1 transition-colors"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
            >
                <X size={14} className="text-gray-400 hover:text-danger" />
            </div>
        )}
      </button>

      {error && <span className="form-error">{error}</span>}

      {isOpen && createPortal(
        <>
            {isMobile && (
                <div 
                    className="fixed inset-0 bg-black/50 z-[9998]" 
                    onClick={() => setIsOpen(false)} 
                />
            )}

            <div
                ref={calendarRef}
                className={`dp-popover ${isMobile ? 'dp-mobile-sheet' : ''} ${!isMobile && position?.direction === 'up' ? 'dp-popover--up' : 'dp-popover--down'}`}
                style={!isMobile && position ? {
                    position: 'fixed',
                    top: position.top !== undefined ? position.top : 'auto',
                    bottom: position.bottom !== undefined ? position.bottom : 'auto',
                    left: position.left,
                    zIndex: 9999
                } : undefined}
            >
                {isMobile && <div className="dp-mobile-handle" />}

                <DayPicker
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={handleSelect}
                    fromDate={minDate}
                    toDate={maxDate}
                    locale={currentLocale}
                    showOutsideDays
                    fixedWeeks
                    fromYear={1900}
                    toYear={2050}
                    components={{
                        // @ts-expect-error - Custom caption compatible
                        Caption: CustomCaption
                    }}
                />
                
                <div className="dp-footer border-t border-gray-100 p-2 text-center">
                   <button 
                     type="button" 
                     className="btn btn-ghost btn-sm w-full"
                     onClick={() => handleSelect(new Date())}
                   >
                     {t('common.today') || 'Hoy'}
                   </button>
                </div>
            </div>
        </>,
        document.body
      )}
    </div>
  )
}
