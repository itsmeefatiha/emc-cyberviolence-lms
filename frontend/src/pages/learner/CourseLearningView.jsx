import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  HelpCircle,
  Loader2,
  PlayCircle,
  X,
} from 'lucide-react'
import { getParcours } from '../../api/courses.js'
import { getParcoursSummary, trackLecon } from '../../api/progression.js'
import VideoPlayer from '../../components/learning/VideoPlayer.jsx'
import QuizPanel from '../../components/learning/QuizPanel.jsx'
import DocumentViewer from '../../components/learning/DocumentViewer.jsx'
import {
  flattenCurriculum,
  formatDuration,
  normalizeParcours,
  resolveBackendUrl,
} from '../../utils/courseHelpers.js'

const typeIcon = (type) => {
  if (type === 'VIDEO') return PlayCircle
  if (type === 'DOCUMENT') return FileText
  if (type === 'TEXTE') return FileText
  if (type === 'QUIZ') return HelpCircle
  return FileText
}

const typeMeta = (type, duree) => {
  const label =
    type === 'VIDEO'
      ? 'Vidéo'
      : type === 'DOCUMENT'
        ? 'Document'
        : type === 'TEXTE'
          ? 'Texte'
          : type === 'QUIZ'
            ? 'Quiz'
            : 'Leçon'
  const d = formatDuration(duree)
  return d ? `${label} • ${d}` : label
}

function StatusDot({ statut }) {
  if (statut === 'TERMINE') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
  }
  if (statut === 'EN_COURS') {
    return <span className="h-3 w-3 shrink-0 rounded-full border-2 border-[#243491] bg-[#243491]/30" />
  }
  return <Circle className="h-4 w-4 shrink-0 text-slate-300" />
}

export default function CourseLearningView() {
  const { parcoursId, leconId } = useParams()
  const [searchParams] = useSearchParams()
  const quizParam = searchParams.get('quiz')
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [openModules, setOpenModules] = useState({})
  const [completing, setCompleting] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [activeQuizId, setActiveQuizId] = useState(quizParam)

  const refreshSummary = useCallback(async () => {
    try {
      const data = await getParcoursSummary(parcoursId)
      setSummary(data)
      return data
    } catch {
      return null
    }
  }, [parcoursId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const parcoursData = await getParcours(parcoursId)
        if (cancelled) return
        let normalized = normalizeParcours(parcoursData)

        if (!normalized.is_enrolled) {
          navigate(`/courses/${parcoursId}`, { replace: true })
          return
        }

        setCourse(normalized)
        const open = {}
        normalized.modules.forEach((m) => {
          open[m.id] = true
        })
        setOpenModules(open)

        const sum = await refreshSummary()
        if (cancelled) return

        const items = flattenCurriculum(normalized.modules)
        if (!leconId && !quizParam && items.length) {
          const firstLecon = items.find((i) => i.kind === 'LECON')
          const resumeId = (() => {
            if (!sum?.modules) return firstLecon?.id
            for (const mod of sum.modules) {
              for (const l of mod.lecons || []) {
                if (l.statut === 'EN_COURS') return l.lecon_id
              }
            }
            for (const mod of sum.modules) {
              for (const l of mod.lecons || []) {
                if (l.statut !== 'TERMINE') return l.lecon_id
              }
            }
            return firstLecon?.id
          })()
          if (resumeId) {
            navigate(`/courses/${parcoursId}/lessons/${resumeId}`, { replace: true })
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Impossible de charger le parcours.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [parcoursId, navigate, refreshSummary, leconId, quizParam])

  useEffect(() => {
    setActiveQuizId(quizParam)
  }, [quizParam])

  const curriculum = useMemo(() => flattenCurriculum(course?.modules || []), [course])

  const statusMap = useMemo(() => {
    const map = {}
    summary?.modules?.forEach((mod) => {
      mod.lecons?.forEach((l) => {
        map[l.lecon_id] = l.statut
      })
    })
    return map
  }, [summary])

  const quizPassedMap = useMemo(() => {
    const map = {}
    summary?.modules?.forEach((mod) => {
      mod.quizzes?.forEach((q) => {
        map[q.quiz_id] = Boolean(q.est_reussi)
      })
    })
    course?.modules?.forEach((mod) => {
      mod.quizzes?.forEach((q) => {
        if (map[q.id] === undefined) {
          map[q.id] = Boolean(q.deja_reussi)
        }
      })
    })
    return map
  }, [summary, course])

  const activeItem = useMemo(() => {
    if (activeQuizId) {
      return curriculum.find((i) => i.kind === 'QUIZ' && i.id === activeQuizId) || null
    }
    if (leconId) {
      return curriculum.find((i) => i.kind === 'LECON' && i.id === leconId) || null
    }
    return curriculum[0] || null
  }, [curriculum, leconId, activeQuizId])

  const activeIndex = useMemo(() => {
    if (!activeItem) return -1
    return curriculum.findIndex(
      (i) => i.kind === activeItem.kind && i.id === activeItem.id
    )
  }, [curriculum, activeItem])

  const nextItem = activeIndex >= 0 ? curriculum[activeIndex + 1] : null

  const goToItem = (item) => {
    if (!item) return
    if (item.kind === 'QUIZ') {
      setActiveQuizId(item.id)
      navigate(`/courses/${parcoursId}/learn?quiz=${item.id}`)
    } else {
      setActiveQuizId(null)
      navigate(`/courses/${parcoursId}/lessons/${item.id}`)
    }
  }

  const markCompleted = async () => {
    if (!activeItem || activeItem.kind !== 'LECON') return
    setCompleting(true)
    try {
      await trackLecon({ lecon_id: activeItem.id, statut: 'TERMINE', temps_passe_ajoute: 0 })
      // Mise à jour locale immédiate pour persister l'état dans la sidebar
      setSummary((prev) => {
        if (!prev?.modules) return prev
        return {
          ...prev,
          modules: prev.modules.map((mod) => ({
            ...mod,
            lecons: (mod.lecons || []).map((l) =>
              l.lecon_id === activeItem.id ? { ...l, statut: 'TERMINE' } : l
            ),
          })),
        }
      })
      await refreshSummary()
    } catch {
      setError('Impossible de marquer la leçon comme terminée.')
    } finally {
      setCompleting(false)
    }
  }

  const handleVideoProgress = async (secondsAdded) => {
    if (!activeItem || activeItem.kind !== 'LECON') return
    const alreadyDone = statusMap[activeItem.id] === 'TERMINE'
    try {
      await trackLecon({
        lecon_id: activeItem.id,
        temps_passe_ajoute: secondsAdded,
        ...(alreadyDone ? {} : { statut: 'EN_COURS' }),
      })
    } catch {
      /* silent ping failure */
    }
  }

  const handleVideoNearComplete = async () => {
    if (!activeItem || activeItem.kind !== 'LECON') return
    if (statusMap[activeItem.id] === 'TERMINE') return
    try {
      await trackLecon({ lecon_id: activeItem.id, statut: 'TERMINE', temps_passe_ajoute: 0 })
      setSummary((prev) => {
        if (!prev?.modules) return prev
        return {
          ...prev,
          modules: prev.modules.map((mod) => ({
            ...mod,
            lecons: (mod.lecons || []).map((l) =>
              l.lecon_id === activeItem.id ? { ...l, statut: 'TERMINE' } : l
            ),
          })),
        }
      })
      await refreshSummary()
    } catch {
      /* ignore */
    }
  }

  const currentLessonStatut =
    activeItem?.kind === 'LECON' ? statusMap[activeItem.id] || 'NON_COMMENCE' : null

  useEffect(() => {
    if (!activeItem || activeItem.kind !== 'LECON') return
    // Ne pas rétrograder une leçon déjà terminée
    if (currentLessonStatut === 'TERMINE') return
    trackLecon({ lecon_id: activeItem.id, statut: 'EN_COURS', temps_passe_ajoute: 0 }).catch(
      () => {}
    )
  }, [activeItem, activeItem?.id, activeItem?.kind, currentLessonStatut])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#243491]" />
        Ouverture de l&apos;espace d&apos;apprentissage…
      </div>
    )
  }

  if (error && !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/browse" className="text-sm font-bold text-[#243491]">
          Retour au catalogue
        </Link>
      </div>
    )
  }

  const lecon = activeItem?.kind === 'LECON' ? activeItem.lecon : null
  const contenu = lecon?.contenu
  const videoSrc =
    contenu?.type === 'VIDEO' ? resolveBackendUrl(contenu.url_stream) : ''
  const documentSrc =
    contenu?.type === 'DOCUMENT' ? resolveBackendUrl(contenu.fichier) : ''
  const scormSrc =
    contenu?.type === 'SCORM' ? resolveBackendUrl(contenu.launch_path_url) : ''
  const isCompleted = lecon ? statusMap[lecon.id] === 'TERMINE' : false

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar curriculum */}
      <aside
        className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-0'
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parcours</p>
            <h1 className="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900">{course?.titre}</h1>
            {summary?.pourcentage != null && (
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#243491] transition-all"
                    style={{ width: `${summary.pourcentage}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                  {summary.pourcentage}% complété
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/courses/${parcoursId}`)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {course?.modules.map((module, moduleIndex) => {
            const isOpen = openModules[module.id] !== false
            const moduleItems = curriculum.filter((i) => i.moduleId === module.id)

            return (
              <div key={module.id} className="border-b border-slate-100">
                <button
                  type="button"
                  onClick={() =>
                    setOpenModules((prev) => ({ ...prev, [module.id]: !isOpen }))
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Module {moduleIndex + 1}
                    </p>
                    <p className="text-xs font-bold text-slate-800">{module.titre}</p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpen && (
                  <ul>
                    {moduleItems.map((item) => {
                      const Icon = typeIcon(item.type)
                      const isActive =
                        activeItem &&
                        activeItem.kind === item.kind &&
                        activeItem.id === item.id
                      const statut =
                        item.kind === 'LECON' ? statusMap[item.id] || 'NON_COMMENCE' : null

                      return (
                        <li key={`${item.kind}-${item.id}`}>
                          <button
                            type="button"
                            onClick={() => goToItem(item)}
                            className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${
                              isActive
                                ? 'bg-[#243491]/10 font-bold text-[#243491]'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {item.kind === 'LECON' ? (
                              <StatusDot statut={statut} />
                            ) : quizPassedMap[item.id] || item.deja_reussi ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs leading-snug">{item.titre}</p>
                              <p
                                className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium ${
                                  isActive ? 'text-[#243491]/70' : 'text-slate-400'
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                                {typeMeta(item.type, item.duree_estimee)}
                              </p>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Menu
            </button>
          )}
          {sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              Masquer
            </button>
          )}
          <p className="truncate text-xs font-medium text-slate-500">
            {activeItem?.moduleTitre} · {activeItem?.titre}
          </p>
        </header>

        <main className="flex-1 overflow-y-auto">
          {activeItem?.kind === 'QUIZ' ? (
            <div className="mx-auto max-w-3xl p-6">
              <QuizPanel
                quizId={activeItem.id}
                onPassed={async () => {
                  await refreshSummary()
                  setCourse((prev) => {
                    if (!prev) return prev
                    return {
                      ...prev,
                      modules: prev.modules.map((mod) => ({
                        ...mod,
                        quizzes: (mod.quizzes || []).map((q) =>
                          String(q.id) === String(activeItem.id)
                            ? { ...q, deja_reussi: true }
                            : q
                        ),
                      })),
                    }
                  })
                }}
              />
              {nextItem && (
                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToItem(nextItem)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#243491] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1c2975]"
                  >
                    Élément suivant
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Video / Document / SCORM */}
              {contenu?.type === 'VIDEO' && (
                <VideoPlayer
                  src={videoSrc}
                  autoPlay
                  onProgress={handleVideoProgress}
                  onNearComplete={handleVideoNearComplete}
                  onEnded={handleVideoNearComplete}
                />
              )}

              {contenu?.type === 'DOCUMENT' && (
                <DocumentViewer
                  src={documentSrc}
                  title={contenu.titre_fichier || activeItem?.titre || 'Document'}
                  format={contenu.format || 'PDF'}
                />
              )}

              {contenu?.type === 'SCORM' && (
                <div className="bg-slate-900 p-2">
                  <iframe
                    title={contenu.titre_fichier || 'SCORM'}
                    src={scormSrc}
                    className="h-[70vh] w-full rounded-lg bg-white"
                  />
                </div>
              )}

              {contenu?.type === 'TEXTE' && (
                <div className="border-b border-slate-200 bg-white px-6 py-8">
                  <div className="mx-auto max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {contenu.corps || 'Aucun texte pour cette leçon.'}
                  </div>
                </div>
              )}

              {!contenu && (
                <div className="flex aspect-video items-center justify-center bg-slate-800 text-sm text-slate-400">
                  Aucun contenu multimédia pour cette leçon.
                </div>
              )}

              {/* Lesson header */}
              <div className="mx-auto max-w-4xl px-6 py-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{activeItem?.titre}</h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {typeMeta(activeItem?.type, activeItem?.duree_estimee)} · {activeItem?.moduleTitre}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoteSaved(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Bookmark className={`h-3.5 w-3.5 ${noteSaved ? 'fill-[#243491] text-[#243491]' : ''}`} />
                    {noteSaved ? 'Note enregistrée' : 'Enregistrer la note'}
                  </button>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {error}
                  </div>
                )}

                {/* Bottom actions */}
                <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
                  <button
                    type="button"
                    onClick={markCompleted}
                    disabled={completing || isCompleted}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                      isCompleted
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    } disabled:opacity-60`}
                  >
                    {completing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {isCompleted ? 'Terminé' : 'Marquer comme terminé'}
                  </button>

                  {nextItem && (
                    <button
                      type="button"
                      onClick={() => goToItem(nextItem)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#243491] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1c2975]"
                    >
                      Élément suivant
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
