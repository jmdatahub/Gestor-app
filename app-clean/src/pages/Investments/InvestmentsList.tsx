import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useWorkspace } from '../../context/WorkspaceContext'
import {
  getUserInvestments,
  createInvestment,
  updateInvestment,
  updatePrice,
  deleteInvestment,
  calculateTotals,
  investmentTypes,
  fetchExternalPrice,
  type Investment,
  type CreateInvestmentInput
} from '../../services/investmentService'
import { getAccountsWithBalances, type AccountWithBalance } from '../../services/accountService'
import { Plus, TrendingUp, TrendingDown, RefreshCw, Trash2, Eye, X, Pencil } from 'lucide-react'
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
  const { currentWorkspace } = useWorkspace()  // Add workspace context
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([])

  // Create form
  const [name, setName] = useState('')
  const [type, setType] = useState('manual')
  const [quantity, setQuantity] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [accountId, setAccountId] = useState('') // Holding Account
  const [fundFromId, setFundFromId] = useState('') // Funding Account
  const [submitting, setSubmitting] = useState(false)
  const [updatingPrices, setUpdatingPrices] = useState(false)

  // Update price form
  const [newPrice, setNewPrice] = useState('')
  const [priceDate, setPriceDate] = useState(new Date().toISOString().split('T')[0])

  // Reload when workspace changes
  useEffect(() => {
    loadData()
  }, [currentWorkspace])
  
  // Auto-update crypto prices every 2 minutes
  useEffect(() => {
    // Only run if we have crypto investments
    const hasCrypto = investments.some(inv => inv.type === 'crypto')
    if (!hasCrypto || loading) return
    
    // Initial update on page load (after a small delay to not hit API immediately)
    const initialTimeout = setTimeout(() => {
      handleAutoUpdatePricesQuiet()
    }, 3000)
    
    // Then update every 2 minutes
    const interval = setInterval(() => {
      handleAutoUpdatePricesQuiet()
    }, 2 * 60 * 1000) // 2 minutes
    
    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [investments.length, loading])
  
  // Quiet version (no alerts) for auto-updates
  const handleAutoUpdatePricesQuiet = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || updatingPrices) return
    
    setUpdatingPrices(true)
    
    try {
      const cryptoInvestments = investments.filter(inv => inv.type === 'crypto')
      
      for (const inv of cryptoInvestments) {
        const newPriceValue = await fetchExternalPrice(inv)
        if (newPriceValue !== null && Math.abs(newPriceValue - inv.current_price) > 0.01) {
          await updatePrice(inv.id, user.id, newPriceValue, new Date().toISOString().split('T')[0])
        }
      }
      
      await loadData()
    } catch (error) {
      console.error('Error auto-updating prices:', error)
    } finally {
      setUpdatingPrices(false)
    }
  }

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const orgId = currentWorkspace?.id || null
      const [data, accountsData] = await Promise.all([
        getUserInvestments(user.id, orgId),
        getAccountsWithBalances(user.id, orgId)
      ])
      setInvestments(data)
      setAccounts(accountsData)
    } catch (error) {
      console.error('Error loading investments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const input: CreateInvestmentInput = {
        user_id: user.id,
        organization_id: currentWorkspace?.id || null,  // Include workspace
        name,
        type,
        quantity: parseFloat(quantity),
        buy_price: parseFloat(buyPrice),
        current_price: parseFloat(currentPrice),
        notes: notes || null,
        account_id: accountId || null,
        fund_from_account_id: !editingId ? (fundFromId || null) : undefined
      }

      if (editingId) {
        await updateInvestment(editingId, input)
      } else {
        await createInvestment(input)
      }

      setShowCreateModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving investment:', error)
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
    setEditingId(null)
    setName('')
    setType('manual')
    setQuantity('')
    setBuyPrice('')
    setCurrentPrice('')
    setNotes('')
    setAccountId('')
    setFundFromId('')
  }
  
  const openEditModal = (inv: Investment) => {
    setEditingId(inv.id)
    setName(inv.name)
    setType(inv.type)
    setQuantity(inv.quantity.toString())
    setBuyPrice(inv.buy_price.toString())
    setCurrentPrice(inv.current_price.toString())
    setNotes(inv.notes || '')
    setAccountId(inv.account_id || '')
    setShowCreateModal(true)
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
  
  // Auto-update crypto prices using CoinGecko API
  const handleAutoUpdatePrices = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    setUpdatingPrices(true)
    let updatedCount = 0
    
    try {
      // Filter crypto investments only
      const cryptoInvestments = investments.filter(inv => inv.type === 'crypto')
      
      for (const inv of cryptoInvestments) {
        const newPriceValue = await fetchExternalPrice(inv)
        if (newPriceValue !== null && newPriceValue !== inv.current_price) {
          await updatePrice(inv.id, user.id, newPriceValue, new Date().toISOString().split('T')[0])
          updatedCount++
        }
      }
      
      // Reload data to show updated prices
      await loadData()
      
      if (updatedCount > 0) {
        alert(`✅ ${updatedCount} precio(s) actualizado(s)`)
      } else {
        alert('Los precios ya están actualizados')
      }
    } catch (error) {
      console.error('Error updating prices:', error)
      alert('Error al actualizar precios')
    } finally {
      setUpdatingPrices(false)
    }
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
        <div className="flex gap-2">
          {investments.some(inv => inv.type === 'crypto') && (
            <button 
              className="btn btn-secondary" 
              onClick={handleAutoUpdatePrices}
              disabled={updatingPrices}
            >
              <RefreshCw size={18} className={updatingPrices ? 'animate-spin' : ''} />
              {updatingPrices ? 'Actualizando...' : 'Actualizar precios'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={20} />
            {t('investments.new')}
          </button>
        </div>
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
                    <th className="sticky-actions-col" style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontSize: '0.75rem' }}>Acciones</th>
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
                        <td className="sticky-actions-col" style={{ padding: '0.75rem 0.5rem' }}>
                            <div className="d-flex gap-1 justify-end">
                                <button
                                className="btn btn-icon btn-secondary"
                                onClick={() => openEditModal(inv)}
                                title={t('common.edit')}
                                >
                                <Pencil size={16} />
                                </button>
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

      {/* Create/Edit Modal */}
      <UiModal 
        isOpen={showCreateModal} 
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        width="600px"
      >
        <UiModalHeader>
          <div className="d-flex items-center justify-between">
            <h3 className="text-xl font-bold">
              {editingId ? t('investments.modal.editTitle') : t('investments.modal.newTitle')}
            </h3>
            <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded-full">
              <X size={20} />
            </button>
          </div>
        </UiModalHeader>
        <form onSubmit={handleSave}>
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <UiSelect
                value={accountId}
                onChange={setAccountId}
                label={t('investments.modal.holdingAccount') || "Cuenta Custodia (Invest/Broker) - Opcional"}
                options={[
                  { value: '', label: 'Sin asignar' },
                  ...accounts.map(a => ({ value: a.id, label: a.name }))
                ]}
              />
            </div>

            {!editingId && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                  <UiSelect
                      value={fundFromId}
                      onChange={setFundFromId}
                      label={t('investments.modal.fundingAccount') || "Pagar con fondos de... (Opcional)"}
                      options={[
                          { value: '', label: 'Ninguna (Solo registrar)' },
                          ...accounts.map(a => ({ value: a.id, label: `${a.name} (${formatCurrency(a.balance)})` }))
                      ]}
                  />
                  {fundFromId && (
                    <p className="text-xs text-gray-500 mt-1">
                        Se creará un gasto por el valor de compra ({formatCurrency(parseFloat(quantity || '0') * parseFloat(buyPrice || '0'))}).
                    </p>
                  )}
              </div>
            )}

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
             <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting 
                ? (editingId ? t('common.saving') : t('investments.modal.creating')) 
                : (editingId ? t('common.save') : t('investments.modal.create'))
              }
            </button>
          </UiModalFooter>
        </form>
      </UiModal>

      {/* Update Price Modal */}
      <UiModal 
        isOpen={showPriceModal && !!selectedInvestment} 
        onClose={() => setShowPriceModal(false)}
        width="400px"
      >
        <UiModalHeader>
          <div className="d-flex items-center justify-between">
            <h3 className="text-xl font-bold">
              {selectedInvestment && t('investments.modal.updateTitle', { name: selectedInvestment.name })}
            </h3>
            <button onClick={() => setShowPriceModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
              <X size={20} />
            </button>
          </div>
        </UiModalHeader>
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
