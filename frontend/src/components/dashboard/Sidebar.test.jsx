import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'
import { mockAuth, resetMockAuth } from '../../test/authMock.js'
import { renderWithRouter } from '../../test/test-utils.jsx'

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}))

describe('Sidebar', () => {
  beforeEach(() => {
    resetMockAuth()
  })

  it('affiche la navigation de l’apprenant', () => {
    renderWithRouter(<Sidebar isCollapsed={false} onToggle={() => {}} />, {
      route: '/dashboard',
    })

    expect(screen.getByText('EMC E-Formation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Tableau de bord/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mes formations/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Certificats/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Gestion des utilisateurs/i })).not.toBeInTheDocument()
  })

  it('affiche la navigation formateur selon le rôle', () => {
    resetMockAuth({
      user: { first_name: 'Karim', role: 'FORMATEUR' },
    })
    renderWithRouter(<Sidebar isCollapsed={false} onToggle={() => {}} />, {
      route: '/instructor/dashboard',
    })

    expect(screen.getByRole('link', { name: /Constructeur de parcours/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Suivi des apprenants/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Explorer/i })).not.toBeInTheDocument()
  })

  it('masque les libellés quand la barre est repliée', () => {
    renderWithRouter(<Sidebar isCollapsed onToggle={() => {}} />, {
      route: '/dashboard',
    })

    expect(screen.queryByText('EMC E-Formation')).not.toBeInTheDocument()
    expect(screen.queryByText('Mes formations')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mes formations' })).toHaveAttribute(
      'title',
      'Mes formations',
    )
  })

  it('demande le repli au clic sur le logo', async () => {
    const onToggle = vi.fn()
    const { user } = renderWithRouter(
      <Sidebar isCollapsed={false} onToggle={onToggle} />,
      { route: '/dashboard' },
    )

    await user.click(screen.getByTitle('Réduire la barre'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
