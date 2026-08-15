import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Heart,
  Layers,
  Lock,
  PlayCircle,
  HelpCircle,
  Loader2,
  User,
} from 'lucide-react'
import { getParcours } from '../../api/courses.js'
import { enrollParcours, getParcoursSummary, toggleFavorite } from '../../api/progression.js'
import {
  flattenCurriculum,
  formatDuration,
  normalizeParcours,
  resolveBackendUrl,
} from '../../utils/courseHelpers.js'

const PROFIL_LABELS = {
  EDUCATEUR: 'Éducateur',
  FORCES_ORDRE: "Forces de l'ordre",
  MAGISTRAT: 'Magistrat',
  ASSISTANT_SOCIAL: 'Assistant social',
  AUTRE: 'Autre',
}

const typeIcon = (type) => {
  if (type === 'VIDEO') return PlayCircle
  if (type === 'DOCUMENT') return FileText
  if (type === 'QUIZ') return HelpCircle
  return BookOpen
}

const typeLabel = (type, duree) => {
  const base =
    type === 'VIDEO'
      ? 'Video'
      : type === 'DOCUMENT'
        ? 'Document'
        : type === 'QUIZ'
          ? 'Quiz'
          : 'Leçon'
  const d = formatDuration(duree)
  return d ? `${base} • ${d}` : base
}

export default function CourseOverview() {
  const { parcoursId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [favoriting, setFavoriting] = useState(false)
  const [error, setError] = useState('')
  const [openModules, setOpenModules] = useState({})

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [parcoursData, summaryData] = await Promise.all([
          getParcours(parcoursId),
          getParcoursSummary(parcoursId).catch(() => null),
        ])
        if (cancelled) return
        const normalized = normalizeParcours(parcoursData)
        setCourse(normalized)
        setSummary(summaryData)
        const firstOpen = {}
        normalized.modules.forEach((m, i) => {
          firstOpen[m.id] = i === 0
        })
        setOpenModules(firstOpen)
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Impossible de charger ce parcours.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [parcoursId])

  const isEnrolled = course?.is_enrolled || summary?.is_enrolled || false
  const isFavorite = course?.is_favorite || false
  const curriculum = useMemo(() => flattenCurriculum(course?.modules || []), [course])
  const firstItem = curriculum[0]

  const resumeLeconId = useMemo(() => {
    if (!summary?.modules) return firstItem?.kind === 'LECON' ? firstItem.id : null
    for (const mod of summary.modules) {
      for (const lecon of mod.lecons || []) {
        if (lecon.statut === 'EN_COURS') return lecon.lecon_id
      }
    }
    for (const mod of summary.modules) {
      for (const lecon of mod.lecons || []) {
        if (lecon.statut !== 'TERMINE') return lecon.lecon_id
      }
    }
    return firstItem?.kind === 'LECON' ? firstItem.id : null
  }, [summary, firstItem])

  const handleEnroll = async () => {
    setEnrolling(true)
    setError('')
    try {
      const result = await enrollParcours(parcoursId)
      setCourse((prev) => (prev ? { ...prev, is_enrolled: true } : prev))
      const leconId = result.premiere_lecon_id || resumeLeconId
      if (leconId) {
        navigate(`/courses/${parcoursId}/lessons/${leconId}`)
      } else if (firstItem?.kind === 'QUIZ') {
        navigate(`/courses/${parcoursId}/learn?quiz=${firstItem.id}`)
      } else {
        navigate(`/courses/${parcoursId}/learn`)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.error || "Échec de l'inscription.")
    } finally {
      setEnrolling(false)
    }
  }

  const handleContinue = () => {
    if (resumeLeconId) {
      navigate(`/courses/${parcoursId}/lessons/${resumeLeconId}`)
    } else {
      navigate(`/courses/${parcoursId}/learn`)
    }
  }

  const handleToggleFavorite = async () => {
    setFavoriting(true)
    try {
      const result = await toggleFavorite(parcoursId)
      setCourse((prev) => (prev ? { ...prev, is_favorite: result.is_favorite } : prev))
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de mettre à jour les favoris.')
    } finally {
      setFavoriting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#243491]" />
        Chargement du parcours…
      </div>
    )
  }

  if (error && !course) {
    return (
      <div className="space-y-4">
        <Link to="/browse" className="inline-flex items-center gap-1 text-sm font-semibold text-[#243491]">
          <ArrowLeft className="h-4 w-4" /> Retour au catalogue
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        to="/browse"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#243491]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Catalogue
      </Link>

      {/* Hero présentation */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#243491] to-[#1c2975] text-white shadow-sm">
        {course.image ? (
          <div className="h-44 w-full overflow-hidden">
            <img
              src={resolveBackendUrl(course.image)}
              alt=""
              className="h-full w-full object-cover opacity-90"
            />
          </div>
        ) : null}
        <div className="p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/80">
            <span className="rounded-lg bg-white/15 px-2.5 py-1">
              {PROFIL_LABELS[course.profil_cible] || course.profil_cible}
            </span>
            {isEnrolled && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-emerald-100">
                <CheckCircle2 className="h-3 w-3" /> Inscrit
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{course.titre}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">{course.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-5 text-xs font-medium text-white/75">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {course.publie_par || course.formateur || 'Équipe pédagogique'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> {course.modules.length} modules
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> {curriculum.filter((i) => i.kind === 'LECON').length}{' '}
              leçons
            </span>
            {summary?.pourcentage != null && isEnrolled && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> {summary.pourcentage}% complété
              </span>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isEnrolled ? (
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#243491] transition hover:bg-slate-100"
              >
                Continuer le parcours
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnroll}
                disabled={enrolling}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#243491] transition hover:bg-slate-100 disabled:opacity-60"
              >
                {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                S&apos;inscrire au parcours
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={favoriting}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              {favoriting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-400 text-red-400' : ''}`} />
              )}
              {isFavorite ? 'Favori' : 'Ajouter aux favoris'}
            </button>
          </div>
          {error && <p className="mt-3 text-xs font-semibold text-amber-200">{error}</p>}
        </div>
      </div>

      {/* Objectifs / description */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">À propos de ce parcours</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{course.description}</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#243491]" />
            Maîtriser les notions clés liées à la cyberviolence.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#243491]" />
            Appliquer les bonnes pratiques professionnelles au quotidien.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#243491]" />
            Valider vos acquis via l&apos;évaluation finale et obtenir un certificat.
          </li>
        </ul>
      </section>

      {/* Syllabus verrouillé / déverrouillé */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">Contenu du parcours</h2>
        <p className="mt-1 text-xs text-slate-500">
          {isEnrolled
            ? 'Sélectionnez une leçon pour commencer ou reprendre.'
            : 'Inscrivez-vous pour déverrouiller les leçons et accéder au contenu.'}
        </p>

        <div className="mt-5 space-y-3">
          {course.modules.map((module, moduleIndex) => {
            const isOpen = openModules[module.id]
            const items = [
              ...module.lecons.map((l) => ({
                kind: 'LECON',
                id: l.id,
                titre: l.titre,
                type: l.type,
                duree: l.duree_estimee,
              })),
              ...module.quizzes.map((q) => ({
                kind: 'QUIZ',
                id: q.id,
                titre: q.titre,
                type: 'QUIZ',
                duree: q.duree_minutes,
                deja_reussi: Boolean(q.deja_reussi),
              })),
            ]

            return (
              <div key={module.id} className="overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    setOpenModules((prev) => ({ ...prev, [module.id]: !prev[module.id] }))
                  }
                  className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Module {moduleIndex + 1}
                    </p>
                    <p className="text-sm font-bold text-slate-900">{module.titre}</p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpen && (
                  <ul className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const Icon = typeIcon(item.type)
                      const locked = !isEnrolled
                      const quizDone = item.kind === 'QUIZ' && item.deja_reussi
                      return (
                        <li key={`${item.kind}-${item.id}`}>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => {
                              if (locked) return
                              if (item.kind === 'LECON') {
                                navigate(`/courses/${parcoursId}/lessons/${item.id}`)
                              } else {
                                navigate(`/courses/${parcoursId}/learn?quiz=${item.id}`)
                              }
                            }}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${
                              locked
                                ? 'cursor-not-allowed text-slate-400'
                                : 'hover:bg-[#243491]/5 text-slate-700'
                            }`}
                          >
                            {locked ? (
                              <Lock className="h-4 w-4 shrink-0 text-slate-300" />
                            ) : quizDone ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : item.kind === 'QUIZ' ? (
                              <HelpCircle className="h-4 w-4 shrink-0 text-amber-500" />
                            ) : (
                              <Icon className="h-4 w-4 shrink-0 text-[#243491]" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{item.titre}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="h-3 w-3" />
                                {typeLabel(item.type, item.duree)}
                                {quizDone ? ' · Validé' : ''}
                              </p>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                    {items.length === 0 && (
                      <li className="px-4 py-3 text-xs text-slate-400">Aucun contenu dans ce module.</li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
