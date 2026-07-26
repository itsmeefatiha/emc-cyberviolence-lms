export default function AuthField({ label, error, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      {label ? <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span> : null}
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p> : null}
    </label>
  )
}