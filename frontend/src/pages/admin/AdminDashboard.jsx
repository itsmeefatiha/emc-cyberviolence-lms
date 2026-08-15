import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Users,
  Award,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getFacilitatorDashboard } from '../../api/progression.js'
import { listParcours } from '../../api/courses.js'
import client from '../../api/client.js'
import { getHomePath } from '../../utils/navigation.js'

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
)

const PROFIL_LABELS = {
  EDUCATEUR: 'Éducateur',
  FORCES_ORDRE: "Forces de l'ordre",
  MAGISTRAT: 'Magistrat',
  ASSISTANT_SOCIAL: 'Assistant social',
  AUTRE: 'Autre',
}

const BRAND = '#243491'
const COLORS = [BRAND, '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#94A3B8']

const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes} min`
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: 'bg-[#243491]/10 text-[#243491]',
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone] || tones.brand}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-xl font-extrabold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const role = user?.role || 'APPRENANT'
  const [data, setData] = useState(null)
  const [parcoursList, setParcoursList] = useState([])
  const [userCounts, setUserCounts] = useState({ total: 0, apprenants: 0, formateurs: 0, admins: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dashboard, parcours, usersRes] = await Promise.all([
        getFacilitatorDashboard(),
        listParcours().catch(() => []),
        client.get('/auth/users/').catch(() => ({ data: [] })),
      ])
      setData(dashboard)
      const list = Array.isArray(parcours) ? parcours : parcours?.results || []
      setParcoursList(list)

      const users = Array.isArray(usersRes.data)
        ? usersRes.data
        : usersRes.data?.results || []
      setUserCounts({
        total: users.length,
        apprenants: users.filter((u) => u.role === 'APPRENANT').length,
        formateurs: users.filter((u) => u.role === 'FORMATEUR').length,
        admins: users.filter((u) => u.role === 'ADMIN').length,
      })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger les statistiques.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role !== 'ADMIN') return
    load()
  }, [load, role])

  const statutChart = useMemo(() => {
    const counts = { BROUILLON: 0, PUBLIE: 0, ARCHIVE: 0 }
    parcoursList.forEach((p) => {
      if (counts[p.statut] !== undefined) counts[p.statut] += 1
      else counts.BROUILLON += 1
    })
    return {
      labels: ['Brouillon', 'Publié', 'Archivé'],
      datasets: [
        {
          data: [counts.BROUILLON, counts.PUBLIE, counts.ARCHIVE],
          backgroundColor: ['#F59E0B', '#10B981', '#94A3B8'],
          borderWidth: 0,
        },
      ],
    }
  }, [parcoursList])

  const profilChart = useMemo(() => {
    const rows = data?.par_profils || []
    return {
      labels: rows.map(
        (r) => PROFIL_LABELS[r.apprenant__profil_professionnel] || r.apprenant__profil_professionnel || 'N/A'
      ),
      datasets: [
        {
          label: 'Progressions',
          data: rows.map((r) => r.total || 0),
          backgroundColor: COLORS,
          borderRadius: 8,
        },
      ],
    }
  }, [data])

  const parcoursChart = useMemo(() => {
    const rows = (data?.parcours || []).slice(0, 8)
    return {
      labels: rows.map((r) =>
        r.parcours_titre?.length > 22 ? `${r.parcours_titre.slice(0, 22)}…` : r.parcours_titre
      ),
      datasets: [
        {
          label: 'Progression moyenne (%)',
          data: rows.map((r) => Math.round(r.pourcentage_moyen || 0)),
          borderColor: BRAND,
          backgroundColor: 'rgba(36, 52, 145, 0.15)',
          fill: true,
          tension: 0.35,
        },
        {
          label: 'Apprenants actifs',
          data: rows.map((r) => r.apprenants_actifs || 0),
          borderColor: '#0EA5E9',
          backgroundColor: 'rgba(14, 165, 233, 0.12)',
          fill: true,
          tension: 0.35,
        },
      ],
    }
  }, [data])

  const rolesChart = useMemo(
    () => ({
      labels: ['Apprenants', 'Formateurs', 'Admins'],
      datasets: [
        {
          data: [userCounts.apprenants, userCounts.formateurs, userCounts.admins],
          backgroundColor: [BRAND, '#0EA5E9', '#F59E0B'],
          borderWidth: 0,
        },
      ],
    }),
    [userCounts]
  )

  if (role !== 'ADMIN') {
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
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <AlertCircle className="mr-2 inline h-4 w-4" />
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Dashboard administrateur
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Vue d’ensemble des statistiques de la plateforme EMC E-Formation.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          Actualiser
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Utilisateurs" value={userCounts.total} tone="brand" />
        <StatCard icon={BookOpen} label="Parcours" value={parcoursList.length} tone="sky" />
        <StatCard
          icon={GraduationCap}
          label="Apprenants actifs"
          value={data?.total_apprenants || 0}
          tone="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Taux de réussite"
          value={`${Math.round(data?.taux_reussite_modules || 0)}%`}
          tone="brand"
        />
      </div>


      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-bold text-slate-900">
            Progression par parcours
          </h2>
          <div className="h-72">
            {(data?.parcours || []).length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">Aucune donnée de parcours.</p>
            ) : (
              <Line
                data={parcoursChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                  scales: {
                    y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-slate-900">Statut des parcours</h2>
          <div className="mx-auto h-64 max-w-[240px]">
            <Doughnut
              data={statutChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                cutout: '62%',
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-bold text-slate-900">
            Activité par profil professionnel
          </h2>
          <div className="h-72">
            {(data?.par_profils || []).length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">Aucune activité enregistrée.</p>
            ) : (
              <Bar
                data={profilChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-slate-900">Répartition des rôles</h2>
          <div className="mx-auto h-64 max-w-[240px]">
            <Doughnut
              data={rolesChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                cutout: '58%',
              }}
            />
          </div>
          <div className="mt-4 space-y-2 text-xs font-semibold text-slate-600">
            <div className="flex justify-between">
              <span>Apprenants</span>
              <span>{userCounts.apprenants}</span>
            </div>
            <div className="flex justify-between">
              <span>Formateurs</span>
              <span>{userCounts.formateurs}</span>
            </div>
            <div className="flex justify-between">
              <span>Admins</span>
              <span>{userCounts.admins}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Parcours les plus actifs</h2>
          <Link to="/admin/courses" className="text-xs font-bold text-[#243491] hover:underline">
            Modérer les parcours
          </Link>
        </div>
        {(data?.parcours || []).length === 0 ? (
          <p className="text-sm text-slate-500">Aucun parcours avec activité.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Parcours</th>
                  <th className="px-3 py-2">Apprenants</th>
                  <th className="px-3 py-2">Inscriptions</th>
                  <th className="px-3 py-2">Progression</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.parcours || []).map((item) => (
                  <tr key={item.parcours_id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-semibold text-slate-800">
                      {item.parcours_titre}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{item.apprenants_actifs}</td>
                    <td className="px-3 py-2.5 text-slate-600">{item.inscriptions || 0}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-[#243491]"
                            style={{ width: `${Math.round(item.pourcentage_moyen || 0)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                          {Math.round(item.pourcentage_moyen || 0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
