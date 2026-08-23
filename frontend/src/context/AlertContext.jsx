/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AlertCard from '../components/ui/AlertCard.jsx'
import { ALERT_DURATION_MS } from '../constants/alerts.js'
import { toErrorText } from '../utils/apiError.js'

const AlertContext = createContext(null)

function AlertToaster({ alerts, onDismiss }) {
  if (typeof document === 'undefined' || alerts.length === 0) {
    return null
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex justify-center px-4">
      <div className="flex w-full max-w-md flex-col gap-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="pointer-events-auto">
            <AlertCard
              type={alert.type}
              title={alert.title}
              message={alert.message}
              onDismiss={() => onDismiss(alert.id)}
            />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}

export function AlertProvider({ children, duration = ALERT_DURATION_MS }) {
  const [alerts, setAlerts] = useState([])
  const timeoutsRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timeoutId = timeoutsRef.current.get(id)
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      timeoutsRef.current.delete(id)
    }
    setAlerts((current) => current.filter((alert) => alert.id !== id))
  }, [])

  const showAlert = useCallback(
    (type, message, title) => {
      const text = toErrorText(message)
      if (!text) {
        return
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setAlerts((current) => [...current.slice(-2), { id, type, title, message: text }])
      const timeoutId = window.setTimeout(() => dismiss(id), duration)
      timeoutsRef.current.set(id, timeoutId)
    },
    [dismiss, duration],
  )

  useEffect(() => {
    const timeouts = timeoutsRef.current
    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeouts.clear()
    }
  }, [])

  const value = useMemo(() => ({ showAlert, dismiss }), [showAlert, dismiss])

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertToaster alerts={alerts} onDismiss={dismiss} />
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)

  if (!context) {
    return {
      showAlert: () => {},
      dismiss: () => {},
    }
  }

  return context
}
