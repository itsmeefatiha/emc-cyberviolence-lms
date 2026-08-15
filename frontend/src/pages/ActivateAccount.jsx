import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
// Assurez-vous d'importer la fonction depuis le bon fichier (là où vous l'avez collée)
import { activateAccount } from '../api/auth.js' 

export default function ActivateAccount() {
  const { uid, token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  
  // useRef permet d'éviter que useEffect ne s'exécute 2 fois en mode strict React
  const hasAttempted = useRef(false)

  useEffect(() => {
    if (hasAttempted.current) return
    hasAttempted.current = true

    const verifyAccount = async () => {
      try {
        // 1. On appelle l'API backend Djoser pour activer
        await activateAccount({ uid, token })
        
        // 2. Si succès, on redirige vers le Login en passant le message dans le "state"
        // (Votre page Login va automatiquement l'afficher grâce à location.state.successMessage)
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
    <main className="min-h-screen w-full bg-slate-100 flex items-center justify-center font-sans text-slate-800 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {!error ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">Activation en cours...</h2>
            <p className="text-sm text-slate-500">Veuillez patienter pendant que nous sécurisons votre compte.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-rose-100 flex items-center justify-center mb-2">
              <AlertTriangle className="h-7 w-7 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Échec de l'activation</h2>
            <p className="text-sm text-slate-500">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </main>
  )
}