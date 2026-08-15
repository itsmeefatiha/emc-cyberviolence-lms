import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  createOption,
  createQuestion,
  createQuiz,
  deleteOption,
  deleteQuestion,
  generateQuizAi,
  getQuiz,
  updateOption,
  updateQuestion,
  updateQuiz,
} from '../../api/quizzes.js'

const newLocalId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const emptyOption = () => ({
  _key: newLocalId(),
  id: null,
  texte: '',
  est_correcte: false,
})

const emptyQuestion = (ordre = 1) => ({
  _key: newLocalId(),
  id: null,
  texte: '',
  type_question: 'QCU',
  explication: '',
  points: 1,
  ordre,
  options: [emptyOption(), emptyOption()],
})

const EMPTY_QUIZ = {
  titre: '',
  description: '',
  note_de_passage: 80,
  duree_minutes: 30,
  max_tentatives: 3,
  melange_questions: true,
  questions: [emptyQuestion(1)],
}

/**
 * Éditeur de questionnaire QCM/QCU rattaché à un module.
 */
export default function QuizEditor({
  isOpen,
  moduleId,
  moduleTitre = '',
  quizId = null,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(EMPTY_QUIZ)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [removedQuestionIds, setRemovedQuestionIds] = useState([])
  const [removedOptionIds, setRemovedOptionIds] = useState([])

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    const load = async () => {
      setError('')
      setRemovedQuestionIds([])
      setRemovedOptionIds([])

      if (!quizId) {
        setForm({
          ...EMPTY_QUIZ,
          titre: moduleTitre ? `Évaluation — ${moduleTitre}` : 'Évaluation du module',
          questions: [emptyQuestion(1)],
        })
        return
      }

      setLoading(true)
      try {
        const data = await getQuiz(quizId)
        if (cancelled) return
        setForm({
          titre: data.titre || '',
          description: data.description || '',
          note_de_passage: Number(data.note_de_passage) || 80,
          duree_minutes: data.duree_minutes || 30,
          max_tentatives: data.max_tentatives || 3,
          melange_questions: Boolean(data.melange_questions),
          questions: (data.questions || []).map((q, index) => ({
            _key: q.id || newLocalId(),
            id: q.id,
            texte: q.texte || '',
            type_question: q.type_question || 'QCU',
            explication: q.explication || '',
            points: q.points || 1,
            ordre: q.ordre || index + 1,
            options: (q.options || []).map((opt) => ({
              _key: opt.id || newLocalId(),
              id: opt.id,
              texte: opt.texte || '',
              est_correcte: Boolean(opt.est_correcte),
            })),
          })),
        })
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Impossible de charger le questionnaire.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, quizId, moduleTitre])

  if (!isOpen) return null

  const updateQuestionField = (key, patch) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q._key === key ? { ...q, ...patch } : q)),
    }))
  }

  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, emptyQuestion(prev.questions.length + 1)],
    }))
  }

  const removeQuestion = (question) => {
    if (question.id) {
      setRemovedQuestionIds((prev) => [...prev, question.id])
    }
    setForm((prev) => ({
      ...prev,
      questions: prev.questions
        .filter((q) => q._key !== question._key)
        .map((q, index) => ({ ...q, ordre: index + 1 })),
    }))
  }

  const addOption = (questionKey) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q._key === questionKey ? { ...q, options: [...q.options, emptyOption()] } : q
      ),
    }))
  }

  const removeOption = (questionKey, option) => {
    if (option.id) {
      setRemovedOptionIds((prev) => [...prev, option.id])
    }
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q._key === questionKey
          ? { ...q, options: q.options.filter((o) => o._key !== option._key) }
          : q
      ),
    }))
  }

  const updateOptionField = (questionKey, optionKey, patch) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q._key !== questionKey) return q
        let options = q.options.map((o) => (o._key === optionKey ? { ...o, ...patch } : o))
        // QCU : une seule réponse correcte
        if (patch.est_correcte && q.type_question === 'QCU') {
          options = options.map((o) => ({
            ...o,
            est_correcte: o._key === optionKey,
          }))
        }
        return { ...q, options }
      }),
    }))
  }

  const validate = () => {
    if (!form.titre.trim()) return 'Le titre du questionnaire est requis.'
    if (!form.questions.length) return 'Ajoutez au moins une question.'
    for (const [index, q] of form.questions.entries()) {
      if (!q.texte.trim()) return `La question ${index + 1} est vide.`
      if (q.options.length < 2) return `La question ${index + 1} doit avoir au moins 2 options.`
      if (q.options.some((o) => !o.texte.trim())) {
        return `Toutes les options de la question ${index + 1} doivent être renseignées.`
      }
      const correctCount = q.options.filter((o) => o.est_correcte).length
      if (correctCount === 0) {
        return `Cochez au moins une bonne réponse pour la question ${index + 1}.`
      }
      if (q.type_question === 'QCU' && correctCount > 1) {
        return `La question ${index + 1} (QCU) ne peut avoir qu'une seule bonne réponse.`
      }
    }
    return ''
  }

  const syncOptions = async (questionId, localOptions) => {
    for (const option of localOptions) {
      const payload = {
        question: questionId,
        texte: option.texte.trim(),
        est_correcte: Boolean(option.est_correcte),
      }
      if (option.id) {
        await updateOption(option.id, payload)
      } else {
        await createOption(payload)
      }
    }
  }

  const handleGenerateAi = async () => {
    setGenerating(true)
    setError('')
    try {
      const generated = await generateQuizAi({
        module_id: moduleId,
        module_titre: moduleTitre,
        nombre_questions: 5,
      })
      const questions = (generated.questions || generated || []).map((q, index) => ({
        _key: newLocalId(),
        id: null,
        texte: q.texte || q.question || '',
        type_question: q.type_question || (q.type === 'multiple' ? 'QCM' : 'QCU'),
        explication: q.explication || '',
        points: q.points || 1,
        ordre: index + 1,
        options: (q.options || []).map((opt) => ({
          _key: newLocalId(),
          id: null,
          texte: typeof opt === 'string' ? opt : opt.texte || '',
          est_correcte: Boolean(typeof opt === 'object' && opt.est_correcte),
        })),
      }))
      if (!questions.length) {
        setError("L'IA n'a renvoyé aucune question.")
        return
      }
      setForm((prev) => ({
        ...prev,
        titre: generated.titre || prev.titre,
        description: generated.description || prev.description,
        questions,
      }))
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Génération IA indisponible. Vérifiez la clé API Gemini côté serveur."
      )
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      const quizPayload = {
        module: moduleId,
        titre: form.titre.trim(),
        description: form.description.trim(),
        note_de_passage: Number(form.note_de_passage),
        duree_minutes: Number(form.duree_minutes),
        max_tentatives: Number(form.max_tentatives),
        melange_questions: Boolean(form.melange_questions),
      }

      if (!moduleId) {
        setError("Module introuvable : impossible d'attacher le questionnaire.")
        setSaving(false)
        return
      }

      let savedQuiz
      if (quizId) {
        savedQuiz = await updateQuiz(quizId, quizPayload)

        for (const optionId of removedOptionIds) {
          try {
            await deleteOption(optionId)
          } catch {
            /* déjà supprimé via question */
          }
        }
        for (const questionId of removedQuestionIds) {
          await deleteQuestion(questionId)
        }

        for (const [index, question] of form.questions.entries()) {
          const qPayload = {
            quiz: savedQuiz.id,
            texte: question.texte.trim(),
            type_question: question.type_question,
            explication: question.explication || '',
            points: Number(question.points) || 1,
            ordre: index + 1,
          }
          let questionId = question.id
          if (questionId) {
            await updateQuestion(questionId, qPayload)
          } else {
            const createdQ = await createQuestion(qPayload)
            questionId = createdQ.id
          }
          await syncOptions(questionId, question.options)
        }
      } else {
        savedQuiz = await createQuiz(quizPayload)
        for (const [index, question] of form.questions.entries()) {
          const createdQ = await createQuestion({
            quiz: savedQuiz.id,
            texte: question.texte.trim(),
            type_question: question.type_question,
            explication: question.explication || '',
            points: Number(question.points) || 1,
            ordre: index + 1,
          })
          await syncOptions(createdQ.id, question.options)
        }
      }

      const detail = await getQuiz(savedQuiz.id)
      onSaved?.(detail)
      onClose?.()
    } catch (err) {
      const data = err?.response?.data
      const detail =
        (typeof data?.detail === 'string' && data.detail) ||
        (Array.isArray(data?.detail) && data.detail[0]) ||
        data?.module?.[0] ||
        data?.titre?.[0] ||
        data?.non_field_errors?.[0] ||
        (data && typeof data === 'object'
          ? Object.entries(data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
              .join(' · ')
          : null) ||
        "Échec de l'enregistrement du questionnaire."
      setError(detail)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {quizId ? 'Modifier le questionnaire' : 'Nouveau questionnaire'}
              </h2>
              <p className="text-[11px] font-medium text-slate-400">
                Évaluation de fin de module · {moduleTitre || 'Module'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#243491]" />
            Chargement…
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Titre <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={form.titre}
                    onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium outline-none focus:border-[#243491] focus:bg-white"
                    placeholder="Ex: Évaluation Finale — Module 1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium outline-none focus:border-[#243491] focus:bg-white"
                    placeholder="Consignes pour l'apprenant…"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Note de passage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.note_de_passage}
                    onChange={(e) => setForm((p) => ({ ...p, note_de_passage: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium outline-none focus:border-[#243491] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Durée (min)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.duree_minutes}
                    onChange={(e) => setForm((p) => ({ ...p, duree_minutes: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium outline-none focus:border-[#243491] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Tentatives max</label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_tentatives}
                    onChange={(e) => setForm((p) => ({ ...p, max_tentatives: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium outline-none focus:border-[#243491] focus:bg-white"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.melange_questions}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, melange_questions: e.target.checked }))
                      }
                      className="accent-[#243491]"
                    />
                    Mélanger les questions
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Questions ({form.questions.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    disabled={generating}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                  >
                    {generating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Générer avec l&apos;IA
                  </button>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#243491] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1c2975]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Question
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {form.questions.map((question, qIndex) => (
                  <div
                    key={question._key}
                    className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-bold text-slate-500">Question {qIndex + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeQuestion(question)}
                        disabled={form.questions.length <= 1}
                        className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      required
                      value={question.texte}
                      onChange={(e) =>
                        updateQuestionField(question._key, { texte: e.target.value })
                      }
                      placeholder="Énoncé de la question…"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[#243491]"
                    />

                    <div className="mt-3 flex flex-wrap gap-3">
                      <select
                        value={question.type_question}
                        onChange={(e) =>
                          updateQuestionField(question._key, {
                            type_question: e.target.value,
                            // reset to single correct if switching to QCU
                            ...(e.target.value === 'QCU'
                              ? {
                                  options: question.options.map((o, i) => ({
                                    ...o,
                                    est_correcte:
                                      i === question.options.findIndex((x) => x.est_correcte)
                                        ? true
                                        : false,
                                  })),
                                }
                              : {}),
                          })
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:border-[#243491]"
                      >
                        <option value="QCU">QCU — Choix unique</option>
                        <option value="QCM">QCM — Choix multiple</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        Points
                        <input
                          type="number"
                          min="1"
                          value={question.points}
                          onChange={(e) =>
                            updateQuestionField(question._key, { points: e.target.value })
                          }
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-[#243491]"
                        />
                      </label>
                    </div>

                    <div className="mt-3 space-y-2">
                      {question.options.map((option, oIndex) => (
                        <div key={option._key} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateOptionField(question._key, option._key, {
                                est_correcte: !option.est_correcte,
                              })
                            }
                            className={`shrink-0 ${
                              option.est_correcte ? 'text-emerald-600' : 'text-slate-300'
                            }`}
                            title="Bonne réponse"
                          >
                            {option.est_correcte ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </button>
                          <input
                            required
                            value={option.texte}
                            onChange={(e) =>
                              updateOptionField(question._key, option._key, {
                                texte: e.target.value,
                              })
                            }
                            placeholder={`Option ${oIndex + 1}`}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[#243491]"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(question._key, option)}
                            disabled={question.options.length <= 2}
                            className="rounded-lg p-1 text-slate-300 hover:text-red-500 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(question._key)}
                        className="text-[11px] font-bold text-[#243491] hover:underline"
                      >
                        + Ajouter une option
                      </button>
                    </div>

                    <input
                      value={question.explication}
                      onChange={(e) =>
                        updateQuestionField(question._key, { explication: e.target.value })
                      }
                      placeholder="Explication (affichée après correction, optionnel)"
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[#243491]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#243491] px-5 py-2 text-xs font-bold text-white hover:bg-[#1c2975] disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {quizId ? 'Mettre à jour le quiz' : 'Enregistrer le quiz'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
