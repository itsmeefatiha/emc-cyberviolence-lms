import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicRoute from './PublicRoute'
import { mockAuth, resetMockAuth } from '../test/authMock.js'
import { renderWithRoutes } from '../test/test-utils.jsx'

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}))

function renderPublic(route = '/login') {
  return renderWithRoutes(
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<p>Page de connexion</p>} />
      </Route>
      <Route path="/dashboard" element={<p>Tableau de bord apprenant</p>} />
      <Route path="/instructor/dashboard" element={<p>Tableau de bord formateur</p>} />
      <Route path="/admin/dashboard" element={<p>Tableau de bord admin</p>} />
    </Routes>,
    { route },
  )
}

describe('PublicRoute', () => {
  beforeEach(() => {
    resetMockAuth({ isAuthenticated: false, user: null, loading: false })
  })

  it('affiche la page publique si l’utilisateur n’est pas connecté', () => {
    renderPublic()
    expect(screen.getByText('Page de connexion')).toBeInTheDocument()
  })

  it('redirige un apprenant connecté vers son tableau de bord', () => {
    resetMockAuth({
      isAuthenticated: true,
      loading: false,
      user: { role: 'APPRENANT', first_name: 'Amina' },
    })
    renderPublic()

    expect(screen.getByText('Tableau de bord apprenant')).toBeInTheDocument()
    expect(screen.queryByText('Page de connexion')).not.toBeInTheDocument()
  })

  it('redirige un formateur connecté vers l’espace formateur', () => {
    resetMockAuth({
      isAuthenticated: true,
      loading: false,
      user: { role: 'FORMATEUR', first_name: 'Karim' },
    })
    renderPublic()

    expect(screen.getByText('Tableau de bord formateur')).toBeInTheDocument()
  })

  it('affiche un chargement si une session stockée est en cours de vérification', () => {
    localStorage.setItem('accessToken', 'access')
    localStorage.setItem('refreshToken', 'refresh')
    resetMockAuth({ loading: true, isAuthenticated: false, user: null })

    const { container } = renderPublic()
    expect(screen.queryByText('Page de connexion')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
