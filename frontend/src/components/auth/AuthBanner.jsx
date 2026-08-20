import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AlertCard from '../ui/AlertCard.jsx'
import { ALERT_DURATION_MS } from '../../constants/alerts.js'
import { toErrorText } from '../../utils/apiError.js'

const VALID_TYPES = new Set(['success', 'error'])

export default function AuthBanner({
  type,
  title,
  message,
  className = '',
  duration = ALERT_DURATION_MS,
}) {
  const text = toErrorText(message)
  const [visible, setVisible] = useState(Boolean(VALID_TYPES.has(type) && text))

  useEffect(() => {
    if (!VALID_TYPES.has(type) || !text) {
      setVisible(false)
      return undefined
    }

    setVisible(true)

    if (!duration) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setVisible(false)
    }, duration)

    return () => window.clearTimeout(timeoutId)
  }, [type, text, title, duration])

  if (!visible || !VALID_TYPES.has(type) || !text) {
    return null
  }

  const banner = (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex justify-center px-4">
      <div className={`pointer-events-auto w-full max-w-md ${className}`}>
        <AlertCard type={type} title={title} message={text} onDismiss={() => setVisible(false)} />
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return banner
  }

  return createPortal(banner, document.body)
}
