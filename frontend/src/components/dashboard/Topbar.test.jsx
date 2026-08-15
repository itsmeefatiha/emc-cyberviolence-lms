import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Topbar from './Topbar'
import { mockAuth, resetMockAuth } from '../../test/authMock.js'
import { renderWithRouter } from '../../test/test-utils.jsx'

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('../../api/notifications.js', () => ({
  listNotifications: vi.fn(),
  getUnreadNotificationsCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

vi.mock('../../api/chat.js', () => ({
  listConversations: vi.fn(),
}))

import {
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications.js'
import { listConversations } from '../../api/chat.js'

describe('Topbar', () => {
  beforeEach(() => {
    resetMockAuth()
    listNotifications.mockResolvedValue([])
    getUnreadNotificationsCount.mockResolvedValue({ count: 0 })
    listConversations.mockResolvedValue([])
    markAllNotificationsRead.mockResolvedValue({})
    markNotificationRead.mockResolvedValue({})
  })

  it('affiche le prénom de l’utilisateur et le champ de recherche', async () => {
    renderWithRouter(<Topbar />)

    expect(
      screen.getByPlaceholderText('Rechercher un parcours ou un formateur'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Amina')).toBeInTheDocument()
    expect(screen.getByTitle('Déconnexion')).toBeInTheDocument()
  })

  it('appelle logout au clic sur déconnexion', async () => {
    const { user } = renderWithRouter(<Topbar />)

    await user.click(screen.getByTitle('Déconnexion'))
    expect(mockAuth.logout).toHaveBeenCalledTimes(1)
  })

  it('masque le bouton messages pour un administrateur', () => {
    resetMockAuth({
      user: { first_name: 'Nadia', role: 'ADMIN' },
    })
    renderWithRouter(<Topbar />)

    expect(screen.queryByLabelText('Ouvrir les messages')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ouvrir les notifications')).toBeInTheDocument()
  })

  it('ouvre le panneau de notifications et affiche le contenu', async () => {
    listNotifications.mockResolvedValue([
      {
        id: 7,
        titre: 'Nouveau message',
        message: 'Karim vous a écrit',
        est_lue: false,
        type_notification: 'MESSAGE',
        date_creation: new Date().toISOString(),
        lien: '/chat',
      },
    ])
    getUnreadNotificationsCount.mockResolvedValue({ count: 1 })

    const { user } = renderWithRouter(<Topbar />)

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Ouvrir les notifications'))

    const panel = await screen.findByText('Notifications')
    const dialog = panel.closest('div')
    expect(within(dialog.parentElement).getByText('Nouveau message')).toBeInTheDocument()
    expect(screen.getByText('Karim vous a écrit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tout marquer lu/i })).toBeInTheDocument()
  })

  it('marque toutes les notifications comme lues', async () => {
    listNotifications.mockResolvedValue([
      {
        id: 7,
        titre: 'Inscription',
        message: 'Un apprenant s’est inscrit',
        est_lue: false,
        type_notification: 'INSCRIPTION',
        date_creation: new Date().toISOString(),
      },
    ])
    getUnreadNotificationsCount.mockResolvedValue({ count: 2 })

    const { user } = renderWithRouter(<Topbar />)
    await user.click(screen.getByLabelText('Ouvrir les notifications'))
    await user.click(await screen.findByRole('button', { name: /Tout marquer lu/i }))

    expect(markAllNotificationsRead).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Tout marquer lu/i })).not.toBeInTheDocument()
    })
  })

  it('affiche les conversations dans le panneau messages', async () => {
    listConversations.mockResolvedValue([
      {
        id: 3,
        peer_nom: 'Karim Formateur',
        unread_count: 2,
        last_message: { body: 'Bonjour Amina', created_at: new Date().toISOString() },
      },
    ])

    const { user } = renderWithRouter(<Topbar />)
    await user.click(await screen.findByLabelText('Ouvrir les messages'))

    expect(await screen.findByText('Karim Formateur')).toBeInTheDocument()
    expect(screen.getByText('Bonjour Amina')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir le chat' })).toBeInTheDocument()
  })
})
