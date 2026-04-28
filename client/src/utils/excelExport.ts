
import { downloadFile } from '../services/exportService'

export interface ExcelColumn {
  header: string
  key: string
  width?: number
}

export const exportToExcel = async (
  data: any[],
  columns: ExcelColumn[],
  fileName: string,
  sheetName: string = 'Datos'
) => {
  if (!data || data.length === 0) {
    console.warn('exportToExcel: No data provided')
    alert('No hay datos para exportar')
    return
  }

  try {
      // Dynamic import to prevent bundle size issues and initial load black screen
      const ExcelJSModule = await import('exceljs')
      const ExcelJS = ExcelJSModule.default || ExcelJSModule
      
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(sheetName)

      // Set columns
      worksheet.columns = columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 20
      }))

      // Style Header Row
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' } // Indigo 600
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.height = 30

      // Add Data
      worksheet.addRows(data)

      // Auto-filter
      worksheet.autoFilter = {
        from: {
          row: 1,
          column: 1
        },
        to: {
          row: 1,
          column: columns.length
        }
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      // Create generic blob
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      // Save file using custom service
      downloadFile(blob, `${fileName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  } catch (error) {
      console.error("Error loading ExcelJS or generating file:", error)
      alert("Error al generar el archivo Excel. Revisa la consola.")
  }
}
