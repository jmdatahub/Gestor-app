/**
 * usePwaUpdate — service worker update detection hook.
 *
 * Detects when a new service worker is waiting and exposes an `applyUpdate`
 * function that sends SKIP_WAITING then reloads the page so users get the
 * latest version without stale cached assets.
 *
 * Works with vite-plugin-pwa's `registerType: 'prompt'` mode (vite.config.ts).
 */
import { useEffect, useState, useCallback } from 'react'

interface PwaUpdateState {
  /** True when a new service worker has installed and is waiting to activate. */
  updateAvailable: boolean
  /** Call this to skip waiting and reload with the new version. */
  applyUpdate: () => void
}

export function usePwaUpdate(): PwaUpdateState {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // vite-plugin-pwa registers the SW and exposes the registration on the
    // window object. We listen for both the initial registration and any
    // subsequent `updatefound` events.
    const handleRegistration = (reg: ServiceWorkerRegistration) => {
      setRegistration(reg)

      // If a waiting SW already exists when we load (e.g. the user had the
      // tab open during deployment), surface the prompt immediately.
      if (reg.waiting) {
        setUpdateAvailable(true)
        return
      }

      // Otherwise watch for a newly installing SW that transitions to waiting.
      const checkInstalling = (installing: ServiceWorker | null) => {
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && reg.active) {
            // A new SW installed alongside an active one → prompt the user.
            setRegistration(reg)
            setUpdateAvailable(true)
          }
        })
      }

      checkInstalling(reg.installing)

      reg.addEventListener('updatefound', () => {
        checkInstalling(reg.installing)
      })
    }

    // Grab the existing registration (if SW was registered before React mounted)
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) handleRegistration(reg)
    }).catch(() => { /* SW not registered yet */ })

    // Also listen for the custom event that vite-plugin-pwa emits after
    // it registers the SW (fired once per page load).
    const onNeedRefresh = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) handleRegistration(reg)
      }).catch(() => { /* ignore */ })
    }
    document.addEventListener('vite-plugin-pwa:needRefresh', onNeedRefresh)

    // Listen for the controller-change event so a reload in another tab
    // causes this tab to reload too (avoids stale JS/CSS in other tabs).
    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      document.removeEventListener('vite-plugin-pwa:needRefresh', onNeedRefresh)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return
    // Tell the waiting SW to skip its waiting phase and become active.
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    // The controllerchange listener above will trigger the actual reload.
  }, [registration])

  return { updateAvailable, applyUpdate }
}
