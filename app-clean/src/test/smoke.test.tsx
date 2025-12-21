/**
 * Smoke Tests - Basic render tests for critical components
 * 
 * Purpose: Prevent "white screen" regressions by ensuring
 * core components render without crashing.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { SettingsProvider } from '../context/SettingsContext'
import { I18nProvider } from '../i18n/I18nContext'
import { ToastProvider } from '../components/Toast'

// ==============================================
// TEST UTILITIES
// ==============================================

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <I18nProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </I18nProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

// ==============================================
// SMOKE TESTS - UI COMPONENTS
// ==============================================

describe('UI Components - Smoke Tests', () => {
  describe('UiModal', () => {
    it('renders when open', async () => {
      const { UiModal, UiModalBody } = await import('../components/ui/UiModal')
      
      render(
        <TestWrapper>
          <UiModal isOpen={true} onClose={() => {}}>
            <UiModalBody>
              <p>Test Modal Content</p>
            </UiModalBody>
          </UiModal>
        </TestWrapper>
      )
      
      expect(screen.getByText('Test Modal Content')).toBeInTheDocument()
    })

    it('does not render when closed', async () => {
      const { UiModal, UiModalBody } = await import('../components/ui/UiModal')
      
      render(
        <TestWrapper>
          <UiModal isOpen={false} onClose={() => {}}>
            <UiModalBody>
              <p>Hidden Content</p>
            </UiModalBody>
          </UiModal>
        </TestWrapper>
      )
      
      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument()
    })
  })

  describe('UiSelect', () => {
    it('renders with options', async () => {
      const { UiSelect } = await import('../components/ui/UiSelect')
      
      const options = [
        { value: '1', label: 'Option 1' },
        { value: '2', label: 'Option 2' },
      ]
      
      render(
        <TestWrapper>
          <UiSelect 
            value="1" 
            onChange={() => {}} 
            options={options}
            placeholder="Select..."
          />
        </TestWrapper>
      )
      
      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })
  })

  describe('UiDatePicker', () => {
    it('renders with placeholder', async () => {
      const { UiDatePicker } = await import('../components/ui/UiDatePicker')
      
      render(
        <TestWrapper>
          <UiDatePicker 
            value={null} 
            onChange={() => {}}
            placeholder="Select date..."
          />
        </TestWrapper>
      )
      
      expect(screen.getByText('Select date...')).toBeInTheDocument()
    })
  })
})

// ==============================================
// SMOKE TESTS - SKELETON COMPONENTS
// ==============================================

describe('Skeleton Components - Smoke Tests', () => {
  it('renders SkeletonDashboard', async () => {
    const { SkeletonDashboard } = await import('../components/Skeleton')
    
    render(<SkeletonDashboard />)
    
    // Should have skeleton elements
    const skeletons = document.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders SkeletonList', async () => {
    const { SkeletonList } = await import('../components/Skeleton')
    
    render(<SkeletonList rows={3} />)
    
    // Should have skeleton-row elements
    const rows = document.querySelectorAll('.skeleton-row')
    expect(rows.length).toBe(3)
  })
})

// ==============================================
// SMOKE TESTS - CONTEXT PROVIDERS
// ==============================================

describe('Context Providers - Smoke Tests', () => {
  it('SettingsProvider provides default settings', async () => {
    const { useSettings } = await import('../context/SettingsContext')
    
    function TestComponent() {
      const { settings } = useSettings()
      return <div data-testid="theme">{settings.theme}</div>
    }
    
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    )
    
    // Should have default theme
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
  })

  it('I18nProvider provides translations', async () => {
    const { useI18n } = await import('../hooks/useI18n')
    
    function TestComponent() {
      const { t } = useI18n()
      return <div data-testid="translation">{t('common.save')}</div>
    }
    
    render(
      <SettingsProvider>
        <I18nProvider>
          <TestComponent />
        </I18nProvider>
      </SettingsProvider>
    )
    
    // Should have translated text
    expect(screen.getByTestId('translation')).toHaveTextContent(/guardar|save/i)
  })
})
