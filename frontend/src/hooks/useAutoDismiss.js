import { useEffect } from 'react'
import { ALERT_DURATION_MS } from '../constants/alerts.js'

export default function useAutoDismiss(value, clearValue, duration = ALERT_DURATION_MS) {
  useEffect(() => {
    if (!value) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      clearValue()
    }, duration)

    return () => window.clearTimeout(timeoutId)
  }, [value, clearValue, duration])
}
