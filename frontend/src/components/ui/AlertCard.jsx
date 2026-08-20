import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

const alertStyles = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    text: 'text-emerald-700',
    Icon: CheckCircle2,
  },
  error: {
    wrapper: 'border-red-300 bg-red-50 text-red-800',
    icon: 'text-red-600',
    title: 'text-red-900',
    text: 'text-red-700',
    Icon: AlertTriangle,
  },
}

export default function AlertCard({
  type = 'error',
  title,
  message,
  onDismiss,
  className = '',
}) {
  const styles = alertStyles[type]
  if (!styles || !message) {
    return null
  }

  const Icon = styles.Icon

  return (
    <div
      role="alert"
      className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${styles.wrapper} ${className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} />
        <div className="min-w-0 flex-1">
          {title ? <p className={`font-semibold ${styles.title}`}>{title}</p> : null}
          <p className={`leading-relaxed ${styles.text} ${title ? 'mt-0.5' : ''}`}>{message}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={`-mr-1 rounded-lg p-1 transition hover:bg-black/5 ${styles.icon}`}
            aria-label="Fermer l’alerte"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
