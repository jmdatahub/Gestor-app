/**
 * AlertRuleWizard - Formulario progresivo para crear reglas de alerta avanzadas
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  createAlertRule,
  alertRuleTypes,
  severityOptions,
  triggerModeOptions,
  periodOptions,
  ruleNeedsCategory,
  ruleNeedsAccount,
  type AlertRuleType,
  type AlertSeverity,
  type TriggerMode,
  type AlertPeriod,
  type AlertRuleCondition,
} from '../../services/alertRuleService'
import { fetchCategories } from '../../services/movementService'
import { getActiveAccounts } from '../../services/catalogCache'
import { UiModal, UiModalBody, UiModalFooter } from '../ui/UiModal'
import { UiSelect } from '../ui/UiSelect'
import { UiNumber } from '../ui/UiNumber'
import { UiInput } from '../ui/UiInput'
import { UiField } from '../ui/UiField'
import { AlertTriangle, Bell, CheckCircle, ChevronRight } from 'lucide-react'

interface AlertRuleWizardProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type WizardStep = 'type' | 'condition' | 'options' | 'confirm'

export function AlertRuleWizard({ isOpen, onClose, onSuccess }: AlertRuleWizardProps) {
  const [step, setStep] = useState<WizardStep>('type')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form State
  const [ruleType, setRuleType] = useState<AlertRuleType>('spending_exceeds')
  const [threshold, setThreshold] = useState<number>(1000)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [severity, setSeverity] = useState<AlertSeverity>('warning')
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('repeat')
  const [period, setPeriod] = useState<AlertPeriod>('current_month')
  const [ruleName, setRuleName] = useState('')
  
  // Context Data
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  
  // Load context data
  useEffect(() => {
    if (isOpen) {
      loadContextData()
      resetForm()
    }
  }, [isOpen])
  
  // Update threshold when type changes
  useEffect(() => {
    const typeConfig = alertRuleTypes.find(t => t.value === ruleType)
    if (typeConfig) {
      setThreshold(typeConfig.defaultValue)
    }
  }, [ruleType])
  
  const loadContextData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    try {
      const [cats, accs] = await Promise.all([
        fetchCategories(user.id),
        getActiveAccounts(user.id)
      ])
      setCategories(cats.map(c => ({ id: c.id, name: c.name })))
      setAccounts(accs.map(a => ({ id: a.id, name: a.name })))
    } catch (error) {
      console.error('Error loading context:', error)
    }
  }
  
  const resetForm = () => {
    setStep('type')
    setRuleType('spending_exceeds')
    setThreshold(1000)
    setCategoryId(null)
    setAccountId(null)
    setSeverity('warning')
    setTriggerMode('repeat')
    setPeriod('current_month')
    setRuleName('')
  }
  
  const handleNext = () => {
    switch (step) {
      case 'type': setStep('condition'); break
      case 'condition': setStep('options'); break
      case 'options': setStep('confirm'); break
    }
  }
  
  const handleBack = () => {
    switch (step) {
      case 'condition': setStep('type'); break
      case 'options': setStep('condition'); break
      case 'confirm': setStep('options'); break
    }
  }
  
  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('No se pudo obtener el usuario. Inicia sesión nuevamente.')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    // Timeout de seguridad (15s)
    const timeoutId = setTimeout(() => {
      setSubmitting(false)
      setError('La operación tardó demasiado. Verifica tu conexión e inténtalo de nuevo.')
    }, 15000)
    
    try {
      const condition: AlertRuleCondition = {
        operator: 'gte',
        value: threshold,
      }
      
      if (ruleNeedsCategory(ruleType) && categoryId) {
        condition.category_id = categoryId
      }
      if (ruleNeedsAccount(ruleType) && accountId) {
        condition.account_id = accountId
      }
      
      const typeConfig = alertRuleTypes.find(t => t.value === ruleType)
      const autoName = ruleName || `${typeConfig?.label || ruleType} ${threshold}${typeConfig?.unit || ''}`
      
      console.log('[AlertWizard] Creating rule...', { name: autoName, type: ruleType, condition })
      
      await createAlertRule({
        user_id: user.id,
        name: autoName,
        type: ruleType,
        condition,
        severity,
        trigger_mode: triggerMode,
        period,
      })
      
      clearTimeout(timeoutId)
      console.log('[AlertWizard] Rule created successfully!')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      console.error('[AlertWizard] Error creating rule:', err)
      
      // Extract error message
      let errorMsg = 'Error al crear la alerta. '
      if (err instanceof Error) {
        // Check for common Supabase errors
        const msg = err.message.toLowerCase()
        if (msg.includes('permission') || msg.includes('rls')) {
          errorMsg += 'No tienes permisos. Verifica que estás conectado.'
        } else if (msg.includes('column') || msg.includes('relation')) {
          errorMsg += 'La tabla de alertas necesita actualizarse. Contacta al administrador.'
        } else if (msg.includes('network') || msg.includes('fetch')) {
          errorMsg += 'Error de conexión. Verifica tu internet.'
        } else {
          errorMsg += err.message
        }
      }
      setError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }
  
  const currentTypeConfig = alertRuleTypes.find(t => t.value === ruleType)
  
  // Generate preview text
  const getPreviewText = () => {
    const typeLabel = currentTypeConfig?.label || ''
    const unit = currentTypeConfig?.unit || ''
    const periodLabel = periodOptions.find(p => p.value === period)?.label || ''
    const sevLabel = severityOptions.find(s => s.value === severity)?.label || ''
    
    let context = ''
    if (ruleNeedsCategory(ruleType) && categoryId) {
      const cat = categories.find(c => c.id === categoryId)
      context = ` en "${cat?.name || 'categoría'}"`
    }
    if (ruleNeedsAccount(ruleType) && accountId) {
      const acc = accounts.find(a => a.id === accountId)
      context = ` en "${acc?.name || 'cuenta'}"`
    }
    
    return `Alerta ${sevLabel.toLowerCase()}: ${typeLabel} ${threshold}${unit}${context} (${periodLabel.toLowerCase()})`
  }
  
  return (
    <UiModal isOpen={isOpen} onClose={onClose} width="500px">
      <div className="p-6">
        {/* Header with Steps */}
        <div className="d-flex items-center gap-2 mb-6">
          <StepIndicator step={1} current={step === 'type'} done={step !== 'type'} label="Tipo" />
          <ChevronRight size={16} className="text-gray-300" />
          <StepIndicator step={2} current={step === 'condition'} done={['options', 'confirm'].includes(step)} label="Condición" />
          <ChevronRight size={16} className="text-gray-300" />
          <StepIndicator step={3} current={step === 'options'} done={step === 'confirm'} label="Opciones" />
          <ChevronRight size={16} className="text-gray-300" />
          <StepIndicator step={4} current={step === 'confirm'} done={false} label="Confirmar" />
        </div>
        
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}
        
        <UiModalBody>
          {/* STEP 1: Type Selection */}
          {step === 'type' && (
            <div className="d-flex flex-col gap-4">
              <h3 className="text-lg font-bold">¿Qué tipo de alerta quieres crear?</h3>
              <div className="d-flex flex-col gap-2">
                {alertRuleTypes.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setRuleType(type.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      ruleType === type.value 
                        ? 'border-primary bg-primary/5' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-semibold">{type.label}</span>
                    <span className="text-sm text-secondary ml-2">({type.unit})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* STEP 2: Condition */}
          {step === 'condition' && (
            <div className="d-flex flex-col gap-4">
              <h3 className="text-lg font-bold">Define la condición</h3>
              
              <UiField label={`Umbral (${currentTypeConfig?.unit || ''})`}>
                <UiNumber
                  value={threshold}
                  onChange={(val) => setThreshold(Number(val) || 0)}
                  min={0}
                  step={currentTypeConfig?.unit === '%' ? 1 : 50}
                />
              </UiField>
              
              {ruleNeedsCategory(ruleType) && (
                <UiField label="Categoría">
                  <UiSelect
                    value={categoryId}
                    onChange={setCategoryId}
                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                    placeholder="Seleccionar categoría..."
                  />
                </UiField>
              )}
              
              {ruleNeedsAccount(ruleType) && (
                <UiField label="Cuenta">
                  <UiSelect
                    value={accountId}
                    onChange={setAccountId}
                    options={accounts.map(a => ({ value: a.id, label: a.name }))}
                    placeholder="Seleccionar cuenta..."
                  />
                </UiField>
              )}
              
              <UiField label="Periodo de evaluación">
                <UiSelect
                  value={period}
                  onChange={(v) => setPeriod(v as AlertPeriod)}
                  options={periodOptions.map(p => ({ value: p.value, label: p.label }))}
                />
              </UiField>
            </div>
          )}
          
          {/* STEP 3: Options */}
          {step === 'options' && (
            <div className="d-flex flex-col gap-4">
              <h3 className="text-lg font-bold">Opciones de la alerta</h3>
              
              <UiField label="Nombre (opcional)">
                <UiInput
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Ej: Límite gastos mensuales"
                />
              </UiField>
              
              <UiField label="Severidad">
                <div className="d-flex gap-2">
                  {severityOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSeverity(opt.value)}
                      className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                        severity === opt.value 
                          ? 'border-current' 
                          : 'border-gray-200'
                      }`}
                      style={{ 
                        borderColor: severity === opt.value ? opt.color : undefined,
                        backgroundColor: severity === opt.value ? `${opt.color}10` : undefined
                      }}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <div className="text-sm font-medium mt-1">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </UiField>
              
              <UiField label="¿Cuándo disparar?">
                <UiSelect
                  value={triggerMode}
                  onChange={(v) => setTriggerMode(v as TriggerMode)}
                  options={triggerModeOptions.map(t => ({ 
                    value: t.value, 
                    label: t.label,
                    meta: t.description 
                  }))}
                />
              </UiField>
            </div>
          )}
          
          {/* STEP 4: Confirm */}
          {step === 'confirm' && (
            <div className="d-flex flex-col gap-4">
              <h3 className="text-lg font-bold">Confirmar regla</h3>
              
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="d-flex items-center gap-3 mb-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: severityOptions.find(s => s.value === severity)?.color + '20' }}
                  >
                    <Bell size={24} style={{ color: severityOptions.find(s => s.value === severity)?.color }} />
                  </div>
                  <div>
                    <div className="font-bold">
                      {ruleName || `${currentTypeConfig?.label} ${threshold}${currentTypeConfig?.unit}`}
                    </div>
                    <div className="text-sm text-secondary">{getPreviewText()}</div>
                  </div>
                </div>
                
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <span className="badge" style={{ 
                    backgroundColor: severityOptions.find(s => s.value === severity)?.color + '20',
                    color: severityOptions.find(s => s.value === severity)?.color
                  }}>
                    {severityOptions.find(s => s.value === severity)?.label}
                  </span>
                  <span className="badge badge-gray">
                    {periodOptions.find(p => p.value === period)?.label}
                  </span>
                  <span className="badge badge-gray">
                    {triggerModeOptions.find(t => t.value === triggerMode)?.label}
                  </span>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 d-flex items-center gap-2">
                <AlertTriangle size={18} className="text-blue-600" />
                <span className="text-sm text-blue-800">
                  Esta alerta se evaluará cada vez que accedas al Dashboard.
                </span>
              </div>
            </div>
          )}
        </UiModalBody>
        
        <UiModalFooter>
          {step !== 'type' && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleBack}
            >
              Atrás
            </button>
          )}
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
          >
            Cancelar
          </button>
          {step !== 'confirm' ? (
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleNext}
            >
              Siguiente
            </button>
          ) : (
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Creando...' : 'Crear regla'}
            </button>
          )}
        </UiModalFooter>
      </div>
    </UiModal>
  )
}

// Step indicator component
function StepIndicator({ step, current, done, label }: { step: number; current: boolean; done: boolean; label: string }) {
  return (
    <div className={`d-flex items-center gap-1 ${current ? 'text-primary' : done ? 'text-green-600' : 'text-gray-400'}`}>
      <div 
        className={`w-6 h-6 rounded-full d-flex items-center justify-center text-xs font-bold ${
          current ? 'bg-primary text-white' : done ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
        }`}
      >
        {done ? <CheckCircle size={14} /> : step}
      </div>
      <span className="text-xs font-medium hidden sm:inline">{label}</span>
    </div>
  )
}
