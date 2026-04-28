/**
 * DB Diagnostics Panel
 * 
 * Muestra el schema real de la DB vs lo esperado por el código.
 * Añadir a Settings o como herramienta de debug.
 */

import { useState } from 'react'
import { 
  getTableColumns, 
  EXPECTED_SCHEMA, 
  type TableSchema 
} from '../../services/schemaService'
import { getEvents, getStats, clearEvents, copyReportToClipboard } from '../../services/telemetryService'
import { Database, RefreshCw, Check, X, Copy, Trash2, AlertTriangle } from 'lucide-react'
import { UiCard, UiCardBody } from '../ui/UiCard'

export function DBDiagnosticsPanel() {
  const [schemas, setSchemas] = useState<TableSchema[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const stats = getStats()
  const events = getEvents().slice(0, 10) // Last 10 events

  const runInspector = async () => {
    setLoading(true)
    setError(null)
    setSchemas([])

    try {
      const tables = Object.keys(EXPECTED_SCHEMA)
      const results: TableSchema[] = []

      for (const table of tables) {
        const schema = await getTableColumns(table)
        results.push(schema)
      }

      setSchemas(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyReport = async () => {
    const success = await copyReportToClipboard()
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClearEvents = () => {
    clearEvents()
    // Force re-render
    setSchemas([...schemas])
  }

  const checkColumn = (tableName: string, columnName: string): boolean => {
    const expected = EXPECTED_SCHEMA[tableName] || []
    return expected.includes(columnName)
  }

  const getMissingColumns = (tableName: string, actualColumns: string[]): string[] => {
    const expected = EXPECTED_SCHEMA[tableName] || []
    return expected.filter(col => !actualColumns.includes(col))
  }

  return (
    <div className="db-diagnostics">
      {/* Telemetry Section */}
      <UiCard className="mb-4">
        <UiCardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" />
              Telemetría de Operaciones
            </h3>
            <div className="flex gap-2">
              <button 
                className="btn btn-sm btn-ghost"
                onClick={handleCopyReport}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar informe'}
              </button>
              <button 
                className="btn btn-sm btn-ghost text-danger"
                onClick={handleClearEvents}
              >
                <Trash2 size={14} />
                Limpiar
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-2xl font-bold">{stats.totalEvents}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="text-2xl font-bold text-success">{stats.successCount}</div>
              <div className="text-xs text-gray-500">Éxitos</div>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
              <div className="text-2xl font-bold text-danger">{stats.errorCount}</div>
              <div className="text-xs text-gray-500">Errores</div>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-2xl font-bold">{stats.avgDurationMs}ms</div>
              <div className="text-xs text-gray-500">Promedio</div>
            </div>
          </div>

          {/* Recent events */}
          {events.length > 0 && (
            <div className="text-sm">
              <strong className="text-xs text-gray-500 uppercase mb-2 block">Últimos eventos</strong>
              <div className="max-h-40 overflow-auto">
                {events.map((e, i) => (
                  <div 
                    key={i} 
                    className={`py-1 px-2 mb-1 rounded text-xs flex justify-between items-center ${
                      e.ok ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {e.ok ? <Check size={12} className="text-success" /> : <X size={12} className="text-danger" />}
                      <span className="font-medium">{e.actionName}</span>
                      <span className="text-gray-400">{e.code}</span>
                    </span>
                    <span className="text-gray-400">{e.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </UiCardBody>
      </UiCard>

      {/* Schema Inspector */}
      <UiCard>
        <UiCardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Database size={18} />
              Inspector de Schema
            </h3>
            <button 
              className="btn btn-sm btn-primary"
              onClick={runInspector}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Inspeccionando...' : 'Inspeccionar DB'}
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg text-sm">
              <strong>Error:</strong> {error}
              <p className="mt-1 text-xs">
                Es posible que necesites ejecutar <code>db_inspector_rpc.sql</code> en Supabase primero.
              </p>
            </div>
          )}

          {schemas.length === 0 && !loading && !error && (
            <p className="text-gray-500 text-sm">
              Haz clic en "Inspeccionar DB" para ver las columnas reales de cada tabla.
            </p>
          )}

          {schemas.map(table => {
            const actualCols = table.columns.map(c => c.column_name)
            const missing = getMissingColumns(table.tableName, actualCols)
            
            return (
              <div key={table.tableName} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <strong className="text-sm">{table.tableName}</strong>
                  {table.error ? (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Error</span>
                  ) : missing.length > 0 ? (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                      Faltan {missing.length} columnas
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">OK</span>
                  )}
                </div>
                
                {table.error ? (
                  <p className="text-xs text-red-600">{table.error}</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {table.columns.map(col => (
                      <span 
                        key={col.column_name}
                        className={`text-xs px-2 py-0.5 rounded ${
                          checkColumn(table.tableName, col.column_name)
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/20'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700'
                        }`}
                        title={`${col.data_type} - ${col.is_nullable === 'YES' ? 'nullable' : 'required'}`}
                      >
                        {col.column_name}
                      </span>
                    ))}
                    {missing.map(col => (
                      <span 
                        key={col}
                        className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/20 line-through"
                        title="Columna esperada pero no existe"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </UiCardBody>
      </UiCard>
    </div>
  )
}
