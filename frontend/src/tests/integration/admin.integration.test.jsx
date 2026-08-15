import { fireEvent, screen, waitFor } from '@testing-library/react'
import { USERS, db } from '../../test/msw/db.js'
import { authenticateAs, renderApp } from '../../test/renderApp.jsx'

describe('Intégration — administration', () => {
  beforeEach(() => {
    authenticateAs(USERS.admin)
  })

  it('charge le dashboard administrateur avec les compteurs API', async () => {
    renderApp({ route: '/admin/dashboard' })

    expect(
      await screen.findByRole('heading', { name: 'Dashboard administrateur' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Utilisateurs')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Cyberviolence et école')).toBeInTheDocument()
  })

  it('liste les utilisateurs et permet d’en créer un', async () => {
    const { user } = renderApp({ route: '/admin/users' })

    expect(await screen.findByRole('heading', { name: 'Gestion des utilisateurs' })).toBeInTheDocument()
    expect(await screen.findByText('amina@example.com')).toBeInTheDocument()
    expect(screen.getByText('karim@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ajouter un utilisateur/i }))
    expect(await screen.findByRole('heading', { name: 'Ajouter un utilisateur' })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('ex. Hassan El Mansouri'), 'Leila Ouazzani')
    await user.type(screen.getByPlaceholderText('ex. hmansouri'), 'leila')
    await user.type(screen.getByPlaceholderText('ex. hassan@e-formation.ma'), 'leila@example.com')

    const form = screen.getByRole('button', { name: "Créer l'utilisateur" }).closest('form')
    const passwordInputs = form.querySelectorAll('input[type="password"]')
    await user.type(passwordInputs[0], 'Password1!')
    await user.type(passwordInputs[1], 'Password1!')

    await user.click(screen.getByRole('button', { name: "Créer l'utilisateur" }))

    expect(await screen.findByText('leila@example.com')).toBeInTheDocument()
    await waitFor(() => {
      expect(db.users.some((item) => item.email === 'leila@example.com')).toBe(true)
    })
  }, 20000)

  it('filtre les utilisateurs par recherche', async () => {
    renderApp({ route: '/admin/users' })

    expect(await screen.findByText('amina@example.com')).toBeInTheDocument()
    fireEvent.change(
      screen.getByPlaceholderText("Rechercher un nom d'utilisateur ou un email..."),
      { target: { value: 'karim' } },
    )

    expect(screen.getByText('karim@example.com')).toBeInTheDocument()
    expect(screen.queryByText('amina@example.com')).not.toBeInTheDocument()
  })

  it('affiche la modération des parcours', async () => {
    renderApp({ route: '/admin/courses' })

    expect(await screen.findByRole('heading', { name: 'Modération des parcours' })).toBeInTheDocument()
    expect(await screen.findByText('Cyberviolence et école')).toBeInTheDocument()
  })
})
