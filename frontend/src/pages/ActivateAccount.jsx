import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { activateAccount } from '../api/auth.js'
import AuthButton from '../components/auth/AuthButton.jsx'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthIllustration from '../assets/illustration.svg'
import IconCap from '../assets/graduation-cap2.png'

export default function ActivateAccount() {
  const { uid, token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const hasAttempted = useRef(false)

  useEffect(() => {
    if (hasAttempted.current) return
    hasAttempted.current = true

    const verifyAccount = async () => {
      try {
        await activateAccount({ uid, token })
        navigate('/login', {
          replace: true,
          state: {
            successMessage: 'Compte activé avec succès ! Vous pouvez maintenant vous connecter.',
          },
        })
      } catch {
        setError('Le lien d’activation est invalide ou a expiré.')
      }
    }

    verifyAccount()
  }, [uid, token, navigate])

  return (
    <AuthLayout
      illustration={
        <img
          src={AuthIllustration}
          alt="Activation du compte"
          className="w-full max-w-md h-auto object-contain drop-shadow-xl"
        />
      }
    >
      <div>
        <div className="mb-8 flex items-center gap-2">
          <img src={IconCap} alt="EMC E-Formation" className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
            EMC E-Formation
          </span>
        </div>
        {!error ? (
          <div className="flex flex-col items-start gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-brand" />
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Activation en cours...
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Veuillez patienter pendant que nous sécurisons votre compte.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
              <AlertTriangle className="h-7 w-7 text-rose-600" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Échec de l&apos;activation
            </h1>
            <p className="text-sm font-medium text-slate-500">{error}</p>
            <div className="pt-2">
              <AuthButton type="button" onClick={() => navigate('/login')} className="w-full sm:w-auto">
                Retour à la connexion
              </AuthButton>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
