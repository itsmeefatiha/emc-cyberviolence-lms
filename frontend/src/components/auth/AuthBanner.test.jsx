import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthBanner from './AuthBanner'
import { ALERT_DURATION_MS } from '../../constants/alerts.js'

describe('AuthBanner', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('n’affiche rien sans type ou message', () => {
    const { container } = render(<AuthBanner type="error" />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('n’affiche rien pour un type inconnu', () => {
    const { container } = render(
      <AuthBanner type="warning" message="Attention" />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('affiche un message d’erreur', () => {
    render(
      <AuthBanner
        type="error"
        title="Connexion impossible"
        message="Identifiants invalides."
      />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
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

  it('masque l’alerte après 4 secondes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(
      <AuthBanner type="error" message="Identifiants invalides." />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(ALERT_DURATION_MS)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('permet de fermer l’alerte manuellement', async () => {
    const user = userEvent.setup()
    render(<AuthBanner type="error" message="Identifiants invalides." />)

    await user.click(screen.getByRole('button', { name: 'Fermer l’alerte' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
