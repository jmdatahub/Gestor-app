import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  exportMovementsToCSV,
  exportMovementsToExcel,
  exportMovementsToJSON,
  exportAccountsToCSV,
  exportAccountsToExcel,
  exportAccountsToJSON,
  exportCategoriesToCSV,
  exportCategoriesToExcel,
  exportCategoriesToJSON,
  exportSavingsToExcel,
  exportDebtsToExcel,
  exportRecurringToCSV,
  exportRecurringToExcel,
  exportAllToExcel
} from '../../services/exportService'
import { FileText, FileCode, FileSpreadsheet, Download, Package } from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiCard } from '../../components/ui/UiCard'
import { useI18n } from '../../hooks/useI18n'

export default function ExportPage() {
  const { settings } = useSettings()
  const { t } = useI18n()
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Filters
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [movementType, setMovementType] = useState<string>('all')

  // Initialize with global setting
  const [includeRollup, setIncludeRollup] = useState(settings.rollupAccountsByParent)

  const handleExport = async (
    exportFn: (userId: string, filters?: object) => Promise<number | void>,
    name: string,
    filters?: object
  ) => {
    setLoading(name)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const count = await exportFn(user.id, filters)
      if (typeof count === 'number') {
        setMessage({ type: 'success', text: t('export.message.count').replace('{count}', String(count)) })
      } else {
        setMessage({ type: 'success', text: t('export.message.success') })
      }
    } catch (error) {
      console.error('Export error:', error)
      setMessage({ type: 'error', text: 'Error al exportar' })
    } finally {
      setLoading(null)
    }
  }

  const handleExportAll = async () => {
    setLoading('all')
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      await exportAllToExcel(user.id, { includeChildrenRollup: includeRollup })
      setMessage({ type: 'success', text: 'Exportación completa descargada' })
    } catch (error) {
      console.error('Export all error:', error)
      setMessage({ type: 'error', text: 'Error al exportar todos los datos' })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
            <h1 className="page-title">{t('export.title')}</h1>
            <p className="page-subtitle">{t('export.subtitle')}</p>
        </div>
      </div>

      {message && (
        <div 
            className={`mb-4 p-3 rounded border text-sm ${
                message.type === 'success' 
                ? 'bg-success-soft text-success border-success' 
                : 'bg-danger-soft text-danger border-danger'
            }`}
        >
          {message.text}
        </div>
      )}

      {/* Export All */}
      <UiCard className="mb-6 border-0" style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          color: 'white' 
      }}>
        <div className="d-flex justify-between items-center p-6">
            <div className="d-flex items-center gap-4">
            <Package size={40} className="text-white" />
            <div>
                <h3 className="text-lg font-bold text-white mb-1">{t('export.all.title')}</h3>
                <p className="text-sm text-white opacity-90 mb-2">
                {t('export.all.desc')}
                </p>
                <label className="d-flex items-center gap-2 cursor-pointer text-sm">
                <input 
                    type="checkbox" 
                    checked={includeRollup} 
                    onChange={(e) => setIncludeRollup(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'white' }}
                />
                <span className="text-white opacity-90">
                    Agrupar saldos por cuenta raíz (Roll-up)
                </span>
                </label>
            </div>
            </div>
            <button
            className="btn"
            onClick={handleExportAll}
            disabled={loading !== null}
            style={{ 
                minWidth: '180px', 
                background: 'white', 
                color: 'var(--primary)', 
                border: 'none',
                fontWeight: 600
            }}
            >
            {loading === 'all' ? t('common.loading') : (
                <div className="d-flex items-center gap-2">
                <Download size={20} />
                {t('export.all.button')}
                </div>
            )}
            </button>
        </div>
      </UiCard>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {/* Movements */}
        <UiCard className="p-6">
          <h3 className="text-base font-bold text-gray-700 mb-2">{t('export.section.movements')}</h3>
          
          <div className="mb-4 d-grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="form-group mb-0">
              <label className="label">{t('export.filters.from')}</label>
              <UiDatePicker
                value={startDate}
                onChange={(d) => setStartDate(d ? formatISODateString(d) : '')}
              />
            </div>
            <div className="form-group mb-0">
              <label className="label">{t('export.filters.to')}</label>
              <UiDatePicker
                value={endDate}
                onChange={(d) => setEndDate(d ? formatISODateString(d) : '')}
              />
            </div>
            <div className="form-group mb-0">
              <label className="label">{t('export.filters.type')}</label>
              <UiSelect
                value={movementType}
                onChange={setMovementType}
                options={[
                    { value: 'all', label: t('export.filters.all') },
                    { value: 'income', label: t('movements.type.income') },
                    { value: 'expense', label: t('movements.type.expense') },
                    { value: 'investment', label: t('movements.type.investment') }
                ]}
              />
            </div>
          </div>

          <div className="d-flex gap-2">
            <button
              className="btn btn-secondary flex-1"
              onClick={() => handleExport(
                (uid, f) => exportMovementsToJSON(uid, f as object),
                'movements-json',
                { startDate, endDate, type: movementType }
              )}
              disabled={loading !== null}
            >
              <FileCode size={18} />
              JSON
            </button>
            <button
              className="btn btn-secondary flex-1"
              onClick={() => handleExport(
                (uid, f) => exportMovementsToCSV(uid, f as object),
                'movements-csv',
                { startDate, endDate, type: movementType }
              )}
              disabled={loading !== null}
            >
              <FileText size={18} />
              CSV
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => handleExport(
                (uid, f) => exportMovementsToExcel(uid, f as object),
                'movements-excel',
                { startDate, endDate, type: movementType }
              )}
              disabled={loading !== null}
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
          </div>
        </UiCard>

        {/* Accounts */}
        <UiCard className="p-6">
          <h3 className="text-base font-bold text-gray-700 mb-1">{t('export.section.accounts')}</h3>
          <p className="text-sm text-secondary mb-4">{t('accounts.subtitle')}</p>
          <div className="d-flex gap-2">
            <button
              className="btn btn-secondary flex-1"
              onClick={() => handleExport(exportAccountsToCSV, 'accounts-csv')}
              disabled={loading !== null}
            >
              CSV
            </button>
            <button
              className="btn btn-secondary flex-1"
              onClick={() => handleExport(exportAccountsToJSON, 'accounts-json')}
              disabled={loading !== null}
            >
              JSON
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => handleExport(exportAccountsToExcel, 'accounts-excel')}
              disabled={loading !== null}
            >
              Excel
            </button>
          </div>
        </UiCard>

        {/* Categories */}
        <UiCard className="p-6">
          <h3 className="text-base font-bold text-gray-700 mb-1">{t('export.section.categories')}</h3>
          <p className="text-sm text-secondary mb-4">{t('categories.subtitle')}</p>
          <div className="d-flex gap-2">
            <button
              className="btn btn-secondary flex-1"
              onClick={() => handleExport(exportCategoriesToCSV, 'categories-csv')}
              disabled={loading !== null}
            >
              CSV
            </button>
            <button
              className="btn btn-secondary flex-1"
              onClick={() => handleExport(exportCategoriesToJSON, 'categories-json')}
              disabled={loading !== null}
            >
              JSON
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => handleExport(exportCategoriesToExcel, 'categories-excel')}
              disabled={loading !== null}
            >
              Excel
            </button>
          </div>
        </UiCard>

        {/* Savings */}
        <UiCard className="p-6">
          <h3 className="text-base font-bold text-gray-700 mb-1">{t('export.section.savings')}</h3>
          <p className="text-sm text-secondary mb-4">{t('savings.subtitle')}</p>
          <button
            className="btn btn-primary w-full"
            onClick={() => handleExport(exportSavingsToExcel, 'savings')}
            disabled={loading !== null}
          >
            <FileSpreadsheet size={18} />
            {t('export.all.button')}
          </button>
        </UiCard>

        {/* Debts */}
        <UiCard className="p-6">
          <h3 className="text-base font-bold text-gray-700 mb-1">{t('export.section.debts')}</h3>
          <p className="text-sm text-secondary mb-4">{t('debts.subtitle')}</p>
          <button
            className="btn btn-primary w-full"
            onClick={() => handleExport(exportDebtsToExcel, 'debts')}
            disabled={loading !== null}
          >
            <FileSpreadsheet size={18} />
            {t('export.all.button')}
          </button>
        </UiCard>

        {/* Recurring */}
        <UiCard className="p-6">
          <h3 className="text-base font-bold text-gray-700 mb-1">{t('export.section.recurring')}</h3>
          <p className="text-sm text-secondary mb-4">{t('recurring.subtitle')}</p>
          <div className="d-flex gap-2">
             <button
              className="btn btn-secondary flex-1"
              onClick={() => handleExport(exportRecurringToCSV, 'recurring-csv')}
              disabled={loading !== null}
            >
              CSV
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => handleExport(exportRecurringToExcel, 'recurring-excel')}
              disabled={loading !== null}
            >
              Excel
            </button>
          </div>
        </UiCard>
      </div>

      <p className="text-secondary text-center text-sm mt-6">
        {t('export.disclaimer')}
      </p>
    </div>
  )
}
