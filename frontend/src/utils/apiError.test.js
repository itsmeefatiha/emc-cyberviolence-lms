import { describe, expect, it } from 'vitest'
import { getApiErrorMessage, toErrorText } from './apiError.js'

describe('toErrorText', () => {
  it('extrait une chaîne, un tableau ou un objet d’erreur', () => {
    expect(toErrorText('Déjà utilisé')).toBe('Déjà utilisé')
    expect(toErrorText(['Premier'])).toBe('Premier')
    expect(toErrorText({ detail: 'Refusé' })).toBe('Refusé')
  })
})

describe('getApiErrorMessage', () => {
  it('traduit les identifiants invalides de SimpleJWT', () => {
    expect(
      getApiErrorMessage(
        { response: { data: { detail: 'No active account found with the given credentials' } } },
        'Erreur',
      ),
    ).toBe('Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.')
  })

  it('extrait une erreur de champ renvoyée par l’API', () => {
    expect(
      getApiErrorMessage(
        { response: { data: { profil_professionnel: ['"PARENT" is not a valid choice.'] } } },
        'Erreur',
      ),
    ).toBe('Cette valeur n’est pas reconnue. Choisissez une option dans la liste.')
  })

  it('renvoie le message de secours si l’API ne fournit rien', () => {
    expect(getApiErrorMessage({}, 'Connexion impossible.')).toBe('Connexion impossible.')
  })
})
