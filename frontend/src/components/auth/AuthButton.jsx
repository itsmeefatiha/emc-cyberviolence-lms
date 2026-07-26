export default function AuthButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex appearance-none items-center justify-center rounded-xl border border-transparent bg-[var(--color-brand)] px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-[rgba(36,52,145,0.2)] transition-all hover:bg-[var(--color-brand-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
      style={{ backgroundColor: 'var(--color-brand)' }}
    >
      {children}
    </button>
  )
}