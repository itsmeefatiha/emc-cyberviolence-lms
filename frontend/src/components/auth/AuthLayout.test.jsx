import { render, screen } from '@testing-library/react'
import AuthLayout from './AuthLayout'

describe('AuthLayout', () => {
  it('affiche le contenu du formulaire', () => {
    render(
      <AuthLayout>
        <h1>Connexion</h1>
      </AuthLayout>,
    )

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
  })

  it('affiche le pied de page lorsqu’il est fourni', () => {
    render(
      <AuthLayout footer={<a href="/register">Créer un compte</a>}>
        <p>Formulaire</p>
      </AuthLayout>,
    )

    expect(screen.getByRole('link', { name: 'Créer un compte' })).toBeInTheDocument()
  })

  it('n’affiche pas de pied de page s’il est absent', () => {
    render(
      <AuthLayout>
        <p>Formulaire</p>
      </AuthLayout>,
    )

    expect(screen.queryByRole('link', { name: 'Créer un compte' })).not.toBeInTheDocument()
  })

  it('utilise l’illustration par défaut si aucune n’est passée', () => {
    render(
      <AuthLayout>
        <p>Formulaire</p>
      </AuthLayout>,
    )

    expect(
      screen.getByRole('img', { name: 'Authentication Illustration' }),
    ).toBeInTheDocument()
  })

  it('affiche l’illustration personnalisée à la place du fallback', () => {
    render(
      <AuthLayout illustration={<img alt="Illustration personnalisée" src="/custom.svg" />}>
        <p>Formulaire</p>
      </AuthLayout>,
    )

    expect(screen.getByRole('img', { name: 'Illustration personnalisée' })).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: 'Authentication Illustration' }),
    ).not.toBeInTheDocument()
  })
})
