import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  FileSpreadsheet, 
  FileText, 
  FileJson, 
  Printer, 
  Download,
  ChevronDown
} from 'lucide-react'
import { exportToExcel, ExcelColumn } from '../../utils/excelExport'
import { exportToCSV } from '../../utils/exportUtils'
import { downloadFile } from '../../services/exportService'

interface ExportMenuProps {
  data?: any[]
  fetchData?: () => Promise<any[]>
  filename: string
  columns: ExcelColumn[]
  buttonLabel?: string
  disabled?: boolean
  hideCSV?: boolean
}

export function ExportMenu({ 
  data, 
  fetchData,
  filename, 
  columns, 
  buttonLabel = 'Exportar',
  disabled = false,
  hideCSV = false
}: ExportMenuProps) {
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: rect.right + window.scrollX
      })
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen) {
        const dropdown = document.getElementById('export-menu-dropdown')
        if (dropdown && !dropdown.contains(e.target as Node) && 
            triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
          setIsOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const getData = async () => {
    if (data) return data
    if (fetchData) return await fetchData()
    return []
  }

  const handleAction = async (action: (d: any[]) => void) => {
    try {
      setLoading(true)
      const exportData = await getData()
      if (!exportData || exportData.length === 0) {
        alert('No hay datos para exportar')
        return
      }
      action(exportData)
    } catch (error) {
      console.error('Export error:', error)
      alert('Error al preparar la exportación')
    } finally {
      setLoading(false)
      setIsOpen(false)
    }
  }

  const handleExcel = () => handleAction((d) => exportToExcel(d, columns, filename))
  
  const handleCSV = () => handleAction((d) => {
    try {
      const csvHeaders = columns.map(c => ({ key: c.key, label: c.header }))
      console.log('[ExportMenu] CSV Headers:', csvHeaders)
      console.log('[ExportMenu] Data length:', d.length)
      console.log('[ExportMenu] Data sample:', JSON.stringify(d[0], null, 2))
      console.log('[ExportMenu] Columns:', JSON.stringify(columns, null, 2))
      
      // Debug: check if keys match
      if (d.length > 0) {
        const dataKeys = Object.keys(d[0])
        const headerKeys = csvHeaders.map(h => h.key)
        console.log('[ExportMenu] Data keys:', dataKeys)
        console.log('[ExportMenu] Header keys:', headerKeys)
        
        const missingKeys = headerKeys.filter(k => !dataKeys.includes(k))
        if (missingKeys.length > 0) {
          console.warn('[ExportMenu] WARNING: Missing keys in data:', missingKeys)
        }
      }
      
      exportToCSV(d, filename, csvHeaders)
    } catch (err) {
      console.error('[ExportMenu] CSV Error:', err)
      alert('Error generando CSV: ' + (err as Error).message)
    }
  })
  
  const handleJSON = () => handleAction((d) => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    downloadFile(blob, `${filename}.json`, 'application/json')
  })
  
  // Generate printable PDF with data table
  const handlePDF = () => handleAction((d) => {
    // Create HTML content with data table
    const headerRow = columns.map(c => `<th style="padding:8px 12px;text-align:left;background:#1e293b;color:white;font-weight:600;border-bottom:2px solid #334155;">${c.header}</th>`).join('')
    
    const dataRows = d.map((row, idx) => {
      const cells = columns.map(c => {
        const value = row[c.key] ?? ''
        return `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${value}</td>`
      }).join('')
      return `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">${cells}</tr>`
    }).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${filename}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #1e293b; }
          h1 { font-size: 18px; margin-bottom: 8px; }
          .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          @media print {
            body { padding: 0; }
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <h1>📊 ${filename}</h1>
        <div class="meta">Exportado el ${new Date().toLocaleString('es-ES')} · ${d.length} registros</div>
        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${dataRows}</tbody>
        </table>
        <script>
          // Auto-print when loaded
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `

    // Open in new window and print
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (printWindow) {
      printWindow.document.write(htmlContent)
      printWindow.document.close()
    } else {
      alert('Permite las ventanas emergentes para imprimir')
    }
  })

  const menuItems = [
    { id: 'excel', label: 'Excel', ext: '.xlsx', icon: FileSpreadsheet, color: '#10b981', onClick: handleExcel },
    { id: 'csv', label: 'CSV', ext: '.csv', icon: FileText, color: '#3b82f6', onClick: handleCSV },
    { id: 'json', label: 'JSON', ext: '.json', icon: FileJson, color: '#f59e0b', onClick: handleJSON },
    { id: 'pdf', label: 'PDF', ext: 'print', icon: Printer, color: '#8b5cf6', onClick: handlePDF },
  ].filter(item => !(hideCSV && item.id === 'csv'))

  return (
    <>
      <button
        ref={triggerRef}
        disabled={disabled || loading}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          color: '#e2e8f0',
          fontSize: 12,
          fontWeight: 500,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.5 : 1,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.borderColor = '#475569'
            e.currentTarget.style.background = '#334155'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#334155'
          e.currentTarget.style.background = '#1e293b'
        }}
      >
        {loading ? (
          <div style={{
            width: 14,
            height: 14,
            border: '2px solid rgba(255,255,255,0.2)',
            borderTopColor: 'white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        ) : (
          <Download size={14} />
        )}
        <span>{buttonLabel}</span>
        <ChevronDown size={12} style={{ 
          opacity: 0.6,
          transition: 'transform 0.15s',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
        }} />
      </button>

      {isOpen && createPortal(
        <div
          id="export-menu-dropdown"
          style={{
            position: 'absolute',
            top: coords.top,
            right: document.documentElement.clientWidth - coords.left,
            minWidth: 160,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
            zIndex: 99999,
            overflow: 'hidden',
            animation: 'fadeIn 0.12s ease-out'
          }}
        >
          <div style={{ padding: '4px' }}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: '#e2e8f0',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.1s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 5,
                  background: `${item.color}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <item.icon size={13} color={item.color} />
                </div>
                <span>{item.label}</span>
                <span style={{ 
                  marginLeft: 'auto', 
                  fontSize: 10, 
                  color: '#64748b',
                  fontWeight: 400
                }}>
                  {item.ext}
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
