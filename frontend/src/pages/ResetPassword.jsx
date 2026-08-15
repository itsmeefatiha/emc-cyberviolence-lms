import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, GraduationCap, Info } from 'lucide-react'
import { confirmPasswordReset } from '../api/auth.js'
import AuthBanner from '../components/auth/AuthBanner.jsx'
import AuthButton from '../components/auth/AuthButton.jsx'
import AuthField from '../components/auth/AuthField.jsx'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthIllustration from '../assets/illustration.svg'

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

  // États pour afficher/masquer chaque mot de passe
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const uid = searchParams.get('uid') || routeUid || ''
  const token = searchParams.get('token') || routeToken || ''

  // Validations dynamiques du mot de passe
  const isEightChars = form.new_password.length >= 8
  const hasSpecialChar = /[^A-Za-z0-9]/.test(form.new_password)

  const validationError = useMemo(() => {
    if (!uid || !token) {
      return 'Le lien de réinitialisation est incomplet ou invalide.'
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
      setError('Veuillez renseigner les deux champs de mot de passe.')
      return
    }

    if (!isEightChars) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (!hasSpecialChar) {
      setError('Le mot de passe doit contenir au moins un caractère spécial.')
      return
    }

    if (form.new_password !== form.confirm_password) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      await confirmPasswordReset({ uid, token, new_password: form.new_password })
      navigate('/login', {
        replace: true,
        state: {
          successMessage: 'Mot de passe mis à jour. Vous pouvez maintenant vous connecter.',
        },
      })
    } catch (resetError) {
      setError(
        resetError?.response?.data?.detail ||
          'Impossible de réinitialiser le mot de passe.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      illustration={
        <img
          src={AuthIllustration}
          alt="Réinitialisation du mot de passe"
          className="w-full max-w-md h-auto object-contain drop-shadow-xl"
        />
      }
      footer={
        <div className="text-center text-sm text-slate-600">
          <RouterLink to="/login" className="font-semibold text-brand hover:text-brand-hover transition">
            Retour à la connexion
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
          Réinitialiser le mot de passe
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Veuillez saisir un nouveau mot de passe.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthField label="Nouveau mot de passe">
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={form.new_password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, new_password: event.target.value }))
                }
                autoComplete="new-password"
                placeholder="Saisissez votre nouveau mot de passe"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </AuthField>

          {/* Encadré d'exigences du mot de passe */}
          <div className="rounded-2xl border border-slate-200 bg-brand-light/50 p-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${isEightChars ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className={isEightChars ? 'font-medium text-slate-700' : 'text-slate-500'}>
                Doit contenir au moins 8 caractères.
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {hasSpecialChar ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Info className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span className={hasSpecialChar ? 'font-medium text-slate-700' : 'text-slate-500'}>
                Doit contenir au moins un caractère spécial.
              </span>
            </div>
          </div>

          <AuthField label="Confirmer le mot de passe">
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, confirm_password: event.target.value }))
                }
                autoComplete="new-password"
                placeholder="Répétez votre nouveau mot de passe"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
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

          <AuthBanner type={error ? 'error' : null} message={error} />

          <div className="pt-2">
            <AuthButton type="submit" disabled={loading} className="w-full">
              {loading ? 'Confirmation...' : 'Confirmer'}
            </AuthButton>
          </div>
        </form>
      </div>
    </AuthLayout>
  )
}
