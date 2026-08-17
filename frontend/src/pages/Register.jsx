import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import AuthBanner from '../components/auth/AuthBanner.jsx'
import AuthButton from '../components/auth/AuthButton.jsx'
import AuthField from '../components/auth/AuthField.jsx'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthIllustration from '../assets/illustration.svg'
import IconCap from '../assets/graduation-cap2.png'

const initialFormState = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  confirm_password: '',
}

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const { register, error, setError, loading } = useAuth()
  const [form, setForm] = useState(initialFormState)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const successMessage = location.state?.successMessage ?? null

  // États pour afficher/masquer chaque mot de passe
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const validate = () => {
    const nextErrors = {}

    if (!form.first_name.trim()) nextErrors.first_name = 'Le prénom est requis.'
    if (!form.last_name.trim()) nextErrors.last_name = 'Le nom est requis.'
    if (!form.email.trim()) nextErrors.email = 'L’adresse e-mail est requise.'
    if (!form.password.trim()) nextErrors.password = 'Le mot de passe est requis.'
    if (form.password.trim() && form.password.length < 8) {
      nextErrors.password = 'Le mot de passe doit contenir au moins 8 caractères.'
    }
    if (!form.confirm_password.trim()) nextErrors.confirm_password = 'Veuillez confirmer votre mot de passe.'
    if (form.password && form.confirm_password && form.password !== form.confirm_password) {
      nextErrors.confirm_password = 'Les mots de passe ne correspondent pas.'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (error) setError(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setSubmitting(true)

    try {
      await register(form)
      navigate('/register', {
        replace: true,
        state: {
          successMessage:
            'Compte créé avec succès ! Consultez votre boîte e-mail pour activer votre compte avant de vous connecter.',
        },
      })
    } catch {
      // Les erreurs d'API sont gérées par AuthContext
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
          alt="Inscription"
          className="w-full max-w-md h-auto object-contain drop-shadow-xl"
        />
      }
      footer={
        <div className="text-sm text-slate-600">
          Vous avez déjà un compte ?{' '}
          <Link to="/login" className="font-semibold text-brand hover:text-brand-hover hover:underline">
            Se connecter
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
          Rejoignez-nous
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Créez votre profil pour accéder à l’espace de formation sécurisé.
        </p>

        <div className="mt-6">
          <AuthBanner
            type={successMessage ? 'success' : error ? 'error' : null}
            title={successMessage ? 'Compte créé !' : undefined}
            message={successMessage || error}
          />
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField error={fieldErrors.first_name}>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                type="text"
                name="first_name"
                autoComplete="given-name"
                placeholder="Prénom"
                value={form.first_name}
                onChange={handleChange}
              />
            </AuthField>
            <AuthField error={fieldErrors.last_name}>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                type="text"
                name="last_name"
                autoComplete="family-name"
                placeholder="Nom"
                value={form.last_name}
                onChange={handleChange}
              />
            </AuthField>
          </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField error={fieldErrors.password}>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  placeholder="Mot de passe"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </AuthField>

            <AuthField error={fieldErrors.confirm_password}>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm_password"
                  autoComplete="new-password"
                  placeholder="Confirmer le mot de passe"
                  value={form.confirm_password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </AuthField>
          </div>

          <div className="pt-4">
            <AuthButton type="submit" disabled={isBusy} className="w-full sm:w-auto">
              {isBusy ? 'Création du compte...' : "S'inscrire"}
            </AuthButton>
          </div>
        </form>
      </div>
    </AuthLayout>
  )
}