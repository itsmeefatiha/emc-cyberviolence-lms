import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuizPanel from './QuizPanel'

vi.mock('../../api/quizzes.js', () => ({
  takeQuiz: vi.fn(),
  submitQuiz: vi.fn(),
  downloadCertificat: vi.fn(),
}))

import { submitQuiz, takeQuiz } from '../../api/quizzes.js'

const quizPayload = {
  titre: 'Évaluation module 1',
  description: 'Vérifiez vos connaissances.',
  duree_minutes: 20,
  note_de_passage: 80,
  max_tentatives: 3,
  tentatives_restantes: 3,
  deja_reussi: false,
  questions: [
    {
      id: 10,
      texte: 'Qu’est-ce que le cyberharcèlement ?',
      type_question: 'QCU',
      points: 1,
      options: [
        { id: 101, texte: 'Une violence en ligne' },
        { id: 102, texte: 'Un virus informatique' },
      ],
    },
  ],
}

describe('QuizPanel', () => {
  beforeEach(() => {
    takeQuiz.mockReset()
    submitQuiz.mockReset()
  })

  it('affiche un chargement puis l’introduction', async () => {
    takeQuiz.mockResolvedValue(quizPayload)
    render(<QuizPanel quizId={42} />)

    expect(screen.getByText(/Chargement de l'évaluation/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Évaluation module 1' })).toBeInTheDocument()
    expect(screen.getByText('Vérifiez vos connaissances.')).toBeInTheDocument()
    expect(screen.getByText('20 minutes')).toBeInTheDocument()
    expect(screen.getByText('1 questions')).toBeInTheDocument()
    expect(screen.getByText('3 / 3 restantes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Commencer le quiz/i })).toBeEnabled()
  })

  it('affiche l’état déjà validé', async () => {
    takeQuiz.mockResolvedValue({
      ...quizPayload,
      deja_reussi: true,
      meilleur_score: 92,
    })

    render(<QuizPanel quizId={42} />)

    expect(await screen.findByText('Quiz validé')).toBeInTheDocument()
    expect(screen.getByText(/Score : 92%/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Commencer le quiz/i })).not.toBeInTheDocument()
  })

  it('désactive le démarrage si les tentatives sont épuisées', async () => {
    takeQuiz.mockResolvedValue({
      ...quizPayload,
      tentatives_restantes: 0,
    })

    render(<QuizPanel quizId={42} />)

    expect(await screen.findByText(/Quota atteint/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Commencer le quiz/i })).toBeDisabled()
  })

  it('permet de répondre et d’envoyer les réponses', async () => {
    const user = userEvent.setup()
    const onPassed = vi.fn()
    takeQuiz.mockResolvedValue(quizPayload)
    submitQuiz.mockResolvedValue({
      tentative: { est_reussi: true, score_obtenu: 100 },
      certificat: null,
    })

    render(<QuizPanel quizId={42} onPassed={onPassed} />)

    await user.click(await screen.findByRole('button', { name: /Commencer le quiz/i }))

    expect(screen.getByText(/Qu’est-ce que le cyberharcèlement/)).toBeInTheDocument()
    expect(screen.getByText(/Choix unique/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Une violence en ligne/i }))
    await user.click(screen.getByRole('button', { name: /Soumettre mes réponses/i }))

    await waitFor(() => {
      expect(submitQuiz).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          answers: [{ question_id: 10, option_ids: [101] }],
        }),
      )
    })
    expect(await screen.findByText('Quiz validé')).toBeInTheDocument()
    expect(onPassed).toHaveBeenCalled()
  })

  it('affiche le résultat en cas d’échec puis permet de revenir à l’intro', async () => {
    const user = userEvent.setup()
    takeQuiz.mockResolvedValue(quizPayload)
    submitQuiz.mockResolvedValue({
      tentative: { est_reussi: false, score_obtenu: 40 },
    })

    render(<QuizPanel quizId={42} />)
    await user.click(await screen.findByRole('button', { name: /Commencer le quiz/i }))
    await user.click(screen.getByRole('button', { name: /Soumettre mes réponses/i }))

    expect(await screen.findByText('Pas encore validé')).toBeInTheDocument()
    expect(screen.getByText(/Score obtenu :/)).toHaveTextContent('40%')

    await user.click(screen.getByRole('button', { name: /Retour à l'intro/i }))
    expect(await screen.findByRole('button', { name: /Commencer le quiz/i })).toBeInTheDocument()
  })

  it('affiche une erreur si le quiz ne peut pas être chargé', async () => {
    takeQuiz.mockRejectedValue({
      response: { data: { detail: 'Quiz introuvable.' } },
    })

    render(<QuizPanel quizId={42} />)
    expect(await screen.findByText('Quiz introuvable.')).toBeInTheDocument()
  })
})
