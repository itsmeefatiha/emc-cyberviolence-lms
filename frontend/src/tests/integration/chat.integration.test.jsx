import { screen, waitFor, within } from '@testing-library/react'
import { USERS } from '../../test/msw/db.js'
import { authenticateAs, renderApp } from '../../test/renderApp.jsx'

describe('Intégration — messagerie et notifications', () => {
  beforeEach(() => {
    authenticateAs(USERS.learner)
  })

  it('ouvre une conversation existante et envoie un message', async () => {
    const { user } = renderApp({ route: '/chat' })

    expect(await screen.findByRole('heading', { name: 'Messagerie' })).toBeInTheDocument()
    expect(await screen.findAllByText('Karim Haddad')).not.toHaveLength(0)
    expect(
      await screen.findAllByText('Bonjour Amina, des questions sur le module 1 ?'),
    ).not.toHaveLength(0)

    await user.type(screen.getByPlaceholderText('Écrire un message…'), 'Oui, merci pour le suivi.')
    await user.keyboard('{Enter}')

    expect(await screen.findAllByText('Oui, merci pour le suivi.')).not.toHaveLength(0)
  })

  it('démarre une conversation depuis la liste des formateurs', async () => {
    const { user } = renderApp({ route: '/chat' })

    expect(await screen.findByText('Formateurs')).toBeInTheDocument()
    const contactButtons = await screen.findAllByRole('button', { name: /Karim Haddad/i })
    await user.click(contactButtons[contactButtons.length - 1])

    expect(await screen.findByPlaceholderText('Écrire un message…')).toBeInTheDocument()
  })

  it('affiche les notifications du topbar et les marque comme lues', async () => {
    const { user } = renderApp({ route: '/dashboard' })

    expect(await screen.findByLabelText('Ouvrir les notifications')).toBeInTheDocument()
    const notifButton = screen.getByLabelText('Ouvrir les notifications')
    await waitFor(() => {
      expect(within(notifButton).getByText('1')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Ouvrir les notifications'))
    expect(await screen.findByText('Nouveau message')).toBeInTheDocument()
    expect(screen.getByText('Karim Haddad vous a écrit')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Tout marquer lu/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Tout marquer lu/i })).not.toBeInTheDocument()
    })
  })
})
