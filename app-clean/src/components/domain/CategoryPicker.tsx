import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { UiField } from '../ui/UiField'
import { Plus, Check, ChevronDown, X, Search } from 'lucide-react'

interface CategoryPickerProps {
  value: string | null
  onChange: (value: string) => void
  type?: 'expense' | 'income'
  label?: string
  error?: string
}

export function CategoryPicker({ value, onChange, type: _type = 'expense', label = 'Categoría', error }: CategoryPickerProps) {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const { data } = await supabase.from('categories').select('*').order('name')
      setCategories(data || [])
    } catch (err) {
      console.error('Error loading categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const filtered = categories.filter(c => {
    if (!searchTerm.trim()) return true
    return normalize(c.name).startsWith(normalize(searchTerm))
  })

  const selected = value && !value.startsWith('__new__:') ? categories.find(c => c.id === value) : null
  const newCatName = value?.startsWith('__new__:') ? value.split(':')[1] : null

  const handleSelect = (cat: any) => {
    onChange(cat.id)
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleCreate = () => {
    if (!searchTerm.trim()) return
    onChange(`__new__:${searchTerm.trim()}`)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = () => {
    onChange('')
    setSearchTerm('')
  }

  return (
    <UiField label={label} error={error}>
      <div ref={containerRef} style={{ position: 'relative' }}>
        {/* Selected Chip or Trigger */}
        {selected || newCatName ? (
          <div 
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.03) 100%)',
              border: '2px solid rgba(99,102,241,0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span 
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: selected?.color || '#6366f1',
                  boxShadow: `0 0 8px ${selected?.color || '#6366f1'}40`
                }}
              />
              <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px' }}>
                {selected?.name || newCatName}
              </span>
              {newCatName && (
                <span style={{ 
                  fontSize: '10px', 
                  background: '#6366f1', 
                  color: 'white', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  fontWeight: 700
                }}>NUEVA</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span 
                onClick={(e) => { e.stopPropagation(); handleClear() }}
                style={{ 
                  padding: '4px', 
                  borderRadius: '50%', 
                  cursor: 'pointer',
                  display: 'flex',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={14} color="#94a3b8" />
              </span>
              <ChevronDown size={16} color="#94a3b8" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'transparent',
              border: '2px solid #334155',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#475569')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
          >
            <span style={{ color: '#64748b', fontSize: '14px' }}>Seleccionar categoría...</span>
            <ChevronDown size={16} color="#64748b" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
        )}

        {/* Dropdown */}
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '6px',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            zIndex: 100,
            overflow: 'hidden',
            animation: 'dropIn 0.15s ease-out'
          }}>
            <style>{`@keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            {/* Search */}
            <div style={{ padding: '12px', borderBottom: '1px solid #334155' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsOpen(false)
                    if (e.key === 'Enter' && filtered.length === 0 && searchTerm.trim()) {
                      e.preventDefault()
                      handleCreate()
                    }
                  }}
                  placeholder="Buscar..."
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Options */}
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  Cargando...
                </div>
              ) : filtered.length > 0 ? (
                filtered.map((cat, i) => (
                  <div
                    key={cat.id}
                    onClick={() => handleSelect(cat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: cat.id === value ? 'rgba(99,102,241,0.15)' : 'transparent',
                      borderLeft: cat.id === value ? '3px solid #6366f1' : '3px solid transparent',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => { if (cat.id !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={(e) => { if (cat.id !== value) e.currentTarget.style.background = 'transparent' }}
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
                      <span style={{ fontWeight: 500, color: cat.id === value ? '#818cf8' : '#e2e8f0', fontSize: '14px' }}>
                        {cat.name}
                      </span>
                    </div>
                    {cat.id === value && <Check size={16} color="#818cf8" />}
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
                    background: 'rgba(99,102,241,0.05)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
                >
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Plus size={14} color="white" />
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: '#c7d2fe', fontSize: '14px' }}>
                      Crear "{searchTerm}"
                    </div>
                    <div style={{ fontSize: '11px', color: '#6366f1' }}>Nueva categoría</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  No hay categorías
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </UiField>
  )
}
