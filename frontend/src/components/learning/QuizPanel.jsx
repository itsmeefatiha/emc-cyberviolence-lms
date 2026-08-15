import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Award,
  CheckCircle2,
  Circle,
  Clock,
  HelpCircle,
  Loader2,
  Play,
  Send,
  Timer,
} from 'lucide-react'
import { takeQuiz, submitQuiz, downloadCertificat } from '../../api/quizzes.js'
import { resolveBackendUrl } from '../../utils/courseHelpers.js'

const formatCountdown = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

const formatNextAttempt = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Quiz apprenant : validé | intro | chronomètre | résultat.
 */
export default function QuizPanel({ quizId, onPassed }) {
  const [phase, setPhase] = useState('loading') // loading | validated | intro | taking | result
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const autoSubmitRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setPhase('loading')
      setError('')
      setResult(null)
      setAnswers({})
      setStartedAt(null)
      autoSubmitRef.current = false
      try {
        const data = await takeQuiz(quizId)
        if (cancelled) return
        setQuiz(data)
        if (data.deja_reussi) {
          setPhase('validated')
        } else {
          setPhase('intro')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Impossible de charger le quiz.')
          setPhase('intro')
        }
      }
    }
    if (quizId) load()
    return () => {
      cancelled = true
    }
  }, [quizId])

  const questions = useMemo(() => quiz?.questions || [], [quiz])
  const durationSeconds = Math.max(60, (quiz?.duree_minutes || 30) * 60)
  const tentativesRestantes = quiz?.tentatives_restantes ?? quiz?.max_tentatives ?? 3
  const blockedUntil = quiz?.prochaine_tentative_at

  useEffect(() => {
    if (phase !== 'taking' || !startedAt) return undefined

    setRemaining(durationSeconds)
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const left = durationSeconds - elapsed
      setRemaining(left)
      if (left <= 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true
        clearInterval(tick)
        handleSubmit(true)
      }
    }, 1000)

    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, startedAt, durationSeconds])

  const startQuiz = () => {
    if (tentativesRestantes <= 0) {
      setError(
        blockedUntil
          ? `Tentatives épuisées. Recharge le ${formatNextAttempt(blockedUntil)}.`
          : 'Tentatives épuisées pour les prochaines 24 heures.'
      )
      return
    }
    setPhase('taking')
    setStartedAt(Date.now())
    setRemaining(durationSeconds)
    setError('')
  }

  const toggleOption = (question, optionId) => {
    setAnswers((prev) => {
      const current = prev[question.id] || []
      if (question.type_question === 'QCU') {
        return { ...prev, [question.id]: [optionId] }
      }
      const exists = current.includes(optionId)
      return {
        ...prev,
        [question.id]: exists ? current.filter((id) => id !== optionId) : [...current, optionId],
      }
    })
  }

  const handleSubmit = async (fromTimer = false) => {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        answers: questions.map((q) => ({
          question_id: q.id,
          option_ids: answers[q.id] || [],
        })),
        temps_reponse_secondes: startedAt
          ? Math.max(1, Math.round((Date.now() - startedAt) / 1000))
          : 0,
      }
      const data = await submitQuiz(quizId, payload)
      setResult(data)
      const passed = data?.tentative?.est_reussi || data?.score_detail?.est_reussi
      if (passed) {
        setQuiz((prev) =>
          prev
            ? {
                ...prev,
                deja_reussi: true,
                meilleur_score: data?.tentative?.score_obtenu ?? prev.meilleur_score,
              }
            : prev
        )
        setPhase('validated')
        onPassed?.(data)
      } else {
        setPhase('result')
        // Recharger les quotas après échec
        try {
          const refreshed = await takeQuiz(quizId)
          setQuiz(refreshed)
        } catch {
          /* ignore */
        }
      }
      if (fromTimer) {
        setError('Temps écoulé — vos réponses ont été envoyées automatiquement.')
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Échec de la soumission du quiz.')
      if (fromTimer) setPhase('result')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadCert = async () => {
    const certId = result?.certificat?.id
    if (!certId) return
    try {
      const data = await downloadCertificat(certId)
      const url = resolveBackendUrl(data.download_url || data.fichier_pdf)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Impossible de télécharger le certificat.')
    }
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#243491]" />
        Chargement de l&apos;évaluation…
      </div>
    )
  }

  if (error && !quiz) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
    )
  }

  // ----- VALIDATED (quiz déjà réussi) -----
  if (phase === 'validated') {
    const score =
      result?.tentative?.score_obtenu ??
      result?.score_detail?.score_obtenu ??
      quiz?.meilleur_score
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Quiz validé</h2>
          <p className="mt-2 text-sm text-slate-600">
            Vous avez déjà réussi « {quiz?.titre} ». Aucune nouvelle tentative n&apos;est nécessaire.
          </p>
          {score != null && (
            <p className="mt-4 text-lg font-bold text-emerald-700">
              Score : {score}%
              <span className="ml-2 text-xs font-semibold text-emerald-600/80">
                (passage ≥ {quiz?.note_de_passage ?? 80}%)
              </span>
            </p>
          )}
          {result?.certificat && (
            <button
              type="button"
              onClick={handleDownloadCert}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#243491] px-5 py-3 text-sm font-bold text-white hover:bg-[#1c2975]"
            >
              <Award className="h-4 w-4" />
              Télécharger mon Certificat PDF
            </button>
          )}
          {!result?.certificat && (
            <p className="mt-4 text-xs text-slate-500">
              Validez tous les quiz du parcours pour obtenir votre certificat (section Certifications).
            </p>
          )}
        </div>
      </div>
    )
  }

  const passed = result?.tentative?.est_reussi || result?.score_detail?.est_reussi
  const score = result?.tentative?.score_obtenu ?? result?.score_detail?.score_obtenu
  const urgent = remaining <= 60

  // ----- INTRO -----
  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <HelpCircle className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">{quiz?.titre || 'Évaluation'}</h2>
          {quiz?.description && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{quiz.description}</p>
          )}

          <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Durée</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <Clock className="h-4 w-4 text-[#243491]" />
                {quiz?.duree_minutes ?? 30} minutes
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Questions</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{questions.length} questions</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Note de passage
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">{quiz?.note_de_passage ?? 80}%</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Tentatives (24 h)
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {tentativesRestantes} / {quiz?.max_tentatives ?? 3} restantes
              </p>
            </div>
          </div>

          {tentativesRestantes <= 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Quota atteint. Nouvelles tentatives disponibles
              {blockedUntil ? ` le ${formatNextAttempt(blockedUntil)}` : ' dans 24 h'}.
            </div>
          )}

          <ul className="mt-6 space-y-2 text-left text-xs text-slate-500">
            <li>• Un chronomètre démarre dès que vous cliquez sur Commencer.</li>
            <li>• Les tentatives se rechargent automatiquement après 24 heures.</li>
            <li>• La réussite de tous les quiz du parcours est requise pour le certificat.</li>
          </ul>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={startQuiz}
            disabled={questions.length === 0 || tentativesRestantes <= 0}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#243491] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#1c2975] disabled:opacity-50 sm:w-auto"
          >
            <Play className="h-4 w-4" />
            Commencer le quiz
          </button>
        </div>
      </div>
    )
  }

  // ----- RESULT (échec) -----
  if (phase === 'result' && result) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <Circle className="h-8 w-8 shrink-0 text-amber-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Pas encore validé</h3>
              <p className="mt-1 text-sm text-slate-700">
                Score obtenu : <strong>{score}%</strong> — Il faut au moins{' '}
                {quiz?.note_de_passage ?? 80}% pour valider.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  setAnswers({})
                  setPhase('intro')
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#243491] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1c2975]"
              >
                Retour à l&apos;intro
              </button>
            </div>
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            {error}
          </div>
        )}
      </div>
    )
  }

  // ----- TAKING -----
  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{quiz?.titre}</h2>
          <p className="text-[11px] font-medium text-slate-400">
            {questions.length} questions · passage ≥ {quiz?.note_de_passage ?? 80}%
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold tabular-nums ${
            urgent ? 'bg-red-50 text-red-600' : 'bg-[#243491]/10 text-[#243491]'
          }`}
        >
          <Timer className={`h-4 w-4 ${urgent ? 'animate-pulse' : ''}`} />
          {formatCountdown(remaining)}
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-bold text-slate-900">
              {index + 1}. {question.texte}
              <span className="ml-2 text-xs font-medium text-slate-400">
                ({question.type_question === 'QCM' ? 'Choix multiple' : 'Choix unique'} ·{' '}
                {question.points} pt)
              </span>
            </p>
            <ul className="mt-3 space-y-2">
              {(question.options || []).map((option) => {
                const selected = (answers[question.id] || []).includes(option.id)
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => toggleOption(question, option.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? 'border-[#243491] bg-[#243491]/10 font-semibold text-[#243491]'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {selected ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                      )}
                      {option.texte}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={submitting || questions.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-[#243491] px-5 py-3 text-sm font-bold text-white hover:bg-[#1c2975] disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Soumettre mes réponses
        </button>
      </div>
    </div>
  )
}
