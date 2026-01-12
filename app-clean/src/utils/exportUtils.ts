/**
 * Export data to CSV file - standalone implementation without external dependencies
 */
export const exportToCSV = (
  data: any[], 
  filename: string, 
  headers?: { key: string; label: string }[]
): void => {
  console.log('[CSV Export] Starting with', data?.length || 0, 'rows')
  
  if (!data || data.length === 0) {
    console.warn('[CSV Export] No data to export')
    alert('No hay datos para exportar')
    return
  }

  try {
    // Get keys from headers or from first data object
    const keys = headers 
      ? headers.map(h => h.key) 
      : Object.keys(data[0])
    
    const labels = headers 
      ? headers.map(h => h.label) 
      : keys

    console.log('[CSV Export] Keys:', keys)
    console.log('[CSV Export] Labels:', labels)

    // Build CSV content manually
    let csvContent = ''
    
    // Add BOM for UTF-8 (Excel compatibility)
    csvContent += '\uFEFF'
    
    // Header line
    csvContent += labels.join(';') + '\r\n'
    
    // Data lines
    for (const row of data) {
      const values = keys.map(key => {
        const val = row[key]
        
        // Handle null/undefined
        if (val === null || val === undefined) {
          return ''
        }
        
        // Convert to string
        let str = String(val)
        
        // Escape quotes and wrap in quotes if contains special chars
        if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          str = '"' + str.replace(/"/g, '""') + '"'
        }
        
        return str
      })
      
      csvContent += values.join(';') + '\r\n'
    }

    console.log('[CSV Export] Content length:', csvContent.length)
    console.log('[CSV Export] First 300 chars:', csvContent.substring(0, 300))

    // Direct download - NO external dependencies
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.csv`
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    
    // Cleanup after a short delay
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 150)

    console.log('[CSV Export] Download triggered successfully')

  } catch (error) {
    console.error('[CSV Export] Error:', error)
    alert('Error al exportar CSV: ' + (error as Error).message)
  }
}
