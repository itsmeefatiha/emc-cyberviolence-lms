import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Clock,
  Loader2,
  Search,
  Users,
  CheckCircle2,
} from 'lucide-react'
import { getFacilitatorDashboard } from '../../api/progression.js'

const PROFIL_LABELS = {
  EDUCATEUR: 'Éducateur',
  FORCES_ORDRE: "Forces de l'ordre",
  MAGISTRAT: 'Magistrat',
  ASSISTANT_SOCIAL: 'Assistant social',
  AUTRE: 'Autre',
}

const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes} min`
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function InstructorAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [profilFilter, setProfilFilter] = useState('ALL')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const params =
          profilFilter !== 'ALL' ? { profil_professionnel: profilFilter } : {}
        const result = await getFacilitatorDashboard(params)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
              'Impossible de charger les statistiques apprenants.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profilFilter])

  const apprenants = useMemo(() => {
    const list = data?.apprenants || []
    const term = search.trim().toLowerCase()
    if (!term) return list
    return list.filter(
      (item) =>
        item.apprenant_nom?.toLowerCase().includes(term) ||
        item.apprenant_email?.toLowerCase().includes(term)
    )
  }, [data, search])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <AlertCircle className="mr-2 inline h-4 w-4" />
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Suivi des apprenants
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Suivi détaillé des apprenants inscrits à vos parcours.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Apprenants" value={data?.total_apprenants || 0} />
        <Stat icon={BookOpen} label="Inscriptions" value={data?.inscriptions_count || 0} />
        <Stat icon={CheckCircle2} label="Leçons terminées" value={data?.lecons_terminees || 0} />
        <Stat
          icon={Clock}
          label="Temps cumulé"
          value={formatTime(data?.temps_total_secondes)}
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un apprenant..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:bg-white"
            />
          </div>
          <select
            value={profilFilter}
            onChange={(e) => setProfilFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-brand"
          >
            <option value="ALL">Tous les profils</option>
            {Object.entries(PROFIL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Apprenant</th>
                <th className="px-4 py-3">Profil</th>
                <th className="px-4 py-3">Parcours</th>
                <th className="px-4 py-3">Progression</th>
                <th className="px-4 py-3">Temps</th>
                <th className="px-4 py-3">Dernière activité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apprenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Aucun apprenant trouvé.
                  </td>
                </tr>
              ) : (
                apprenants.map((item) => (
                  <tr key={item.apprenant_id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.apprenant_nom}</p>
                      <p className="text-xs text-slate-400">{item.apprenant_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {PROFIL_LABELS[item.profil_professionnel] ||
                        item.profil_professionnel ||
                        '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {item.parcours_inscrits}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-brand"
                            style={{ width: `${Math.round(item.pourcentage || 0)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                          {Math.round(item.pourcentage || 0)}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {item.lecons_terminees}/{item.total_progressions} leçons
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatTime(item.temps_total_secondes)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(item.derniere_activite)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-bold text-slate-900">Parcours</h2>
        </div>
        {(data?.parcours || []).length === 0 ? (
          <p className="text-sm text-slate-500">Aucune statistique de parcours.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.parcours || []).map((item) => (
              <div
                key={item.parcours_id}
                className="rounded-xl border border-slate-100 px-4 py-3"
              >
                <p className="line-clamp-1 text-sm font-bold text-slate-900">
                  {item.parcours_titre}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.apprenants_actifs} actifs · {item.inscriptions || 0} inscrits
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-brand"
                      style={{ width: `${Math.round(item.pourcentage_moyen || 0)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600">
                    {Math.round(item.pourcentage_moyen || 0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-base font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}
