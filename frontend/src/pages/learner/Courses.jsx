// src/pages/learner/Courses.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Layers,
  CheckCircle2,
  FileText,
  ChevronRight,
  Heart,
  Loader2,
} from 'lucide-react'
import { listParcours } from '../../api/courses.js'
import { toggleFavorite } from '../../api/progression.js'
import { resolveBackendUrl } from '../../utils/courseHelpers.js'

const PROFIL_LABELS = {
  EDUCATEUR: 'Éducateur',
  FORCES_ORDRE: "Forces de l'ordre",
  MAGISTRAT: 'Magistrat',
  ASSISTANT_SOCIAL: 'Assistant social',
  AUTRE: 'Autre',
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const normalizeCourse = (course) => ({
  id: course.id,
  titre: course.titre,
  description: course.description || 'Aucune description disponible pour ce parcours.',
  profil_cible: course.profil_cible,
  profil_cible_label:
    course.profil_cible_display || PROFIL_LABELS[course.profil_cible] || course.profil_cible,
  statut: course.statut,
  formateur:
    course.publie_par ||
    course.formateur_nom ||
    course.formateur?.get_full_name ||
    course.formateur ||
    'Équipe Pédagogique',
  publie_par: course.publie_par || course.formateur_nom || '',
  formateur_role: course.formateur_role || null,
  image: course.image || null,
  ordre: course.ordre,
  modules_count: course.nombre_modules ?? course.modules_count ?? course.modules?.length ?? 0,
  lecons_count:
    course.nombre_lecons ??
    course.lecons_count ??
    course.modules?.reduce((acc, module) => acc + (module.lecons?.length || 0), 0) ?? 0,
  date_creation: formatDate(course.date_creation),
  is_enrolled: Boolean(course.is_enrolled),
  is_favorite: Boolean(course.is_favorite),
  est_termine: Boolean(course.est_termine),
  modules: course.modules,
})

export default function LearnerCourses() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [favoritingId, setFavoritingId] = useState(null)

  const fetchCourses = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await listParcours()
      const rawList = Array.isArray(data) ? data : []

      const publishedCourses = rawList
        .filter((c) => c.statut === 'PUBLIE' || !c.statut)
        .map(normalizeCourse)

      setCourses(publishedCourses)
    } catch (requestError) {
      console.error('Erreur chargement des parcours:', requestError)
      setError('Impossible de charger les parcours de formation disponibles.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  const handleOpenCourse = (course) => {
    navigate(`/courses/${course.id}`)
  }

  const handleToggleFavorite = async (event, courseId) => {
    event.stopPropagation()
    setFavoritingId(courseId)
    try {
      const result = await toggleFavorite(courseId)
      setCourses((current) =>
        current.map((course) =>
          course.id === courseId ? { ...course, is_favorite: result.is_favorite } : course
        )
      )
    } finally {
      setFavoritingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            Parcours de Formation
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Explorez le catalogue des formations disponibles et accédez à vos contenus pédagogiques.
          </p>
        </div>
      </div>

      {/* 4. MESSAGES DE STATUT / ERREUR */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* 5. LISTE DES CARTES DE FORMATION */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">Aucun parcours trouvé</h3>
          <p className="mt-1 text-xs text-slate-500">
            Modifiez vos filtres de recherche pour consulter d'autres formations.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {courses.map((course) => (
            <div
              key={course.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all hover:border-[#243491]/40 hover:shadow-md"
            >
              <div className="relative h-36 bg-slate-100">
                {course.image ? (
                  <img
                    src={resolveBackendUrl(course.image)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <BookOpen className="h-10 w-10" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(event) => handleToggleFavorite(event, course.id)}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-400 transition hover:text-red-500"
                  title={course.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  {favoritingId === course.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Heart
                      className={`h-3.5 w-3.5 ${course.is_favorite ? 'fill-red-500 text-red-500' : ''}`}
                    />
                  )}
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between gap-2 pb-3">
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-[#243491]">
                    {course.profil_cible_label}
                  </span>
                  {course.est_termine ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Terminé
                    </span>
                  ) : course.is_enrolled ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Inscrit
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                      Disponible
                    </span>
                  )}
                </div>

                <h3
                  onClick={() => handleOpenCourse(course)}
                  className="cursor-pointer text-base font-bold leading-snug text-slate-900 transition-colors hover:text-[#243491]"
                >
                  {course.titre}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                  {course.description}
                </p>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      {course.modules_count} Modules
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      {course.lecons_count} Leçons
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                  <span className="text-xs font-medium text-slate-400">
                    {course.publie_par || (
                      <>
                        Par <span className="font-semibold text-slate-700">{course.formateur}</span>
                      </>
                    )}
                  </span>

                  <button
                    onClick={() => handleOpenCourse(course)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:shadow-sm ${
                      course.est_termine
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-[#243491] hover:bg-[#1c2975]'
                    }`}
                  >
                    <span>
                      {course.est_termine
                        ? 'Terminé'
                        : course.is_enrolled
                          ? 'Continuer'
                          : 'Voir le parcours'}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}