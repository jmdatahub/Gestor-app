import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface UiPopoverProps {
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLElement>
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  matchWidth?: boolean
  mobileSheet?: boolean
}

interface Position {
  top?: number
  bottom?: number
  left: number
  width?: number
  direction: 'up' | 'down'
  maxHeight: number
}

export function UiPopover({
  isOpen,
  onClose,
  triggerRef,
  children,
  className = '',
  style,
  matchWidth = false,
  mobileSheet = true
}: UiPopoverProps) {
  const [position, setPosition] = useState<Position | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(mobileSheet && window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [mobileSheet])

  const calculatePosition = () => {
    if (!triggerRef.current || isMobile) return

    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top
    
    // Configurable thresholds
    const minHeightNeeded = 200
    const preferredDirection = spaceBelow >= minHeightNeeded ? 'down' : (spaceAbove > spaceBelow ? 'up' : 'down')

    let top: number | undefined
    let bottom: number | undefined
    let maxHeight = 0

    if (preferredDirection === 'down') {
       top = rect.bottom + 4
       maxHeight = Math.min(300, spaceBelow - 20)
    } else {
       bottom = viewportHeight - rect.top + 4
       maxHeight = Math.min(300, spaceAbove - 20)
    }

    // Safety check for horizontal overflow (basic)
    let left = rect.left
    const width = matchWidth ? rect.width : undefined
    
    // If popover is likely to go off-screen right
    if (!matchWidth && left + 300 > window.innerWidth) {
       left = Math.max(10, window.innerWidth - 300 - 10)
    }

    setPosition({
      top,
      bottom,
      left,
      width,
      direction: preferredDirection,
      maxHeight
    })
  }

  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition()
      window.addEventListener('resize', calculatePosition)
      window.addEventListener('scroll', calculatePosition, { capture: true })
    }
    return () => {
      window.removeEventListener('resize', calculatePosition)
      window.removeEventListener('scroll', calculatePosition, { capture: true })
    }
  }, [isOpen, isMobile, matchWidth])

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Ignore clicks inside trigger
      if (triggerRef.current?.contains(e.target as Node)) return
      // Ignore clicks inside popover
      if (contentRef.current?.contains(e.target as Node)) return

      if (isOpen) onClose()
    }
    
    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        // Also handle escape
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEsc)
        
        return () => {
             document.removeEventListener('mousedown', handleClickOutside)
             document.removeEventListener('keydown', handleEsc)
        }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Mobile Sheet View
  if (isMobile) {
      return createPortal(
          <>
             <div 
               className="fixed inset-0 bg-black/50 z-[9998] transition-opacity" 
               onClick={onClose}
               style={{ animation: 'fadeIn 0.2s ease-out' }}
             />
             <div 
               ref={contentRef}
               className={`dp-mobile-sheet fixed bottom-0 left-0 right-0 bg-white rounded-t-xl z-[9999] p-4 flex flex-col max-h-[80vh] overflow-auto shadow-2xl ${className}`}
               style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
             >
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4 shrink-0" />
                {children}
             </div>
          </>,
          document.body
      )
  }

  // Desktop Popover View
  if (!position) return null

  return createPortal(
    <div
      ref={contentRef}
      className={`ui-popover fixed bg-white rounded-lg shadow-lg border border-gray-200 z-[9999] overflow-auto ${className}`}
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        animation: 'fadeIn 0.15s ease-out',
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}
