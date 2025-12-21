import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface UiModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full' | string; 
  className?: string;
  closeOnOutsideClick?: boolean;
}

export function UiModal({ 
  isOpen, 
  onClose, 
  children, 
  width = 'md', 
  className = '',
  closeOnOutsideClick = true 
}: UiModalProps) {
  
  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevent scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-4xl' // full usually means max supported
  };

  const isPreset = width in widthClasses;
  const maxWidthClass = isPreset ? widthClasses[width as keyof typeof widthClasses] : '';
  const customStyle = !isPreset ? { maxWidth: width } : {};

  return createPortal(
    <div className="ui-modal-overlay" onClick={closeOnOutsideClick ? onClose : undefined}>
      <div 
        className={`ui-modal-container ${maxWidthClass} ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={customStyle}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// Sub-components for identifying standard parts
export const UiModalHeader = ({ children, className = '', title, onClose }: { children?: React.ReactNode, className?: string, title?: string, onClose?: () => void }) => (
  <div className={`ui-modal-header ${className}`}>
    {title && <h3 className="ui-modal-title">{title}</h3>}
    {children}
    {onClose && (
      <button onClick={onClose} className="ui-modal-close-btn" aria-label="Close">
        <X size={20} />
      </button>
    )}
  </div>
);

export const UiModalBody = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`ui-modal-body ${className}`}>
    {children}
  </div>
);

export const UiModalFooter = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`ui-modal-footer ${className}`}>
    {children}
  </div>
);
