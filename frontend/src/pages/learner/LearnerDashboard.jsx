import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  PlayCircle,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getMySummary, toggleFavorite } from '../../api/progression.js'
import { listCertificats } from '../../api/quizzes.js'
import { resolveBackendUrl } from '../../utils/courseHelpers.js'
import ActivityChart from '../../components/dashboard/ActivityChart.jsx'
import { UpcomingSessionsWidget } from './LiveSessions.jsx'
import { getHomePath } from '../../utils/navigation.js'

const COVER_FALLBACKS = ['bg-indigo-50', 'bg-sky-50', 'bg-amber-50', 'bg-emerald-50']

const CARD =
  'rounded-2xl bg-white p-5 shadow-[0_12px_40px_-16px_rgba(36,52,145,0.18)]'

const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes} min`
}

function MetricCard({ icon: Icon, tone, label, value }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-500',
    amber: 'bg-amber-50 text-amber-500',
  }
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_12px_40px_-16px_rgba(36,52,145,0.18)]">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone] || tones.sky}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

export default function LearnerDashboard() {
  const { user } = useAuth()
  const role = user?.role || 'APPRENANT'
  const [summary, setSummary] = useState(null)
  const [certCount, setCertCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [favoritingId, setFavoritingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryData, certs] = await Promise.all([
        getMySummary(),
        listCertificats().catch(() => []),
      ])
      setSummary(summaryData)
      setCertCount(Array.isArray(certs) ? certs.length : certs?.count || 0)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger le tableau de bord.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role !== 'APPRENANT') return
    load()
  }, [load, role])

  const ongoing = useMemo(
    () => (summary?.parcours || []).filter((p) => !p.est_termine && p.is_enrolled !== false),
    [summary]
  )
  const completed = useMemo(
    () => (summary?.parcours || []).filter((p) => p.est_termine),
    [summary]
  )

  const handleFavorite = async (parcoursId) => {
    setFavoritingId(parcoursId)
    try {
      const result = await toggleFavorite(parcoursId)
      setSummary((current) => {
        if (!current) return current
        return {
          ...current,
          parcours: current.parcours.map((item) =>
            item.parcours_id === parcoursId
              ? { ...item, is_favorite: result.is_favorite }
              : item
          ),
        }
      })
    } finally {
      setFavoritingId(null)
    }
  }

  if (role !== 'APPRENANT') {
    return <Navigate to={getHomePath(role)} replace />
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mr-2 inline h-4 w-4" />
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <MetricCard
          icon={Clock}
          tone="sky"
          label="En cours"
          value={`${ongoing.length} parcours`}
        />
        <MetricCard
          icon={CheckCircle2}
          tone="emerald"
          label="Terminés"
          value={`${completed.length} parcours`}
        />
        <MetricCard
          icon={Award}
          tone="amber"
          label="Certificats"
          value={`${certCount}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5 lg:items-start">
        <div className="space-y-5 lg:col-span-3">
          <div className={`${CARD} space-y-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">En cours</h2>
              <Link to="/my-courses" className="text-xs font-bold text-brand hover:underline">
                Voir tout
              </Link>
            </div>

            {ongoing.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-6 py-10 text-center">
                <p className="text-sm font-semibold text-slate-600">Aucun parcours en cours</p>
                <Link to="/browse" className="mt-3 inline-block text-xs font-bold text-brand">
                  Explorer le catalogue
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {ongoing.slice(0, 3).map((course, idx) => {
                  const imageUrl = resolveBackendUrl(course.image)
                  const pct = Math.round(course.pourcentage || 0)
                  return (
                    <div key={course.parcours_id} className="rounded-2xl bg-slate-50/80 p-3">
                      <div
                        className={`relative h-28 w-full overflow-hidden rounded-xl ${COVER_FALLBACKS[idx % COVER_FALLBACKS.length]}`}
                      >
                        {imageUrl ? (
                          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen className="h-8 w-8 text-slate-300" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleFavorite(course.parcours_id)}
                          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-400 hover:text-red-500"
                        >
                          {favoritingId === course.parcours_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Heart
                              className={`h-3.5 w-3.5 ${course.is_favorite ? 'fill-red-500 text-red-500' : ''}`}
                            />
                          )}
                        </button>
                      </div>
                      <div className="mt-3 space-y-2">
                        <h3 className="line-clamp-1 text-sm font-bold text-slate-900">
                          {course.parcours_titre}
                        </h3>
                        <p className="text-xs font-medium text-slate-400">
                          {course.formateur_nom || 'EMC'}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white">
                            <div
                              className="h-full rounded-full transition-[width] duration-300"
                              style={{
                                width: `${Math.min(100, Math.max(0, pct))}%`,
                                backgroundColor: 'var(--color-brand, #243491)',
                              }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-slate-500">
                            {pct}%
                          </span>
                        </div>
                        <Link
                          to={`/courses/${course.parcours_id}/learn`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-brand"
                        >
                          <PlayCircle className="h-3.5 w-3.5" /> Continuer
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {summary?.derniere_activite ? (
            <div className={`flex flex-wrap items-center justify-between gap-3 ${CARD} !py-4`}>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Reprendre
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                  {summary.derniere_activite.lecon_titre || 'Dernière leçon'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>
                  {summary?.lecons_terminees || 0} leçons terminées ·{' '}
                  {formatTime(summary?.temps_total_secondes)} au total
                </span>
                {summary.derniere_activite.parcours_id ? (
                  <Link
                    to={`/courses/${summary.derniere_activite.parcours_id}/learn`}
                    className="shrink-0 font-bold text-brand"
                  >
                    Continuer →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <ActivityChart />
        </div>

        <div className="lg:col-span-2">
          <UpcomingSessionsWidget />
        </div>
      </div>
    </div>
  )
}
