import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  getUserInvestments,
  createInvestment,
  updatePrice,
  deleteInvestment,
  calculateTotals,
  investmentTypes,
  type Investment,
  type CreateInvestmentInput
} from '../../services/investmentService'
import { Plus, TrendingUp, TrendingDown, RefreshCw, Trash2, Eye, X } from 'lucide-react'
import ExcelJS from 'exceljs'
import { useI18n } from '../../hooks/useI18n'
import { useSettings } from '../../context/SettingsContext'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiCard, UiCardBody } from '../../components/ui/UiCard'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'

export default function InvestmentsList() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { settings } = useSettings()
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null)

  // Create form
  const [name, setName] = useState('')
  const [type, setType] = useState('manual')
  const [quantity, setQuantity] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Update price form
  const [newPrice, setNewPrice] = useState('')
  const [priceDate, setPriceDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await getUserInvestments(user.id)
      setInvestments(data)
    } catch (error) {
      console.error('Error loading investments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const input: CreateInvestmentInput = {
        user_id: user.id,
        name,
        type,
        quantity: parseFloat(quantity),
        buy_price: parseFloat(buyPrice),
        current_price: parseFloat(currentPrice),
        notes: notes || null
      }
      await createInvestment(input)
      setShowCreateModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error creating investment:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInvestment) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await updatePrice(selectedInvestment.id, user.id, parseFloat(newPrice), priceDate)
      setShowPriceModal(false)
      setSelectedInvestment(null)
      setNewPrice('')
      loadData()
    } catch (error) {
      console.error('Error updating price:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (inv: Investment) => {
    if (!confirm(t('investments.deleteConfirm', { name: inv.name }) || `¿Eliminar la inversión "${inv.name}"?`)) return

    try {
      await deleteInvestment(inv.id)
      loadData()
    } catch (error) {
      console.error('Error deleting investment:', error)
    }
  }

  const openPriceModal = (inv: Investment) => {
    setSelectedInvestment(inv)
    setNewPrice(inv.current_price.toString())
    setPriceDate(new Date().toISOString().split('T')[0])
    setShowPriceModal(true)
  }

  const resetForm = () => {
    setName('')
    setType('manual')
    setQuantity('')
    setBuyPrice('')
    setCurrentPrice('')
    setNotes('')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const getTypeName = (typeVal: string) => {
    const typeObj = investmentTypes.find(t => t.value === typeVal)
    return typeObj ? typeObj.label : typeVal
  }

  const totals = calculateTotals(investments)

  if (loading) {
    return (
       <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
         <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('investments.title')}</h1>
          <p className="page-subtitle">{t('investments.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={20} />
          {t('investments.new')}
        </button>
      </div>

      {/* Summary */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="kpi-content">
            <div className="kpi-label">{t('investments.totalValue')}</div>
            <div className="kpi-value">{formatCurrency(totals.totalValue)}</div>
          </div>
        </div>
        <div className="kpi-card" style={{ 
            borderLeft: `4px solid ${totals.totalProfitLoss >= 0 ? 'var(--success)' : 'var(--danger)'}` 
        }}>
          <div className="kpi-content">
            <div className="kpi-label">{t('investments.profitLoss')}</div>
            <div className="kpi-value" style={{ 
                color: totals.totalProfitLoss >= 0 ? 'var(--success)' : 'var(--danger)' 
            }}>
                {totals.totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(totals.totalProfitLoss)}
            </div>
             <div className="kpi-change" style={{ 
                color: totals.totalProfitLoss >= 0 ? 'var(--success)' : 'var(--danger)' 
            }}>
               ({totals.profitLossPercent >= 0 ? '+' : ''}{totals.profitLossPercent.toFixed(2)}%)
            </div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--gray-400)' }}>
            <div className="kpi-content">
                <div className="kpi-label">{t('investments.activeAssets')}</div>
                <div className="kpi-value">{totals.count}</div>
            </div>
        </div>
      </div>

      {/* List */}
      {investments.length === 0 ? (
        <UiCard className="p-12 d-flex flex-col items-center justify-center text-center">
             <TrendingUp size={48} className="text-secondary mb-4" />
          <p className="text-secondary">{t('investments.empty')}</p>
          <button className="btn btn-primary mt-4" onClick={() => setShowCreateModal(true)}>
            {t('investments.addFirst')}
          </button>
        </UiCard>
      ) : (
        <UiCard>
            <UiCardBody noPadding style={{ overflow: 'hidden' }}>
            <div className="table-container">
            <table className="table w-full">
                <thead>
                <tr>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('investments.name')}</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('investments.type')}</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{t('investments.quantity')}</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{t('investments.currentPrice')}</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{t('investments.totalValueTable')}</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{t('investments.benefit')}</th>
                    <th style={{ padding: '0.75rem 1.5rem' }}></th>
                </tr>
                </thead>
                <tbody>
                {investments.map((inv) => {
                    const totalValue = inv.quantity * inv.current_price
                    const profitLoss = (inv.current_price - inv.buy_price) * inv.quantity
                    const profitPct = inv.buy_price > 0 ? ((inv.current_price - inv.buy_price) / inv.buy_price) * 100 : 0

                    return (
                    <tr key={inv.id}>
                        <td style={{ padding: '0.75rem 1.5rem' }}>
                            <div style={{ fontWeight: 600 }}>{inv.name}</div>
                            {inv.notes && <div className="text-xs text-muted mt-1">{inv.notes}</div>}
                        </td>
                        <td style={{ padding: '0.75rem 1.5rem' }}>
                             <span className="badge badge-gray">{getTypeName(inv.type)}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{inv.quantity}</td>
                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{formatCurrency(inv.current_price)}</td>
                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalValue)}</td>
                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>
                            <div className="d-flex items-center justify-end gap-1" style={{ 
                                color: profitLoss >= 0 ? 'var(--success)' : 'var(--danger)'
                            }}>
                                {profitLoss >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                <span style={{ fontWeight: 600 }}>
                                {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
                                </span>
                                <span className="text-sm">({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%)</span>
                            </div>
                        </td>
                        <td style={{ padding: '0.75rem 1.5rem' }}>
                            <div className="d-flex gap-1 justify-end">
                                <button
                                className="btn btn-icon btn-secondary"
                                onClick={() => openPriceModal(inv)}
                                title={t('investments.updatePrice')}
                                >
                                <RefreshCw size={16} />
                                </button>
                                <button
                                className="btn btn-icon btn-secondary"
                                onClick={() => navigate(`/app/investments/${inv.id}`)}
                                title={t('common.viewDetails')}
                                >
                                <Eye size={16} />
                                </button>
                                <button
                                className="btn btn-icon btn-danger"
                                onClick={() => handleDelete(inv)}
                                title={t('common.delete')}
                                >
                                <Trash2 size={16} />
                                </button>
                            </div>
                        </td>
                    </tr>
                    )
                })}
                </tbody>
            </table>
            </div>
            </UiCardBody>
        </UiCard>
      )}

      {/* Create Modal */}
      <UiModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        title={t('investments.modal.newTitle')}
        width="600px"
      >
        <form onSubmit={handleCreate}>
          <UiModalBody>
            <div className="form-group">
              <UiInput
                label={t('investments.modal.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Bitcoin, ETF S&P500, Cromo Messi..."
                required
              />
            </div>
            <div className="form-group">
              <UiField label={t('investments.modal.type')}>
                <UiSelect 
                    value={type} 
                    onChange={setType}
                    options={investmentTypes.map(t => ({ value: t.value, label: t.label }))}
                />
              </UiField>
            </div>
            <div className="d-flex gap-2 mb-4">
              <div className="flex-1">
                <UiNumber
                    label={t('investments.modal.quantity')}
                    value={quantity}
                    onChange={(val: string) => setQuantity(val)}
                    step="any"
                    min={0}
                    required
                />
              </div>
              <div className="flex-1">
                <UiNumber
                    label={t('investments.modal.buyPrice')}
                    value={buyPrice}
                    onChange={(val: string) => setBuyPrice(val)}
                    step="0.01"
                    min={0}
                    required
                />
              </div>
              <div className="flex-1">
                <UiNumber
                    label={t('investments.modal.currentPrice')}
                    value={currentPrice}
                    onChange={(val: string) => setCurrentPrice(val)}
                    step="0.01"
                    min={0}
                    required
                />
              </div>
            </div>
            <div className="form-group">
              <UiInput
                label={t('investments.modal.notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
             <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('investments.modal.creating') : t('investments.modal.create')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>

      {/* Update Price Modal */}
      <UiModal 
        isOpen={showPriceModal && !!selectedInvestment} 
        onClose={() => setShowPriceModal(false)}
        title={selectedInvestment ? t('investments.modal.updateTitle', { name: selectedInvestment.name }) : ''}
        width="400px"
      >
        <form onSubmit={handleUpdatePrice}>
          <UiModalBody>
            <div className="form-group">
              <UiNumber
                label={t('investments.modal.newPrice')}
                value={newPrice}
                onChange={(val: string) => setNewPrice(val)}
                step="0.01"
                min={0}
                required
              />
            </div>
            <div className="form-group">
              <UiField label={t('common.date')}>
                <UiDatePicker
                  value={priceDate}
                  onChange={(d) => setPriceDate(d ? formatISODateString(d) : '')}
                  required
                />
              </UiField>
            </div>
          </UiModalBody>
          <UiModalFooter>
             <button type="button" className="btn btn-secondary" onClick={() => setShowPriceModal(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('investments.modal.updating') : t('investments.modal.update')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
