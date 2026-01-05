import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, useDayPicker } from 'react-day-picker'
import { es, enUS } from 'date-fns/locale'
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatHumanDate, parseISODateString } from '../../utils/date'
import { useI18n } from '../../hooks/useI18n'
import { UiSelect } from './UiSelect'

// Import basic DayPicker styles
import 'react-day-picker/style.css'

export interface DatePickerProps {
  label?: string
  value: string | Date | null // Accepts ISO string "yyyy-mm-dd" or Date object
  onChange: (date: Date | null) => void // Returns Date object (or null) - consumer can format to string if needed
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  placeholder?: string
  required?: boolean
  id?: string
  name?: string
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
  const { goToMonth, nextMonth, previousMonth, months } = useDayPicker()
  // RDP v9: 'months' is array of month objects currently displayed.
  // Use the first one for the caption.
  const displayMonth = months?.[0]?.date || new Date()
  
  const currentYear = displayMonth.getFullYear()
  const currentMonth = displayMonth.getMonth()
  
  // Year Range: 1900 to 2050 (USER REQUEST)
  const fromYear = 1900
  const toYear = 2050
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i)

  // Month Names (Capitalized)
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  // Options for UiSelect
  const monthOptions = monthNames.map((m, i) => ({ value: String(i), label: m }))
  const yearOptions = years.map(y => ({ value: String(y), label: String(y) }))

  const handleChangeYear = (val: string) => {
    const newYear = parseInt(val)
    goToMonth(new Date(newYear, currentMonth))
  }

  const handleChangeMonth = (val: string) => {
    const newMonth = parseInt(val)
    goToMonth(new Date(currentYear, newMonth))
  }

  return (
    <div className="caption-container flex items-center justify-between p-2 mb-2 bg-gray-50/50 rounded-lg border border-gray-100 dark:bg-gray-800/50 dark:border-gray-700">
       <button 
         onClick={() => previousMonth && goToMonth(previousMonth)}
         disabled={!previousMonth}
         className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
         type="button"
       >
         <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />
       </button>

       <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
         {/* Month Select - Using UiSelect */}
         <div className="ui-select-small">
           <UiSelect
             value={String(currentMonth)}
             onChange={handleChangeMonth}
             options={monthOptions}
             placeholder="Mes"
           />
         </div>

         {/* Year Select - Using UiSelect */}
         <div className="ui-select-small">
           <UiSelect
             value={String(currentYear)}
             onChange={handleChangeYear}
             options={yearOptions}
             placeholder="Año"
           />
         </div>
       </div>

       <button 
         onClick={() => nextMonth && goToMonth(nextMonth)}
         disabled={!nextMonth}
         className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
         type="button"
       >
         <ChevronRight size={16} className="text-gray-600 dark:text-gray-300" />
       </button>
    </div>
  )
}

export function DatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  placeholder = 'Seleccionar fecha...',
  required = false,
  id,
  error,
  className = ''
}: DatePickerProps) {
  const { t, language } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<DropdownPosition | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const computedId = id || `date-picker-${Math.random().toString(36).substr(2, 9)}`
  
  // Normalize value to Date or undefined
  const selectedDate = typeof value === 'string' ? parseISODateString(value) : value
  
  // Calculate Position (reused logic from Select/SelectSearch roughly)
  const calculatePosition = () => {
    if (window.innerWidth < 640) {
        setIsMobile(true)
        return // Mobile uses bottom sheet
    }
    setIsMobile(false)

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const fitsBelow = spaceBelow >= 350 // Calendar is usually taller
      
      let direction: 'up' | 'down' = 'down'
      if (!fitsBelow && spaceAbove > spaceBelow) {
        direction = 'up'
      }

      const calculated: DropdownPosition = {
         left: rect.left, // Aligned to left
         direction
      }

      if (direction === 'down') {
        calculated.top = rect.bottom + 4
      } else {
         calculated.bottom = window.innerHeight - rect.top + 4
      }
      
      // Fix overflow right if needed
      if (rect.left + 320 > window.innerWidth) { // 320px approx calendar width
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

  // Click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
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

  const handleSelect = (date: Date | undefined) => {
    onChange(date || null)
    if (date) {
        // Short delay to see selection animation
        setTimeout(() => setIsOpen(false), 150)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const localeMap: Record<string, typeof es> = {
      es: es,
      en: enUS
  }

  const currentLocale = localeMap[language] || es

  return (
    <div className={`date-picker-container ${className}`}>
      {label && <label htmlFor={computedId} className="label">{label}</label>}
      
      <button
        ref={triggerRef}
        id={computedId}
        type="button"
        className={`select-trigger ${error ? 'select-trigger--error' : ''} ${isOpen ? 'is-open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={`select-value ${!selectedDate ? 'placeholder' : ''}`}>
           <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-gray-400" />
               <span>{selectedDate ? formatHumanDate(selectedDate, language) : placeholder}</span>
           </div>
        </span>
        
        {selectedDate && !disabled && !required && (
            <div 
                role="button"
                className="p-1 hover:bg-gray-100 rounded-full mr-1 transition-colors"
                onClick={handleClear}
            >
                <X size={14} className="text-gray-400 hover:text-red-500" />
            </div>
        )}
      </button>

      {error && <span className="form-error">{error}</span>}

      {isOpen && createPortal(
        <>
            {/* Mobile Overlay */}
            {isMobile && (
                <div className="fixed inset-0 bg-black/50 z-[9998] animate-fadeIn" onClick={() => setIsOpen(false)} />
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
                } : undefined} // undefined style for mobile, handled by CSS class
            >
                {/* Mobile Header handle */}
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
                    // captionLayout="dropdown" // REMOVED: Conflicts with custom Caption component
                    fromYear={1900}
                    toYear={2050}
                    // REMOVED Custom classNames to allow default style.css to work!
                    components={{
                        // @ts-expect-error - Caption override is valid in runtime but types might be strict
                        Caption: CustomCaption
                    }}
                />
                
                <div className="dp-footer">
                   <button 
                     type="button" 
                     className="dp-today-btn"
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
