import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuizEditor from './QuizEditor'

vi.mock('../../api/quizzes.js', () => ({
  createOption: vi.fn(),
  createQuestion: vi.fn(),
  createQuiz: vi.fn(),
  deleteOption: vi.fn(),
  deleteQuestion: vi.fn(),
  generateQuizAi: vi.fn(),
  getQuiz: vi.fn(),
  updateOption: vi.fn(),
  updateQuestion: vi.fn(),
  updateQuiz: vi.fn(),
}))

import {
  createOption,
  createQuestion,
  createQuiz,
  generateQuizAi,
  getQuiz,
} from '../../api/quizzes.js'

describe('QuizEditor', () => {
  beforeEach(() => {
    createOption.mockReset()
    createQuestion.mockReset()
    createQuiz.mockReset()
    generateQuizAi.mockReset()
    getQuiz.mockReset()
  })

  it('n’affiche rien lorsque l’éditeur est fermé', () => {
    const { container } = render(
      <QuizEditor isOpen={false} moduleId={1} onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('préremplit un nouveau questionnaire avec le titre du module', () => {
    render(
      <QuizEditor
        isOpen
        moduleId={5}
        moduleTitre="Cyberharcèlement"
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('Nouveau questionnaire')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Évaluation — Cyberharcèlement')).toBeInTheDocument()
    expect(screen.getByText('Questions (1)')).toBeInTheDocument()
    expect(screen.getByText('Question 1')).toBeInTheDocument()
  })

  it('ferme l’éditeur via Annuler', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<QuizEditor isOpen moduleId={5} moduleTitre="Module" onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ajoute une question et une option', async () => {
    const user = userEvent.setup()
    render(<QuizEditor isOpen moduleId={5} moduleTitre="Module" onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /Question/i }))
    expect(screen.getByText('Questions (2)')).toBeInTheDocument()
    expect(screen.getByText('Question 2')).toBeInTheDocument()

    const addOptionButtons = screen.getAllByRole('button', { name: '+ Ajouter une option' })
    await user.click(addOptionButtons[0])
    expect(screen.getByPlaceholderText('Option 3')).toBeInTheDocument()
  })

  it('signale qu’une bonne réponse est obligatoire', async () => {
    const user = userEvent.setup()
    render(<QuizEditor isOpen moduleId={5} moduleTitre="Module" onClose={() => {}} />)

    await user.type(screen.getByPlaceholderText('Énoncé de la question…'), 'Question test')
    await user.type(screen.getByPlaceholderText('Option 1'), 'Oui')
    await user.type(screen.getByPlaceholderText('Option 2'), 'Non')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le quiz' }))

    expect(
      await screen.findByText('Cochez au moins une bonne réponse pour la question 1.'),
    ).toBeInTheDocument()
    expect(createQuiz).not.toHaveBeenCalled()
  })

  it('enregistre un nouveau quiz et notifie le parent', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onClose = vi.fn()
    createQuiz.mockResolvedValue({ id: 9 })
    createQuestion.mockResolvedValue({ id: 21 })
    createOption.mockResolvedValue({ id: 31 })
    getQuiz.mockResolvedValue({ id: 9, titre: 'Évaluation — Module' })

    render(
      <QuizEditor
        isOpen
        moduleId={5}
        moduleTitre="Module"
        onClose={onClose}
        onSaved={onSaved}
      />,
    )

    await user.type(screen.getByPlaceholderText('Énoncé de la question…'), 'Définition')
    await user.type(screen.getByPlaceholderText('Option 1'), 'Bonne réponse')
    await user.type(screen.getByPlaceholderText('Option 2'), 'Mauvaise réponse')
    await user.click(screen.getAllByTitle('Bonne réponse')[0])
    await user.click(screen.getByRole('button', { name: 'Enregistrer le quiz' }))

    await waitFor(() => {
      expect(createQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 5,
          titre: 'Évaluation — Module',
        }),
      )
    })
    expect(createQuestion).toHaveBeenCalled()
    expect(createOption).toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith({ id: 9, titre: 'Évaluation — Module' })
    expect(onClose).toHaveBeenCalled()
  })

  it('charge un quiz existant', async () => {
    getQuiz.mockResolvedValue({
      titre: 'Quiz existant',
      description: 'Consignes',
      note_de_passage: 70,
      duree_minutes: 15,
      max_tentatives: 2,
      melange_questions: false,
      questions: [
        {
          id: 1,
          texte: 'Question déjà saisie',
          type_question: 'QCU',
          points: 2,
          options: [
            { id: 11, texte: 'A', est_correcte: true },
            { id: 12, texte: 'B', est_correcte: false },
          ],
        },
      ],
    })

    render(
      <QuizEditor isOpen moduleId={5} quizId={8} moduleTitre="Module" onClose={() => {}} />,
    )

    expect(await screen.findByText('Modifier le questionnaire')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Quiz existant')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Question déjà saisie')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mettre à jour le quiz' })).toBeInTheDocument()
  })

  it('remplace les questions après une génération IA', async () => {
    const user = userEvent.setup()
    generateQuizAi.mockResolvedValue({
      titre: 'Quiz IA',
      questions: [
        {
          texte: 'Question générée',
          type_question: 'QCU',
          options: [
            { texte: 'Oui', est_correcte: true },
            { texte: 'Non', est_correcte: false },
          ],
        },
      ],
    })

    render(<QuizEditor isOpen moduleId={5} moduleTitre="Module" onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Générer avec l'IA/i }))

    expect(await screen.findByDisplayValue('Quiz IA')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Question générée')).toBeInTheDocument()
  })
})
