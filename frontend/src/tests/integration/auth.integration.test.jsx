import { screen } from '@testing-library/react'
import { USERS, TEST_PASSWORD } from '../../test/msw/db.js'
import { renderApp } from '../../test/renderApp.jsx'

describe('Intégration — authentification', () => {
  it('connecte un apprenant et ouvre son tableau de bord', async () => {
    const { user } = renderApp({ route: '/login' })

    expect(await screen.findByRole('heading', { name: /Bon retour/i })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('stanley@gmail.com'), USERS.learner.email)
    await user.type(screen.getByPlaceholderText('••••••••••••'), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Amina')).toBeInTheDocument()
    expect(await screen.findByText('Aucun parcours en cours')).toBeInTheDocument()
    expect(await screen.findByText('Événements à venir')).toBeInTheDocument()
  })

  it('affiche une erreur si les identifiants sont invalides', async () => {
    const { user } = renderApp({ route: '/login' })

    await user.type(screen.getByPlaceholderText('stanley@gmail.com'), USERS.learner.email)
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'mauvais-mot-de-passe')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(
      await screen.findByText(
        'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Bon retour/i })).toBeInTheDocument()
  })

  it('crée un compte et affiche le message d’activation', async () => {
    const { user } = renderApp({ route: '/register' })

    await user.type(screen.getByPlaceholderText('Prénom'), 'Sara')
    await user.type(screen.getByPlaceholderText('Nom'), 'Amrani')
    await user.type(screen.getByPlaceholderText('stanley@gmail.com'), 'sara@example.com')
    await user.type(screen.getByPlaceholderText('Mot de passe'), 'Password1!')
    await user.type(screen.getByPlaceholderText('Confirmer le mot de passe'), 'Password1!')
    await user.click(screen.getByRole('button', { name: "S'inscrire" }))

    expect(await screen.findByText('Compte créé !')).toBeInTheDocument()
    expect(
      screen.getByText(/Consultez votre boîte e-mail pour activer votre compte/),
    ).toBeInTheDocument()
  })

  it('signale un e-mail déjà utilisé à l’inscription', async () => {
    const { user } = renderApp({ route: '/register' })

    await user.type(screen.getByPlaceholderText('Prénom'), 'Amina')
    await user.type(screen.getByPlaceholderText('Nom'), 'Benali')
    await user.type(screen.getByPlaceholderText('stanley@gmail.com'), USERS.learner.email)
    await user.type(screen.getByPlaceholderText('Mot de passe'), 'Password1!')
    await user.type(screen.getByPlaceholderText('Confirmer le mot de passe'), 'Password1!')
    await user.click(screen.getByRole('button', { name: "S'inscrire" }))

    expect(
      await screen.findByText('Un utilisateur avec cet email existe déjà.'),
    ).toBeInTheDocument()
  })

  it('envoie les instructions de mot de passe oublié', async () => {
    const { user } = renderApp({ route: '/forgot-password' })

    await user.type(screen.getByPlaceholderText('Adresse e-mail'), USERS.learner.email)
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(await screen.findByText('Vérifiez votre boîte e-mail')).toBeInTheDocument()
    expect(
      screen.getByText(/les instructions de réinitialisation ont été envoyées/),
    ).toBeInTheDocument()
  })

  it('réinitialise le mot de passe puis redirige vers la connexion', async () => {
    const { user } = renderApp({ route: '/reset-password/uid-ok/token-ok' })

    await user.type(screen.getByPlaceholderText('Saisissez votre nouveau mot de passe'), 'Nouveau#Pass1')
    await user.type(screen.getByPlaceholderText('Répétez votre nouveau mot de passe'), 'Nouveau#Pass1')
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(
      await screen.findByText('Mot de passe mis à jour. Vous pouvez maintenant vous connecter.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Bon retour/i })).toBeInTheDocument()
  })

  it('active le compte puis propose la connexion', async () => {
    renderApp({ route: '/activate/uid-ok/token-ok' })

    expect(await screen.findByText('Activation en cours...')).toBeInTheDocument()
    expect(
      await screen.findByText('Compte activé avec succès ! Vous pouvez maintenant vous connecter.'),
    ).toBeInTheDocument()
  })

  it('affiche une erreur si le lien d’activation est expiré', async () => {
    renderApp({ route: '/activate/uid-ok/expired' })

    expect(await screen.findByText("Échec de l'activation")).toBeInTheDocument()
    expect(
      screen.getByText('Le lien d’activation est invalide ou a expiré.'),
    ).toBeInTheDocument()
  })

  it('redirige un formateur connecté vers son espace', async () => {
    const { user } = renderApp({ route: '/login' })

    await user.type(screen.getByPlaceholderText('stanley@gmail.com'), USERS.instructor.email)
    await user.type(screen.getByPlaceholderText('••••••••••••'), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Tableau de bord formateur')).toBeInTheDocument()
    expect(screen.getByText('Karim')).toBeInTheDocument()
  })
})
