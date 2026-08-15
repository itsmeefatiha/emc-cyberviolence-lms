import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { USERS, db } from '../../test/msw/db.js'
import { server } from '../../test/msw/server.js'
import { authenticateAs, renderApp } from '../../test/renderApp.jsx'

describe('Intégration — parcours apprenant', () => {
  beforeEach(() => {
    authenticateAs(USERS.learner)
  })

  it('affiche le catalogue publié et filtre par recherche', async () => {
    const { user } = renderApp({ route: '/browse' })

    expect(await screen.findByRole('heading', { name: /Parcours de Formation/i })).toBeInTheDocument()
    expect(await screen.findByText('Cyberviolence et école')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText('Rechercher une formation, un sujet...'),
      'introuvable',
    )
    expect(await screen.findByText('Aucun parcours trouvé')).toBeInTheDocument()
  })

  it('affiche une erreur si le catalogue est indisponible', async () => {
    server.use(
      http.get('*/api/v1/courses/parcours/', () =>
        HttpResponse.json({ detail: 'Service indisponible' }, { status: 500 }),
      ),
    )

    renderApp({ route: '/browse' })

    expect(
      await screen.findByText('Impossible de charger les parcours de formation disponibles.'),
    ).toBeInTheDocument()
  })

  it('inscrit l’apprenant puis ouvre la première leçon', async () => {
    const { user } = renderApp({ route: '/courses/parcours-1' })

    expect(await screen.findByRole('heading', { name: 'Cyberviolence et école' })).toBeInTheDocument()
    expect(screen.getByText('Repérer le cyberharcèlement')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /S'inscrire au parcours/i }))

    expect(
      await screen.findByText('Le cyberharcèlement est une violence répétée exercée en ligne.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marquer comme terminé' })).toBeInTheDocument()
  })

  it('ajoute un parcours aux favoris depuis le catalogue', async () => {
    const { user } = renderApp({ route: '/browse' })

    expect(await screen.findByText('Cyberviolence et école')).toBeInTheDocument()
    await user.click(screen.getByTitle('Ajouter aux favoris'))

    await waitFor(() => {
      expect(screen.getByTitle('Retirer des favoris')).toBeInTheDocument()
    })
    expect(db.favoriteIds.has('parcours-1')).toBe(true)
  })

  it('liste les formations inscrites et les onglets', async () => {
    db.enrolledIds.add('parcours-1')
    db.favoriteIds.add('parcours-1')
    const { user } = renderApp({ route: '/my-courses' })

    expect(await screen.findByRole('heading', { name: 'Mes formations' })).toBeInTheDocument()
    expect(screen.getByText('Cyberviolence et école')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Continuer/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Terminés/i }))
    expect(await screen.findByText('Aucun parcours terminé')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Favoris/i }))
    expect(await screen.findByText('Cyberviolence et école')).toBeInTheDocument()
  })

  it('affiche le tableau de bord avec un parcours en cours', async () => {
    db.enrolledIds.add('parcours-1')
    renderApp({ route: '/dashboard' })

    expect(await screen.findByText('1 parcours')).toBeInTheDocument()
    expect(screen.getByText('Cyberviolence et école')).toBeInTheDocument()
    expect(screen.getByText('Reprendre')).toBeInTheDocument()
    expect(await screen.findByText('Événements à venir')).toBeInTheDocument()
  })

  it('affiche les certificats et déclenche le téléchargement', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { user } = renderApp({ route: '/certificates' })

    expect(await screen.findByRole('heading', { name: /Mes Certifications/i })).toBeInTheDocument()
    expect(await screen.findByText('Cyberviolence et école')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Télécharger le PDF/i }))
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled()
    })
    openSpy.mockRestore()
  })

  it('liste les sessions live rejoignables', async () => {
    renderApp({ route: '/live-sessions' })

    expect(await screen.findByRole('heading', { name: 'Sessions live' })).toBeInTheDocument()
    expect(await screen.findByText('Visio de rentrée — cyberviolence')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rejoindre/i })).toBeInTheDocument()
  })

  it('charge et met à jour le profil', async () => {
    const { user } = renderApp({ route: '/profile' })

    expect(await screen.findByText('Informations Personnelles')).toBeInTheDocument()
    expect(screen.getAllByText('Amina').length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: 'Modifier' })[0])
    const firstName = screen.getByDisplayValue('Amina')
    await user.clear(firstName)
    await user.type(firstName, 'Amine')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Modifications enregistrées avec succès !')).toBeInTheDocument()
    expect(db.currentUser.first_name).toBe('Amine')
  })
})
