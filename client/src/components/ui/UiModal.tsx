import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Push a synthetic history entry when a modal opens so that the browser
 * back button closes the modal instead of navigating away.
 */
function useModalHistory(isOpen: boolean, onClose: () => void) {
  // Track whether the popstate handler itself closed the modal so we
  // don't call history.back() a second time in cleanup.
  const closedByPopState = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    closedByPopState.current = false;

    // Push a dummy state so "back" lands here first
    window.history.pushState({ modal: true }, '');

    const handlePopState = () => {
      // The user pressed back — close the modal (don't navigate)
      closedByPopState.current = true;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // If modal was closed programmatically (not via browser back),
      // remove the dummy history entry we pushed.
      if (!closedByPopState.current && window.history.state?.modal) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);
}

export interface UiModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full' | string;
  className?: string;
  closeOnOutsideClick?: boolean;
  title?: string; // Optional title shown in header
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function UiModal({
  isOpen,
  onClose,
  children,
  width = 'md',
  className = '',
  closeOnOutsideClick = true,
  title
}: UiModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Browser back button closes modal (fix #11)
  useModalHistory(isOpen, onClose);

  // Close on ESC + focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Store the element that had focus before opening
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Move focus into the modal on next tick.
    // Prefer the first form input/select/textarea so the user can type immediately.
    // Fall back to any focusable element (e.g. a close button).
    const frameId = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      // Check for an explicit autoFocus element first
      const autoFocused = containerRef.current.querySelector<HTMLElement>('[autofocus]');
      if (autoFocused) { autoFocused.focus(); return; }
      // Prefer first input/select/textarea over buttons
      const firstInput = containerRef.current.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
      );
      if (firstInput) { firstInput.focus(); return; }
      // Fall back to first focusable
      const first = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)[0];
      if (first) first.focus();
      else containerRef.current.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );
      if (focusable.length === 0) { e.preventDefault(); return; }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the trigger element when modal closes
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  // Prevent scrolling when open — iOS-safe scroll lock
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.classList.add('modal-open');
    } else {
      const top = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.classList.remove('modal-open');
      if (top) {
        window.scrollTo(0, parseInt(top || '0') * -1);
      }
    }
    return () => {
      const top = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.classList.remove('modal-open');
      if (top) {
        window.scrollTo(0, parseInt(top || '0') * -1);
      }
    };
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
        ref={containerRef}
        className={`ui-modal-container ${maxWidthClass} ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={customStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {title && <UiModalHeader titleId={titleId} title={title} onClose={onClose} />}
        {children}
      </div>
    </div>,
    document.body
  );
}

// Sub-components for identifying standard parts
export const UiModalHeader = ({ children, className = '', title, titleId, onClose }: { children?: React.ReactNode, className?: string, title?: string, titleId?: string, onClose?: () => void }) => (
  <div className={`ui-modal-header ${className}`}>
    {title && <h3 id={titleId} className="ui-modal-title">{title}</h3>}
    {children}
    {onClose && (
      <button onClick={onClose} className="ui-modal-close-btn" aria-label="Cerrar">
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
