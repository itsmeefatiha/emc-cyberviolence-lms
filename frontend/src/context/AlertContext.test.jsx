import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlertProvider, useAlert } from './AlertContext.jsx'
import { ALERT_DURATION_MS } from '../constants/alerts.js'

function Probe() {
  const { showAlert } = useAlert()
  return (
    <button type="button" onClick={() => showAlert('error', 'Mot de passe incorrect.')}>
      Alerter
    </button>
  )
}

describe('AlertProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche une alerte puis la masque après 4 secondes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    render(
      <AlertProvider>
        <Probe />
      </AlertProvider>,
    )

    act(() => {
      screen.getByRole('button', { name: 'Alerter' }).click()
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Mot de passe incorrect.')

    act(() => {
      vi.advanceTimersByTime(ALERT_DURATION_MS)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
