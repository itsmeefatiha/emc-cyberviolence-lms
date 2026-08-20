import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Mail } from 'lucide-react'
import { requestPasswordReset } from '../api/auth.js'
import AuthBanner from '../components/auth/AuthBanner.jsx'
import AuthButton from '../components/auth/AuthButton.jsx'
import AuthField from '../components/auth/AuthField.jsx'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthIllustration from '../assets/illustration.svg'
import IconCap from '../assets/graduation-cap2.png'
import { getApiErrorMessage } from '../utils/apiError.js'
import useAutoDismiss from '../hooks/useAutoDismiss.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const clearError = useCallback(() => setError(null), [])
  useAutoDismiss(error, clearError)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('L’adresse e-mail est requise.')
      return
    }

    setLoading(true)

    try {
      await requestPasswordReset(email.trim())
      setSuccess(true)
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Impossible d’envoyer les instructions de réinitialisation.',
        ),
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
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover transition">
          <ChevronLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>
      }
    >
      <div>
        <div className="mb-8 flex items-center gap-2">
          <img src={IconCap} alt="EMC E-Formation" className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
            EMC E-Formation
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Mot de passe oublié ?
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.
        </p>

        <div className="mt-6">
          <AuthBanner
            type={success ? 'success' : error ? 'error' : null}
            title={success ? 'Vérifiez votre boîte e-mail' : undefined}
            message={
              success
                ? 'Si le compte existe, les instructions de réinitialisation ont été envoyées.'
                : error
            }
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
                  placeholder="Adresse e-mail"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </AuthField>

            <AuthButton type="submit" disabled={loading} className="w-full">
              {loading ? 'Envoi...' : 'Envoyer'}
            </AuthButton>
          </form>
        ) : null}
      </div>
    </AuthLayout>
  )
}
