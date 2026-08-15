import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthField from './AuthField'

describe('AuthField', () => {
  it('affiche le libellé et les enfants', () => {
    render(
      <AuthField label="Adresse e-mail">
        <input aria-label="Adresse e-mail" />
      </AuthField>,
    )

    expect(screen.getByText('Adresse e-mail')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Adresse e-mail' })).toBeInTheDocument()
  })

  it('affiche le message d’erreur quand il est fourni', () => {
    render(
      <AuthField label="Mot de passe" error="Le mot de passe est requis.">
        <input type="password" />
      </AuthField>,
    )

    expect(screen.getByText('Le mot de passe est requis.')).toBeInTheDocument()
  })

  it('n’affiche pas d’erreur ni de libellé s’ils sont absents', () => {
    render(
      <AuthField>
        <input aria-label="Champ libre" />
      </AuthField>,
    )

    expect(screen.queryByText('Le mot de passe est requis.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Champ libre')).toBeInTheDocument()
  })

  it('associe le champ au libellé pour la saisie', async () => {
    const user = userEvent.setup()
    render(
      <AuthField label="Nom">
        <input />
      </AuthField>,
    )

    await user.type(screen.getByLabelText('Nom'), 'Amina')
    expect(screen.getByLabelText('Nom')).toHaveValue('Amina')
  })
})
