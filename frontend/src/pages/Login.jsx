import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthBanner from '../components/auth/AuthBanner.jsx'
import AuthButton from '../components/auth/AuthButton.jsx'
import AuthField from '../components/auth/AuthField.jsx'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthIllustration from '../assets/illustration.svg'
import { Eye, EyeOff } from 'lucide-react'
import IconCap from '../assets/graduation-cap2.png'
import { getHomePath } from '../utils/navigation.js'
import { getApiErrorMessage } from '../utils/apiError.js'
import useAutoDismiss from '../hooks/useAutoDismiss.js'

const initialFormState = {
  email: '',
  password: '',
  rememberMe: false,
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, error, setError, loading, isAuthenticated, user } = useAuth()
  const successMessage = location.state?.successMessage ?? null
  const [form, setForm] = useState(initialFormState)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const dismissErrors = useCallback(() => {
    setSubmitError(null)
    setError(null)
  }, [setError])
  useAutoDismiss(submitError ?? error, dismissErrors)
  const banner = useMemo(() => {
    const bannerError = submitError ?? error

    if (bannerError) {
      return {
        type: 'error',
        message: getApiErrorMessage(
          { response: { data: { detail: bannerError } } },
          bannerError,
        ),
      }
    }

    if (successMessage) {
      return {
        type: 'success',
        message: successMessage,
      }
    }

    return null
  }, [error, submitError, successMessage])

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getHomePath(user.role), { replace: true })
    }
  }, [isAuthenticated, user, navigate])

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
    if (submitError) {
      setSubmitError(null)
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
      const session = await login({ email: form.email.trim(), password: form.password })
      navigate(getHomePath(session?.user?.role), { replace: true })
    } catch (caughtError) {
      setSubmitError(
        getApiErrorMessage(
          caughtError,
          'Connexion impossible. Vérifiez votre réseau et réessayez.',
        ),
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
          alt="Connexion" 
          className="w-full max-w-md h-auto object-contain drop-shadow-xl" 
        />
      }
      footer={
        <div className="text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-semibold text-brand hover:text-brand-hover hover:underline">
            S'inscrire
          </Link>
        </div>
      }
    >
      <div>
        <div className="mb-8 flex items-center gap-2">
          <img src={IconCap} alt="EMC E-Formation" className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
            EMC E-Formation
          </span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Bonjour,<br />
          Bon retour
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Bienvenue sur votre espace de formation sécurisé.
        </p>

        <div className="mt-6">
          <AuthBanner type={banner?.type} message={banner?.message} />
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthField label="E-mail" error={fieldErrors.email}>
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

          <AuthField label="Mot de passe" error={fieldErrors.password}>
  <div className="relative">
    <input
      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
      type={showPassword ? 'text' : 'password'}
      name="password"
      autoComplete="current-password"
      placeholder="••••••••••••"
      value={form.password}
      onChange={handleChange}
    />
    <button
      type="button"
      onClick={() => setShowPassword((prev) => !prev)}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
    >
      {showPassword ? (
        <EyeOff className="h-5 w-5" />
      ) : (
        <Eye className="h-5 w-5" />
      )}
    </button>
  </div>
</AuthField>

          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <label className="flex cursor-pointer select-none items-center gap-2">
            </label>
            <Link to="/forgot-password" className="transition-colors hover:text-slate-700">
              Mot de passe oublié ?
            </Link>
          </div>

          <div className="pt-4">
            <AuthButton type="submit" disabled={isBusy} className="w-full sm:w-auto">
              {isBusy ? 'Connexion...' : 'Se connecter'}
            </AuthButton>
          </div>
        </form>
      </div>
    </AuthLayout>
  )
}