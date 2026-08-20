import { useState, useEffect, useCallback } from 'react'
import {
  Edit3,
  Check,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Camera,
} from 'lucide-react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import { resolveBackendUrl } from '../utils/courseHelpers.js'
import { getApiErrorMessage } from '../utils/apiError.js'
import useAutoDismiss from '../hooks/useAutoDismiss.js'
import { PROFIL_OPTIONS, getProfilLabel } from '../constants/profiles.js'

export default function Profile() {
  const { refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const clearError = useCallback(() => setError(null), [])
  const clearSuccess = useCallback(() => setSuccessMsg(null), [])
  useAutoDismiss(error, clearError)
  useAutoDismiss(successMsg, clearSuccess)

  // Données utilisateur
  const [user, setUser] = useState(null)

  // Modes d'édition par section
  const [editingPersonal, setEditingPersonal] = useState(false)
  const [editingProfessional, setEditingProfessional] = useState(false)

  // Formulaires temporaires
  const [personalData, setPersonalData] = useState({})
  const [professionalData, setProfessionalData] = useState({})

  // Fetch initial des données (/api/auth/users/me/)
  const fetchUserProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await client.get('/auth/users/me/')
      const data = response.data
      setUser(data)
      setPersonalData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        username: data.username || '',
        email: data.email || '',
        telephone: data.telephone || '',
      })
      setProfessionalData({
        profil_professionnel: data.profil_professionnel || '',
        specialite: data.specialite || '',
      })
    } catch (err) {
      console.error('Erreur chargement profil:', err)
      setError('Impossible de charger les informations de votre compte.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserProfile()
  }, [])

  // Soumission de la mise à jour (PATCH vers /auth/users/me/)
  const handleSave = async (payload, sectionSetter) => {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const response = await client.patch('/auth/users/me/', payload)
      setUser(response.data)
      sectionSetter(false)
      setSuccessMsg('Modifications enregistrées avec succès !')
      try {
        await refreshUser?.()
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error('Erreur mise à jour profil:', err)
      const msg = getApiErrorMessage(err, 'Erreur lors de la mise à jour de vos informations.')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  // Upload photo de profil
  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image (JPG, PNG, WEBP…).')
      return
    }

    setUploadingPhoto(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const response = await client.patch('/auth/users/me/', formData)
      setUser(response.data)
      try {
        await refreshUser?.()
      } catch {
        /* ignore */
      }
      setSuccessMsg('Photo de profil mise à jour !')
    } catch (err) {
      setError(getApiErrorMessage(err, "Échec de l'upload."))
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-start space-x-2 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-[#243491]" />
        <span className="text-sm font-medium">Chargement du profil...</span>
      </div>
    )
  }

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : user?.username?.slice(0, 2).toUpperCase() || 'EM'
  const photoUrl = user?.photo ? resolveBackendUrl(user.photo) : ''

  return (
    <div className="space-y-6 pb-12 text-left">
      {/* Titre Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres du Compte</h1>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Gérez vos informations personnelles et vos compétences.
        </p>
      </div>

      {/* Notifications (Succès / Erreur) */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* CARTE 1 : EN-TÊTE UTILISATEUR (AVATAR + NOM + RÔLE) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Photo de profil"
                className="h-20 w-20 rounded-full object-cover ring-4 ring-slate-100"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#243491] text-2xl font-bold text-white ring-4 ring-slate-100">
                {initials}
              </div>
            )}
            <label
              className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-[#243491] shadow-sm transition-colors hover:bg-slate-50"
              title="Changer la photo"
            >
              {uploadingPhoto ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
                disabled={uploadingPhoto}
              />
            </label>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.username}
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {getProfilLabel(user?.profil_professionnel, 'Apprenant')}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-[#243491]">
                Rôle : {user?.role || 'APPRENANT'}
              </span>
              {user?.is_active && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Actif
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CARTE 2 : INFORMATIONS PERSONNELLES */}
      <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900">
            Informations Personnelles
          </h3>
          {!editingPersonal ? (
            <button
              onClick={() => setEditingPersonal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5 text-slate-400" />
              <span>Modifier</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingPersonal(false)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" />
                <span>Annuler</span>
              </button>
              <button
                onClick={() => handleSave(personalData, setEditingPersonal)}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-xl bg-[#243491] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1c2975]"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Enregistrer</span>
              </button>
            </div>
          )}
        </div>

        {!editingPersonal ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Prénom</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {user?.first_name || '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Nom</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {user?.last_name || '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">
                Nom d'utilisateur
              </p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {user?.username || '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Adresse Email</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {user?.email || '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Téléphone</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {user?.telephone || 'Non renseigné'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Rôle Utilisateur</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {user?.role || 'APPRENANT'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Prénom
              </label>
              <input
                type="text"
                value={personalData.first_name}
                onChange={(e) =>
                  setPersonalData({ ...personalData, first_name: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#243491] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Nom
              </label>
              <input
                type="text"
                value={personalData.last_name}
                onChange={(e) =>
                  setPersonalData({ ...personalData, last_name: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#243491] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={personalData.username}
                onChange={(e) =>
                  setPersonalData({ ...personalData, username: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#243491] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Téléphone
              </label>
              <input
                type="text"
                value={personalData.telephone}
                onChange={(e) =>
                  setPersonalData({ ...personalData, telephone: e.target.value })
                }
                placeholder="+212 6..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#243491] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* CARTE 3 : PROFIL PÉDAGOGIQUE & SPÉCIALITÉ */}
      <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900">
            Profil Pédagogique & Spécialité
          </h3>
          {!editingProfessional ? (
            <button
              onClick={() => setEditingProfessional(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5 text-slate-400" />
              <span>Modifier</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingProfessional(false)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" />
                <span>Annuler</span>
              </button>
              <button
                onClick={() =>
                  handleSave(
                    {
                      specialite: professionalData.specialite?.trim() || null,
                      profil_professionnel: professionalData.profil_professionnel || null,
                    },
                    setEditingProfessional,
                  )
                }
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-xl bg-[#243491] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1c2975]"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Enregistrer</span>
              </button>
            </div>
          )}
        </div>

        {!editingProfessional ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Profil Cible</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {getProfilLabel(user?.profil_professionnel)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">
                Spécialité / Domaine
              </p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {user?.specialite || 'Non renseignée'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Membre depuis le</p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Profil Cible
              </label>
              <select
                value={professionalData.profil_professionnel}
                onChange={(e) =>
                  setProfessionalData({
                    ...professionalData,
                    profil_professionnel: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#243491] focus:outline-none"
              >
                <option value="">Sélectionner...</option>
                {PROFIL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Spécialité
              </label>
              <input
                type="text"
                value={professionalData.specialite}
                onChange={(e) =>
                  setProfessionalData({
                    ...professionalData,
                    specialite: e.target.value,
                  })
                }
                placeholder="Ex: Cybersécurité, Informatique..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#243491] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}