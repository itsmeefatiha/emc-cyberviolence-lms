import { screen } from '@testing-library/react'
import { USERS } from '../../test/msw/db.js'
import { authenticateAs, renderApp } from '../../test/renderApp.jsx'

describe('Intégration — espace formateur', () => {
  beforeEach(() => {
    authenticateAs(USERS.instructor)
  })

  it('charge le tableau de bord formateur depuis l’API', async () => {
    renderApp({ route: '/instructor/dashboard' })

    expect(await screen.findByRole('heading', { name: 'Tableau de bord formateur' })).toBeInTheDocument()
    expect(screen.getByText('Cyberviolence et école')).toBeInTheDocument()
    expect(screen.getByText('Amina Benali')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('liste les parcours du formateur', async () => {
    renderApp({ route: '/instructor/courses' })

    expect(await screen.findByRole('heading', { name: 'Constructeur de parcours' })).toBeInTheDocument()
    expect(await screen.findByText('Cyberviolence et école')).toBeInTheDocument()
  })

  it('affiche le suivi des apprenants', async () => {
    renderApp({ route: '/instructor/analytics' })

    expect(await screen.findByRole('heading', { name: 'Suivi des apprenants' })).toBeInTheDocument()
    expect(await screen.findByText('Amina Benali')).toBeInTheDocument()
  })

  it('liste les sessions live du formateur', async () => {
    renderApp({ route: '/instructor/live-sessions' })

    expect(await screen.findByRole('heading', { name: 'Sessions live' })).toBeInTheDocument()
    expect(await screen.findByText('Visio de rentrée — cyberviolence')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nouvelle session/i })).toBeInTheDocument()
  })
})
