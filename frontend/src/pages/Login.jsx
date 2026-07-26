import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthBanner from '../components/auth/AuthBanner.jsx'
import AuthButton from '../components/auth/AuthButton.jsx'
import AuthField from '../components/auth/AuthField.jsx'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthIllustration from '../assets/illustration.svg'
import { GraduationCap } from 'lucide-react'

const initialFormState = {
  email: '',
  password: '',
  rememberMe: false,
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, error, setError, loading, isAuthenticated } = useAuth()
  const successMessage = location.state?.successMessage ?? null
  const [form, setForm] = useState(initialFormState)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const banner = useMemo(() => {
    if (successMessage) {
      return {
        type: 'success',
        message: successMessage,
      }
    }

    const bannerError = submitError ?? error

    if (!bannerError) {
      return null
    }

    return {
      type: 'error',
      message:
        bannerError === 'No active account found with the given credentials'
          ? 'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.'
          : bannerError,
    }
  }, [error, submitError, successMessage])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const validate = () => {
    const nextErrors = {}

    if (!form.email.trim()) {
      nextErrors.email = 'L’adresse e-mail est requise.'
    }

    if (!form.password.trim()) {
      nextErrors.password = 'Le mot de passe est requis.'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (error) {
      setError(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError(null)

    if (!validate()) {
      return
    }

    setSubmitting(true)

    try {
      await login({ email: form.email.trim(), password: form.password })
      navigate('/dashboard', { replace: true })
    } catch (submitError) {
      setSubmitError(
        submitError?.response?.data?.detail ||
          submitError?.response?.data?.non_field_errors?.[0] ||
          'Connexion impossible. Vérifiez votre réseau et réessayez.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const isBusy = loading || submitting

return (
    <AuthLayout
      illustration={
        <img 
          src={AuthIllustration} 
          alt="Login" 
          className="w-full max-w-md h-auto object-contain drop-shadow-xl" 
        />
      }
      footer={
        <div className="text-sm text-slate-600">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-brand hover:text-brand-hover hover:underline">
            Sign Up
          </Link>
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

        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Hello,<br />
          Welcome Back
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Hey, welcome back to your secure workspace.
        </p>

        <div className="mt-6">
          <AuthBanner
            type={banner?.type}
            message={banner?.message}
            className="mt-0"
          />
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthField error={fieldErrors.email}>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="stanley@gmail.com"
              value={form.email}
              onChange={handleChange}
            />
          </AuthField>

          <AuthField error={fieldErrors.password}>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={form.password}
              onChange={handleChange}
            />
          </AuthField>

          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                name="rememberMe"
                checked={form.rememberMe}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span>Remember me</span>
            </label>
            <Link to="/forgot-password" className="transition-colors hover:text-slate-700">
              Forgot Password?
            </Link>
          </div>

          <div className="pt-4">
            <AuthButton type="submit" disabled={isBusy} className="w-full sm:w-auto">
              {isBusy ? 'Signing in...' : 'Sign In'}
            </AuthButton>
          </div>
        </form>
      </div>
    </AuthLayout>
  )
}