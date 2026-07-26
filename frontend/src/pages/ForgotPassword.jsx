import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Lock, Mail } from 'lucide-react'
import { requestPasswordReset } from '../api/auth.js'
import AuthBanner from '../components/auth/AuthBanner.jsx'
import AuthButton from '../components/auth/AuthButton.jsx'
import AuthField from '../components/auth/AuthField.jsx'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthIllustration from '../assets/illustration.svg'
import { GraduationCap } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Email is required.')
      return
    }

    setLoading(true)

    try {
      await requestPasswordReset(email.trim())
      setSuccess(true)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Unable to send reset instructions.')
    } finally {
      setLoading(false)
    }
  }

return (
    <AuthLayout
      illustration={
        <img
          src={AuthIllustration}
          alt="Password reset illustration"
          className="w-full max-w-md h-auto object-contain drop-shadow-xl"
        />
      }
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover transition">
          <ChevronLeft className="h-4 w-4" />
          Back to Sign in
        </Link>
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
          Forgot password?
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Enter your details to receive a reset link.
        </p>

        <div className="mt-6">
          <AuthBanner
            type={success ? 'success' : error ? 'error' : null}
            title={success ? 'Check your email' : undefined}
            message={success ? 'If the account exists, reset instructions have been sent.' : error}
          />
        </div>

        {!success ? (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            <AuthField>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="Enter email address"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </AuthField>

            <AuthButton type="submit" disabled={loading} className="w-full">
              {loading ? 'Sending...' : 'Submit'}
            </AuthButton>
          </form>
        ) : null}
      </div>
    </AuthLayout>
  )
}