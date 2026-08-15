import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Radio,
  Video,
} from 'lucide-react'
import {
  getUpcomingLiveSessions,
  joinLiveSession,
  listLiveSessions,
} from '../../api/liveSessions.js'
import { resolveBackendUrl } from '../../utils/courseHelpers.js'

const PROFIL_LABELS = {
  EDUCATEUR: 'Éducateur',
  FORCES_ORDRE: "Forces de l'ordre",
  MAGISTRAT: 'Magistrat',
  ASSISTANT_SOCIAL: 'Assistant social',
  AUTRE: 'Autre',
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCountdown(iso) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return null
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (hours > 48) {
    const days = Math.ceil(hours / 24)
    return `Dans ${days} jour${days > 1 ? 's' : ''}`
  }
  if (hours > 0) return `Dans ${hours}h ${minutes}min`
  return `Dans ${minutes} min`
}

function isSessionEnded(session) {
  if (!session) return false
  if (session.est_terminee || session.statut === 'TERMINEE') return true
  const end = new Date(session.date_fin).getTime()
  return Number.isFinite(end) && end < Date.now()
}

export default function LearnerLiveSessions() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('session')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joiningId, setJoiningId] = useState(null)
  const [joinError, setJoinError] = useState('')

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
    load()
  }, [load])

  useEffect(() => {
    if (!highlightId) return
    const el = document.getElementById(`session-${highlightId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, sessions])

  const { live, upcoming, past } = useMemo(() => {
    const now = Date.now()
    const liveList = []
    const upcomingList = []
    const pastList = []
    for (const s of sessions) {
      if (s.statut === 'ANNULEE') continue
      if (isSessionEnded(s)) {
        pastList.push(s)
        continue
      }
      const start = new Date(s.date_debut).getTime()
      const end = new Date(s.date_fin).getTime()
      if (s.statut === 'EN_COURS' || (start <= now && now <= end)) {
        liveList.push(s)
      } else {
        upcomingList.push(s)
      }
    }
    return { live: liveList, upcoming: upcomingList, past: pastList }
  }, [sessions])

  const handleJoin = async (session) => {
    if (isSessionEnded(session)) {
      setJoinError('Cette session est terminée.')
      return
    }
    setJoiningId(session.id)
    setJoinError('')
    try {
      await joinLiveSession(session.id)
      navigate(`/live-sessions/${session.id}/room`)
    } catch (err) {
      setJoinError(
        err?.response?.data?.detail ||
          'Impossible de rejoindre la session pour le moment.'
      )
    } finally {
      setJoiningId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Sessions live</h1>
        <p className="mt-1 text-sm text-slate-500">
          Formations en direct dans la plateforme (caméra, micro, chat). Rejoignez 15 minutes
          avant le début.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      ) : null}

      {joinError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {joinError}
        </div>
      ) : null}

      {live.length === 0 && upcoming.length === 0 && past.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <Video className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Aucune session live pour votre profil
          </p>
        </div>
      ) : null}

      {live.length > 0 ? (
        <Section title="En direct maintenant" icon={Radio}>
          <div className="grid gap-4 md:grid-cols-2">
            {live.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                highlighted={highlightId === String(session.id)}
                joining={joiningId === session.id}
                onJoin={() => handleJoin(session)}
                live
              />
            ))}
          </div>
        </Section>
      ) : null}

      {upcoming.length > 0 ? (
        <Section title="À venir" icon={Calendar}>
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                highlighted={highlightId === String(session.id)}
                joining={joiningId === session.id}
                onJoin={() => handleJoin(session)}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {past.length > 0 ? (
        <Section title="Terminées" icon={CheckCircle2}>
          <div className="grid gap-4 md:grid-cols-2">
            {past.map((session) => (
              <SessionCard key={session.id} session={session} past />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand" />
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function SessionCard({ session, onJoin, joining, live, past, highlighted }) {
  const ended = past || isSessionEnded(session)
  const countdown = !live && !ended ? formatCountdown(session.date_debut) : null
  const canJoin = Boolean(session.peut_rejoindre) && !ended

  return (
    <article
      id={`session-${session.id}`}
      className={`rounded-2xl border p-5 transition ${
        ended
          ? 'border-slate-200 bg-slate-50/80 opacity-95'
          : highlighted
            ? 'border-brand bg-white shadow-md shadow-brand/10'
            : live
              ? 'border-emerald-200 bg-white shadow-sm'
              : 'border-slate-200/80 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {ended ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <CheckCircle2 className="h-3 w-3" />
                Session terminée
              </span>
            ) : live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {PROFIL_LABELS[session.profil_cible] || session.profil_cible}
            </span>
          </div>
          <h3 className={`mt-2 text-base font-bold ${ended ? 'text-slate-600' : 'text-slate-900'}`}>
            {session.titre}
          </h3>
          {session.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{session.description}</p>
          ) : null}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            ended ? 'bg-slate-200 text-slate-500' : 'bg-brand-light text-brand'
          }`}
        >
          <Video className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-xs font-medium text-slate-500">
        <p className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateTime(session.date_debut)}
        </p>
        <p className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Jusqu’à {formatDateTime(session.date_fin)}
        </p>
        <p>Animée par {session.formateur_nom || 'Formateur'}</p>
        {countdown ? <p className="font-bold text-brand">{countdown}</p> : null}
      </div>

      {ended ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
          <p className="text-sm font-bold text-slate-700">Session terminée</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Cette visioconférence n’est plus disponible.
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canJoin || joining}
          onClick={onJoin}
          className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            canJoin
              ? 'bg-[#243491] text-white hover:bg-[#1b276e]'
              : 'cursor-not-allowed bg-slate-100 text-slate-400'
          }`}
        >
          {joining ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          {canJoin ? 'Rejoindre la session' : 'Bientôt disponible'}
        </button>
      )}
    </article>
  )
}

const PROFIL_STYLES = {
  EDUCATEUR: {
    tagColor: 'bg-indigo-100 text-indigo-600',
    barColor: 'bg-indigo-600',
  },
  FORCES_ORDRE: {
    tagColor: 'bg-emerald-100 text-emerald-600',
    barColor: 'bg-emerald-500',
  },
  MAGISTRAT: {
    tagColor: 'bg-rose-100 text-rose-600',
    barColor: 'bg-rose-500',
  },
  ASSISTANT_SOCIAL: {
    tagColor: 'bg-amber-100 text-amber-600',
    barColor: 'bg-amber-500',
  },
  AUTRE: {
    tagColor: 'bg-sky-100 text-sky-600',
    barColor: 'bg-sky-500',
  },
}

function formatEventDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatEventTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeRange(startIso, endIso) {
  const start = formatEventTime(startIso)
  const end = formatEventTime(endIso)
  if (!start) return ''
  return end ? `${start} - ${end}` : start
}

function dateLabelFor(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Aujourd\'hui'
  if (sameDay(d, tomorrow)) return 'Demain'
  return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
}

function formateurInitials(name) {
  if (!name) return 'F'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

/** Dashboard widget — Upcoming Events design for live sessions */
export function UpcomingSessionsWidget() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState(null)

  useEffect(() => {
    let cancelled = false
    getUpcomingLiveSessions()
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : []
          setSessions(list.filter((s) => !isSessionEnded(s)).slice(0, 4))
        }
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleJoin = async (session) => {
    if (!session?.peut_rejoindre) {
      navigate('/live-sessions')
      return
    }
    setJoiningId(session.id)
    try {
      await joinLiveSession(session.id)
      navigate(`/live-sessions/${session.id}/room`)
    } finally {
      setJoiningId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-3xl bg-white text-slate-400 shadow-[0_12px_40px_-16px_rgba(36,52,145,0.18)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="w-full rounded-3xl bg-white p-6 shadow-[0_12px_40px_-16px_rgba(36,52,145,0.18)]">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Événements à venir</h3>
          <Link to="/live-sessions" className="text-slate-400 transition hover:text-slate-600">
            <MoreHorizontal className="h-5 w-5" />
          </Link>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center">
          <Video className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-600">Aucune session live à venir</p>
          <Link to="/live-sessions" className="mt-2 inline-block text-xs font-bold text-brand">
            Voir tout
          </Link>
        </div>
      </div>
    )
  }

  const [featured, ...rest] = sessions
  const secondary = rest.slice(0, 3)
  const photoUrl = resolveBackendUrl(featured.formateur_photo)
  const isLive =
    featured.statut === 'EN_COURS' ||
    (new Date(featured.date_debut).getTime() <= Date.now() &&
      new Date(featured.date_fin).getTime() >= Date.now())

  return (
    <div className="w-full rounded-3xl bg-white p-6 shadow-[0_12px_40px_-16px_rgba(36,52,145,0.18)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Événements à venir</h3>
        <Link to="/live-sessions" className="text-slate-400 transition hover:text-slate-600">
          <MoreHorizontal className="h-5 w-5" />
        </Link>
      </div>

      <div className="rounded-2xl bg-[#032039] p-5 text-white shadow-sm">
        <div className="flex items-start gap-3.5">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={featured.formateur_nom || 'Formateur'}
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/10"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white ring-2 ring-white/10">
              {formateurInitials(featured.formateur_nom)}
            </div>
          )}
          <div className="min-w-0">
            {isLive ? (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            ) : null}
            <h4 className="text-sm font-bold leading-snug text-white">{featured.titre}</h4>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-300">
              {featured.description ||
                `Avec ${featured.formateur_nom || 'formateur'} · ${
                  PROFIL_LABELS[featured.profil_cible] || featured.profil_cible || 'Session live'
                }`}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between gap-3">
          <div className="space-y-0.5 text-xs font-medium text-slate-300/80">
            <span>{formatEventDate(featured.date_debut)}</span>
            <span className="ml-3">{formatTimeRange(featured.date_debut, featured.date_fin)}</span>
          </div>
          <button
            type="button"
            disabled={joiningId === featured.id}
            onClick={() => handleJoin(featured)}
            className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:opacity-70"
          >
            {joiningId === featured.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : featured.peut_rejoindre ? (
              'Rejoindre'
            ) : (
              'Voir'
            )}
          </button>
        </div>
      </div>

      {secondary.length > 0 ? (
        <div className="mt-4 space-y-3">
          {secondary.map((event) => {
            const style = PROFIL_STYLES[event.profil_cible] || PROFIL_STYLES.AUTRE
            const tag = PROFIL_LABELS[event.profil_cible] || event.profil_cible || 'Live'
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => navigate('/live-sessions')}
                className="flex w-full cursor-pointer items-center justify-between rounded-2xl bg-slate-50/80 p-3.5 text-left transition hover:bg-slate-100/80"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-8 w-1 shrink-0 rounded-full ${style.barColor}`} />
                  <div className="min-w-0">
                    <h5 className="truncate text-xs font-bold text-slate-800">{event.titre}</h5>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-400">
                        {formatEventTime(event.date_debut)}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${style.tagColor}`}
                      >
                        {tag}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
                  <span>{dateLabelFor(event.date_debut)}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
