import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext.jsx'

vi.mock('../api/auth.js', () => ({
  getCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

import { getCurrentUser, loginUser, logoutUser } from '../api/auth.js'

function AuthProbe() {
  const { user, isAuthenticated, loading, error, login, logout } = useAuth()

  if (loading) {
    return <p>Chargement session</p>
  }

  return (
    <div>
      <p>{isAuthenticated ? `Connecté : ${user.first_name}` : 'Invité'}</p>
      {error ? <p>{error}</p> : null}
      <button
        type="button"
        onClick={() =>
          login({ email: 'amina@example.com', password: 'secret' }).catch(() => {})
        }
      >
        Se connecter
      </button>
      <button type="button" onClick={logout}>
        Se déconnecter
      </button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    getCurrentUser.mockReset()
    loginUser.mockReset()
    logoutUser.mockReset()
  })

  it('expose un état invité sans jeton stocké', async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(await screen.findByText('Invité')).toBeInTheDocument()
  })

  it('restaure la session à partir des jetons stockés', async () => {
    localStorage.setItem('accessToken', 'access')
    localStorage.setItem('refreshToken', 'refresh')
    getCurrentUser.mockResolvedValue({ first_name: 'Amina', role: 'APPRENANT' })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('Chargement session')).toBeInTheDocument()
    expect(await screen.findByText('Connecté : Amina')).toBeInTheDocument()
  })

  it('connecte l’utilisateur et affiche son prénom', async () => {
    const user = userEvent.setup()
    loginUser.mockResolvedValue({
      access: 'access',
      refresh: 'refresh',
      user: { first_name: 'Karim', role: 'FORMATEUR' },
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await screen.findByText('Invité')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Connecté : Karim')).toBeInTheDocument()
    expect(localStorage.getItem('accessToken')).toBe('access')
  })

  it('affiche une erreur si la connexion échoue', async () => {
    const user = userEvent.setup()
    loginUser.mockRejectedValue({
      response: { data: { detail: 'Identifiants invalides.' } },
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await screen.findByText('Invité')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Identifiants invalides.')).toBeInTheDocument()
    expect(screen.getByText('Invité')).toBeInTheDocument()
  })

  it('déconnecte et revient à l’état invité', async () => {
    const user = userEvent.setup()
    loginUser.mockResolvedValue({
      access: 'access',
      refresh: 'refresh',
      user: { first_name: 'Amina', role: 'APPRENANT' },
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await screen.findByText('Invité')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    await screen.findByText('Connecté : Amina')

    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => {
      expect(screen.getByText('Invité')).toBeInTheDocument()
    })
    expect(logoutUser).toHaveBeenCalled()
  })
})
