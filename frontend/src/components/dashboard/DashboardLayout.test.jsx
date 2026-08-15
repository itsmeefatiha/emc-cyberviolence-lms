import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardLayout from './DashboardLayout'
import { mockAuth, resetMockAuth } from '../../test/authMock.js'
import { renderWithRoutes } from '../../test/test-utils.jsx'

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('../../api/notifications.js', () => ({
  listNotifications: vi.fn().mockResolvedValue([]),
  getUnreadNotificationsCount: vi.fn().mockResolvedValue({ count: 0 }),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

vi.mock('../../api/chat.js', () => ({
  listConversations: vi.fn().mockResolvedValue([]),
}))

function renderLayout() {
  return renderWithRoutes(
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<p>Contenu du tableau de bord</p>} />
      </Route>
    </Routes>,
    { route: '/dashboard' },
  )
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    resetMockAuth()
  })

  it('affiche la barre latérale, la barre supérieure et la page enfant', async () => {
    renderLayout()

    expect(await screen.findByText('Contenu du tableau de bord')).toBeInTheDocument()
    expect(screen.getByText('EMC E-Formation')).toBeInTheDocument()
    expect(screen.getByText('Amina')).toBeInTheDocument()
  })

  it('replie et déplie la barre latérale', async () => {
    const { user } = renderLayout()

    expect(screen.getByText('EMC E-Formation')).toBeInTheDocument()
    expect(screen.getByText('Mes formations')).toBeInTheDocument()

    await user.click(screen.getByTitle('Réduire la barre'))

    expect(screen.queryByText('EMC E-Formation')).not.toBeInTheDocument()
    expect(screen.queryByText('Mes formations')).not.toBeInTheDocument()

    await user.click(screen.getByTitle('Agrandir la barre'))

    expect(screen.getByText('EMC E-Formation')).toBeInTheDocument()
    expect(screen.getByText('Mes formations')).toBeInTheDocument()
  })
})
