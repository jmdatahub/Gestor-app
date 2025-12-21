import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface UiDropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'left' | 'right'
}

export function UiDropdown({ trigger, children, align = 'right' }: UiDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width?: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const scrollY = window.scrollY
      
      setCoords({
        top: rect.bottom + scrollY + 4,
        left: align === 'left' ? rect.left + window.scrollX : rect.right + window.scrollX,
        width: rect.width
      })
    }
  }

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, { capture: true })
    }
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, { capture: true })
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        // Also check if clicking inside the dropdown content (handled by portal)
        const dropdown = document.getElementById('ui-dropdown-portal')
        if (dropdown && !dropdown.contains(e.target as Node)) {
          setIsOpen(false)
        }
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen])

  return (
    <>
      <div 
        ref={triggerRef} 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'inline-block', cursor: 'pointer' }}
      >
        {trigger}
      </div>

      {isOpen && createPortal(
        <div
          id="ui-dropdown-portal"
          className="ui-popover"
          style={{
            position: 'absolute',
            top: coords.top,
            left: align === 'left' ? coords.left : undefined,
            right: align === 'right' ? (document.documentElement.clientWidth - coords.left) : undefined,
            minWidth: '200px',
            zIndex: 9999,
          }}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  )
}

export function UiDropdownItem({ 
  children, 
  onClick, 
  icon,
  danger = false
}: { 
  children: React.ReactNode
  onClick?: () => void
  icon?: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      className={`ui-option ${danger ? 'text-danger' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      style={{ width: '100%', border: 'none', background: 'transparent' }}
    >
      <div className="ui-option-content">
        {icon && <span className="ui-option-icon">{icon}</span>}
        <span>{children}</span>
      </div>
    </button>
  )
}
