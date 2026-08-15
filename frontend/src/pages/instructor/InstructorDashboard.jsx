import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  Users,
  BarChart3,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getFacilitatorDashboard } from '../../api/progression.js'
import { getHomePath } from '../../utils/navigation.js'

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
    indigo: 'bg-indigo-50 text-indigo-600',
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

export default function InstructorDashboard() {
  const { user } = useAuth()
  const role = user?.role || 'APPRENANT'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (role !== 'FORMATEUR') return undefined
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getFacilitatorDashboard()
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Impossible de charger le tableau de bord.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [role])

  if (role !== 'FORMATEUR') {
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
        {error}
      </div>
    )
  }

  const parcours = data?.parcours || []
  const apprenants = data?.apprenants || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Tableau de bord formateur</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vue d’ensemble de vos parcours et de l’activité des apprenants.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={BookOpen} tone="sky" label="Parcours" value={data?.parcours_count || 0} />
        <MetricCard
          icon={Users}
          tone="emerald"
          label="Apprenants"
          value={data?.total_apprenants || 0}
        />
        <MetricCard
          icon={CheckCircle2}
          tone="amber"
          label="Leçons terminées"
          value={data?.lecons_terminees || 0}
        />
        <MetricCard
          icon={BarChart3}
          tone="indigo"
          label="Taux de réussite"
          value={`${Math.round(data?.taux_reussite_modules || 0)}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-[0_12px_40px_-16px_rgba(36,52,145,0.18)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Parcours</h2>
            <Link to="/instructor/courses" className="text-xs font-bold text-brand">
              Constructeur de parcours
            </Link>
          </div>
          {parcours.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune activité enregistrée pour le moment.</p>
          ) : (
            <ul className="space-y-3">
              {parcours.slice(0, 6).map((item) => (
                <li
                  key={item.parcours_id}
                  className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.parcours_titre}</p>
                    <p className="text-xs text-slate-400">
                      {item.apprenants_actifs} apprenant(s) · {item.inscriptions || 0} inscription(s)
                    </p>
                  </div>
                  <span className="text-sm font-bold text-brand">
                    {Math.round(item.pourcentage_moyen || 0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_12px_40px_-16px_rgba(36,52,145,0.18)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Apprenants récents</h2>
            <Link to="/instructor/analytics" className="text-xs font-bold text-brand">
              Suivi des apprenants
            </Link>
          </div>
          {apprenants.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun apprenant inscrit pour l’instant.</p>
          ) : (
            <ul className="space-y-3">
              {apprenants.slice(0, 6).map((item) => (
                <li
                  key={item.apprenant_id}
                  className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.apprenant_nom}</p>
                    <p className="text-xs text-slate-400">
                      {item.parcours_inscrits} parcours · {formatTime(item.temps_total_secondes)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-700">
                    {Math.round(item.pourcentage || 0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
