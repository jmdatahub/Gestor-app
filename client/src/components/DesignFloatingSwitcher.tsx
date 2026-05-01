import { useState } from 'react'
import { useSettings, DESIGN_OPTIONS, type Design } from '../context/SettingsContext'
import { Palette, X, Check } from 'lucide-react'

/**
 * Floating button bottom-right that opens a tiny popover with the 5 designs.
 * Visible everywhere — including the auth screen, before login. Useful for
 * previewing designs without going through the full Settings panel.
 */
export function DesignFloatingSwitcher() {
  const { settings, updateSettings } = useSettings()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="design-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Cambiar estilo visual"
        title="Cambiar estilo visual"
      >
        {open ? <X size={18} /> : <Palette size={18} />}
      </button>

      {open && (
        <div
          className="design-fab-popover"
          role="dialog"
          aria-label="Selector de estilo visual"
        >
          <div className="design-fab-popover__header">
            <span>Estilo visual</span>
            <button
              type="button"
              className="design-fab-popover__close"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
          <div className="design-fab-popover__list">
            {DESIGN_OPTIONS.map((opt) => {
              const active = settings.design === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`design-fab-option${active ? ' design-fab-option--active' : ''}`}
                  onClick={() => updateSettings({ design: opt.value as Design })}
                  aria-pressed={active}
                  title={opt.description}
                >
                  <span
                    className="design-fab-swatch"
                    style={{
                      background: opt.previewColors.bg,
                      borderColor: opt.previewColors.accent,
                    }}
                  >
                    <span
                      className="design-fab-swatch-dot"
                      style={{ background: opt.previewColors.accent }}
                    />
                  </span>
                  <span className="design-fab-option__label">{opt.label}</span>
                  {active && <Check size={14} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
