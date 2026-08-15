import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Calendar,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  Video,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getHomePath } from '../../utils/navigation.js'
import {
  createLiveSession,
  deleteLiveSession,
  joinLiveSession,
  listLiveSessions,
  updateLiveSession,
} from '../../api/liveSessions.js'

const PROFIL_LABELS = {
  EDUCATEUR: 'Éducateur',
  FORCES_ORDRE: "Forces de l'ordre",
  MAGISTRAT: 'Magistrat',
  ASSISTANT_SOCIAL: 'Assistant social',
  AUTRE: 'Autre',
}

const STATUT_OPTIONS = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'PLANIFIEE', label: 'Planifiée (publiée)' },
  { value: 'ANNULEE', label: 'Annulée' },
]

const emptyForm = () => {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 24)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)

  return {
    titre: '',
    description: '',
    profil_cible: 'EDUCATEUR',
    statut: 'BROUILLON',
    date_debut: toLocalInput(start),
    date_fin: toLocalInput(end),
  }
}

function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromApiToInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return toLocalInput(d)
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statutTone(statut) {
  switch (statut) {
    case 'PLANIFIEE':
      return 'bg-sky-50 text-sky-700'
    case 'EN_COURS':
      return 'bg-emerald-50 text-emerald-700'
    case 'TERMINEE':
      return 'bg-slate-100 text-slate-600'
    case 'ANNULEE':
      return 'bg-red-50 text-red-600'
    default:
      return 'bg-amber-50 text-amber-700'
  }
}

export default function InstructorLiveSessions() {
  const { user } = useAuth()
  const role = user?.role || 'APPRENANT'
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [joiningId, setJoiningId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listLiveSessions()
      setSessions(Array.isArray(data) ? data : data?.results || [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger les sessions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role !== 'FORMATEUR') return
    load()
  }, [load, role])

  const stats = useMemo(() => {
    const now = Date.now()
    return {
      total: sessions.length,
      planned: sessions.filter((s) => s.statut === 'PLANIFIEE' || s.statut === 'EN_COURS').length,
      upcoming: sessions.filter(
        (s) =>
          (s.statut === 'PLANIFIEE' || s.statut === 'EN_COURS') &&
          new Date(s.date_fin).getTime() >= now
      ).length,
    }
  }, [sessions])

  if (role !== 'FORMATEUR') {
    return <Navigate to={getHomePath(role)} replace />
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (session) => {
    setEditingId(session.id)
    setForm({
      titre: session.titre || '',
      description: session.description || '',
      profil_cible: session.profil_cible || 'EDUCATEUR',
      statut: ['BROUILLON', 'PLANIFIEE', 'ANNULEE'].includes(session.statut)
        ? session.statut
        : 'PLANIFIEE',
      date_debut: fromApiToInput(session.date_debut),
      date_fin: fromApiToInput(session.date_fin),
    })
    setFormError('')
    setModalOpen(true)
  }

  const openRoom = async (session) => {
    setJoiningId(session.id)
    setError('')
    try {
      await joinLiveSession(session.id)
      navigate(`/live-sessions/${session.id}/room`)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible d’ouvrir la salle.')
    } finally {
      setJoiningId(null)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = {
      titre: form.titre.trim(),
      description: form.description.trim(),
      profil_cible: form.profil_cible,
      statut: form.statut,
      date_debut: new Date(form.date_debut).toISOString(),
      date_fin: new Date(form.date_fin).toISOString(),
    }
    try {
      if (editingId) {
        await updateLiveSession(editingId, payload)
      } else {
        await createLiveSession(payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      const data = err?.response?.data
      const msg =
        data?.detail ||
        data?.date_debut?.[0] ||
        data?.date_fin?.[0] ||
        data?.non_field_errors?.[0] ||
        'Enregistrement impossible.'
      setFormError(typeof msg === 'string' ? msg : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (session) => {
    if (!window.confirm(`Supprimer la session « ${session.titre} » ?`)) return
    try {
      await deleteLiveSession(session.id)
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Suppression impossible.')
    }
  }

  const publish = async (session) => {
    try {
      await updateLiveSession(session.id, { statut: 'PLANIFIEE' })
      await load()
    } catch (err) {
      setError(
          err?.response?.data?.detail ||
          'Publication impossible.'
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Sessions live</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Programmez des formations en direct ciblées par profil. La visioconférence est
            intégrée à la plateforme : aucune outil Zoom/Meet à configurer.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#243491] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1b276e]"
        >
          <Plus className="h-4 w-4" />
          Nouvelle session
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Video} label="Total" value={stats.total} tone="indigo" />
        <StatCard icon={Calendar} label="Publiées" value={stats.planned} tone="sky" />
        <StatCard icon={Clock} label="À venir" value={stats.upcoming} tone="emerald" />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <Video className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Aucune session pour le moment</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 text-xs font-bold text-brand hover:underline"
          >
            Créer la première session
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{session.titre}</h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statutTone(session.statut)}`}
                    >
                      {session.statut_display || session.statut}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {PROFIL_LABELS[session.profil_cible] || session.profil_cible}
                    </span>
                  </div>
                  {session.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{session.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDateTime(session.date_debut)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Fin {formatDateTime(session.date_fin)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {session.participants_count || 0} participant(s)
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {session.statut !== 'BROUILLON' &&
                  session.statut !== 'ANNULEE' &&
                  session.statut !== 'TERMINEE' ? (
                    <button
                      type="button"
                      onClick={() => openRoom(session)}
                      disabled={joiningId === session.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#243491] px-3 py-2 text-xs font-bold text-white hover:bg-[#1b276e] disabled:opacity-60"
                    >
                      {joiningId === session.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Video className="h-3.5 w-3.5" />
                      )}
                      Ouvrir la salle
                    </button>
                  ) : null}
                  {session.statut === 'BROUILLON' ? (
                    <button
                      type="button"
                      onClick={() => publish(session)}
                      className="rounded-xl bg-[#243491] px-3 py-2 text-xs font-bold text-white hover:bg-[#1b276e]"
                    >
                      Publier
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openEdit(session)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(session)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editingId ? 'Modifier la session' : 'Nouvelle session live'}
            </h2>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <Field label="Titre">
                <input
                  required
                  value={form.titre}
                  onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Profil cible">
                  <select
                    value={form.profil_cible}
                    onChange={(e) => setForm((f) => ({ ...f, profil_cible: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  >
                    {Object.entries(PROFIL_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Statut">
                  <select
                    value={form.statut}
                    onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  >
                    {STATUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Début">
                  <input
                    required
                    type="datetime-local"
                    value={form.date_debut}
                    onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  />
                </Field>
                <Field label="Fin">
                  <input
                    required
                    type="datetime-local"
                    value={form.date_fin}
                    onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  />
                </Field>
              </div>

              <p className="rounded-xl bg-brand-light px-3 py-2 text-xs font-medium text-brand">
                La salle vidéo est créée automatiquement dans la plateforme (caméra, micro,
                partage d’écran, chat).
              </p>

              {formError ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {formError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#243491] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1b276e] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}
