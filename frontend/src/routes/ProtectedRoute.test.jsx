import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'
import { mockAuth, resetMockAuth } from '../test/authMock.js'
import { renderWithRoutes } from '../test/test-utils.jsx'

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}))

function renderProtected(route = '/espace') {
  return renderWithRoutes(
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/espace" element={<p>Zone privée</p>} />
      </Route>
      <Route path="/login" element={<p>Page de connexion</p>} />
    </Routes>,
    { route },
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    resetMockAuth()
  })

  it('affiche un indicateur de chargement pendant la vérification de session', () => {
    resetMockAuth({ loading: true, isAuthenticated: false, user: null })
    const { container } = renderProtected()

    expect(screen.queryByText('Zone privée')).not.toBeInTheDocument()
    expect(screen.queryByText('Page de connexion')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('redirige vers la connexion si l’utilisateur n’est pas authentifié', () => {
    resetMockAuth({ loading: false, isAuthenticated: false, user: null })
    renderProtected()

    expect(screen.getByText('Page de connexion')).toBeInTheDocument()
    expect(screen.queryByText('Zone privée')).not.toBeInTheDocument()
  })

  it('affiche la page protégée si l’utilisateur est authentifié', () => {
    resetMockAuth({ loading: false, isAuthenticated: true })
    renderProtected()

    expect(screen.getByText('Zone privée')).toBeInTheDocument()
  })
})
