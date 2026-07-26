import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { confirmPasswordReset } from '../api/auth.js'
import AuthBanner from '../components/auth/AuthBanner.jsx'
import AuthButton from '../components/auth/AuthButton.jsx'
import AuthField from '../components/auth/AuthField.jsx'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthIllustration from '../assets/illustration.svg'
import { GraduationCap } from 'lucide-react'

const initialFormState = {
  new_password: '',
  confirm_password: '',
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const { uid: routeUid, token: routeToken } = useParams()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState(initialFormState)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const uid = searchParams.get('uid') || routeUid || ''
  const token = searchParams.get('token') || routeToken || ''

  const validationError = useMemo(() => {
    if (!uid || !token) {
      return 'The reset link is missing required information.'
    }

    return null
  }, [token, uid])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (validationError) {
      setError(validationError)
      return
    }

    if (!form.new_password.trim() || !form.confirm_password.trim()) {
      setError('Please fill in both password fields.')
      return
    }

    if (form.new_password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      await confirmPasswordReset({ uid, token, new_password: form.new_password })
      navigate('/login', {
        replace: true,
        state: {
          successMessage: 'Password updated successfully. You can now sign in.',
        },
      })
    } catch (resetError) {
      setError(resetError?.response?.data?.detail || 'Unable to reset the password.')
    } finally {
      setLoading(false)
    }
  }

  const isEightChars = form.new_password.length >= 8

return (
    <AuthLayout
      illustration={
        <img
          src={AuthIllustration}
          alt="Reset password illustration"
          className="w-full max-w-md h-auto object-contain drop-shadow-xl"
        />
      }
      footer={
        <div className="text-center text-sm text-slate-600">
          <RouterLink to="/login" className="font-semibold text-brand hover:text-brand-hover transition">
            Back to login
          </RouterLink>
        </div>
      }
    >
      <div>
        <div className="mb-8 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-slate-500 stroke-[1.5]" />
                  <span className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    EMC E-Formation
                  </span>
                </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Reset your password
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Please enter a new password.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthField label="New password">
            <input
              type="password"
              value={form.new_password}
              onChange={(event) =>
                setForm((current) => ({ ...current, new_password: event.target.value }))
              }
              autoComplete="new-password"
              placeholder="Type your new password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </AuthField>

          <div className="rounded-2xl border border-slate-200 bg-brand-light/50 p-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${isEightChars ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className={isEightChars ? 'text-slate-700' : 'text-slate-500'}>
                Must be at least 8 characters.
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-slate-500">
              <Info className="h-4 w-4 shrink-0 text-slate-400" />
              <span>Must contain one special character.</span>
            </div>
          </div>

          <AuthField label="Confirm password">
            <input
              type="password"
              value={form.confirm_password}
              onChange={(event) =>
                setForm((current) => ({ ...current, confirm_password: event.target.value }))
              }
              autoComplete="new-password"
              placeholder="Repeat your new password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </AuthField>

          <AuthBanner type={error ? 'error' : null} message={error} />

          <div className="pt-2">
            <AuthButton type="submit" disabled={loading} className="w-full">
              {loading ? 'Confirming...' : 'Confirm'}
            </AuthButton>
          </div>
        </form>
      </div>
    </AuthLayout>
  )
}