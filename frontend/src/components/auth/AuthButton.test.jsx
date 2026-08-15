import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthButton from './AuthButton'

describe('AuthButton', () => {
  it('affiche le libellé transmis', () => {
    render(<AuthButton>Se connecter</AuthButton>)
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('transmet le clic à onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<AuthButton onClick={onClick}>Valider</AuthButton>)

    await user.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('reste inactif quand disabled est vrai', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <AuthButton disabled onClick={onClick}>
        Envoi…
      </AuthButton>,
    )

    const button = screen.getByRole('button', { name: 'Envoi…' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
