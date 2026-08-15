import { render, screen } from '@testing-library/react'
import AuthBanner from './AuthBanner'

describe('AuthBanner', () => {
  it('n’affiche rien sans type ou message', () => {
    const { container } = render(<AuthBanner type="error" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('n’affiche rien pour un type inconnu', () => {
    const { container } = render(
      <AuthBanner type="warning" message="Attention" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche un message d’erreur', () => {
    render(
      <AuthBanner
        type="error"
        title="Connexion impossible"
        message="Identifiants invalides."
      />,
    )

    expect(screen.getByText('Connexion impossible')).toBeInTheDocument()
    expect(screen.getByText('Identifiants invalides.')).toBeInTheDocument()
  })

  it('affiche un message de succès', () => {
    render(
      <AuthBanner
        type="success"
        title="Compte créé"
        message="Vérifiez votre boîte mail."
      />,
    )

    expect(screen.getByText('Compte créé')).toBeInTheDocument()
    expect(screen.getByText('Vérifiez votre boîte mail.')).toBeInTheDocument()
  })
})
