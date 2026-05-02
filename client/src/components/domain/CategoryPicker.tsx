import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../lib/apiClient'
import { UiField } from '../ui/UiField'
import { Plus, Check, ChevronDown, X, Search } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'

interface CategoryPickerProps {
  value: string | null
  onChange: (value: string) => void
  type?: 'expense' | 'income'
  label?: string
  error?: string
}

export function CategoryPicker({ value, onChange, type = 'expense', label, error }: CategoryPickerProps) {
  const { t } = useI18n()
  const resolvedLabel = label ?? t('common.category')
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  // Clear selection when type changes if the current value belongs to the wrong type
  useEffect(() => {
    if (!value || value.startsWith('__new__:')) return
    const selectedCat = categories.find(c => c.id === value)
    if (selectedCat && (selectedCat.kind ?? selectedCat.type) !== type) {
      onChange('')
    }
  }, [type])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inDropdown = dropdownRef.current?.contains(target)
      if (!inContainer && !inDropdown) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // 1. Calculate Position
      if (containerRef.current) {
         const rect = containerRef.current.getBoundingClientRect()
         setCoords({
            top: rect.bottom + 6, // 6px margin
            left: rect.left,
            width: rect.width
         })
      }

      // 2. Focus input
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 50)
      }

      // 3. Add scroll listener to close on scroll (prevent floating), but ignore scroll inside the dropdown itself
      const handleScroll = (e: Event) => {
        if (dropdownRef.current?.contains(e.target as Node)) return
        setIsOpen(false)
      }
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleScroll)

      return () => {
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleScroll)
      }
    }
  }, [isOpen])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const { data } = await api.get<{ data: any[] }>('/api/v1/categories')
      setCategories(data || [])
    } catch (err) {
      console.error('Error loading categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const filtered = categories.filter(c => {
    // Server returns categories with field 'kind' (not 'type')
    const catKind = c.kind ?? c.type
    if (catKind !== type) return false
    if (!searchTerm.trim()) return true
    return normalize(c.name).startsWith(normalize(searchTerm))
  })

  const selected = value && !value.startsWith('__new__:') ? categories.find(c => c.id === value) : null
  const newCatName = value?.startsWith('__new__:') ? value.split(':')[1] : null

  const handleSelect = (cat: any) => {
    onChange(cat.id)
    setSearchTerm('')
    setIsOpen(false)
    setActiveIndex(-1)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleCreate = () => {
    if (!searchTerm.trim()) return
    onChange(`__new__:${searchTerm.trim()}`)
    setIsOpen(false)
    setSearchTerm('')
    setActiveIndex(-1)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleClear = () => {
    onChange('')
    setSearchTerm('')
    setActiveIndex(-1)
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(!isOpen)
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <UiField label={resolvedLabel} error={error}>
      <div ref={containerRef} style={{ position: 'relative' }}>
        {/* Selected Chip or Trigger */}
        {selected || newCatName ? (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={handleTriggerKeyDown}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--primary-soft)',
              border: '2px solid var(--primary-border, var(--primary))',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: selected?.color || 'var(--primary)',
                  boxShadow: `0 0 8px ${selected?.color || 'var(--primary)'}40`,
                  flexShrink: 0
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                {selected?.name || newCatName}
              </span>
              {newCatName && (
                <span style={{
                  fontSize: '10px',
                  background: 'var(--primary)',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700
                }}>{t('categories.new').toUpperCase()}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                role="button"
                aria-label={t('categoryPicker.clear')}
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleClear() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleClear() } }}
                style={{
                  padding: '4px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover, var(--bg-surface))')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={14} style={{ color: 'var(--text-muted)' }} />
              </span>
              <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
          </button>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={handleTriggerKeyDown}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1.5px solid var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('categoryPicker.placeholder')}</span>
            <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        )}

        {/* Dropdown (Portal) */}
        {isOpen && createPortal(
          <div ref={dropdownRef} style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            maxHeight: Math.min(300, window.innerHeight - coords.top - 20),
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-popover)',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'dropIn 0.15s ease-out',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <style>{`@keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* Search */}
            <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ color: 'var(--text-muted)', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setActiveIndex(-1) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsOpen(false)
                      requestAnimationFrame(() => triggerRef.current?.focus())
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setActiveIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1))
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      if (activeIndex >= 0 && filtered[activeIndex]) {
                        handleSelect(filtered[activeIndex])
                      } else if (filtered.length === 0 && searchTerm.trim()) {
                        handleCreate()
                      } else if (filtered.length > 0) {
                        handleSelect(filtered[0])
                      }
                    }
                  }}
                  placeholder={t('common.search') + '...'}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Options */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('common.loading')}
                </div>
              ) : filtered.length > 0 ? (
                filtered.map((cat, i) => (
                  <div
                    key={cat.id}
                    role="option"
                    aria-selected={cat.id === value}
                    onClick={() => handleSelect(cat)}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: cat.id === value ? 'var(--primary-soft)' : activeIndex === i ? 'var(--gray-100)' : 'transparent',
                      borderLeft: cat.id === value ? '3px solid var(--primary)' : activeIndex === i ? '3px solid var(--primary)' : '3px solid transparent',
                      outline: activeIndex === i ? '2px solid var(--primary)' : 'none',
                      outlineOffset: '-2px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: cat.color || ['#ef4444','#f97316','#22c55e','#3b82f6','#8b5cf6'][i % 5],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'white',
                        textTransform: 'uppercase'
                      }}>
                        {cat.name.charAt(0)}
                      </span>
                      <span style={{ fontWeight: 500, color: cat.id === value ? 'var(--primary)' : 'var(--text-primary)', fontSize: '14px' }}>
                        {cat.name}
                      </span>
                    </div>
                    {cat.id === value && <Check size={16} style={{ color: 'var(--primary)' }} />}
                  </div>
                ))
              ) : searchTerm.trim() ? (
                <div
                  onClick={handleCreate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background: 'var(--primary-soft)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary-soft)')}
                >
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Plus size={14} color="white" />
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '14px' }}>
                      {t('categoryPicker.create', { name: searchTerm })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('categoryPicker.newCategory')}</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('categories.empty')}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </UiField>
  )
}
