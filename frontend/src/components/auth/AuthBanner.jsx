import { AlertTriangle, CheckCircle2 } from 'lucide-react'

const bannerStyles = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    text: 'text-emerald-700',
    Icon: CheckCircle2,
  },
  error: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: 'text-rose-600',
    title: 'text-rose-900',
    text: 'text-rose-700',
    Icon: AlertTriangle,
  },
}

export default function AuthBanner({ type, title, message, className = '' }) {
  if (!type || !message) {
    return null
  }

  const styles = bannerStyles[type]
  if (!styles) {
    return null
  }

  const Icon = styles.Icon

  return (
    <div className={`rounded-2xl border px-4 py-4 text-sm shadow-sm ${styles.wrapper} ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} />
        <div>
          {title ? <p className={`font-semibold ${styles.title}`}>{title}</p> : null}
          <p className={`mt-0.5 leading-relaxed ${styles.text}`}>{message}</p>
        </div>
      </div>
    </div>
  )
}