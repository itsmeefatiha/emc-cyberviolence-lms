// @ts-check
import { test } from './fixtures.js'
import { provisionE2E, uniqueUnknownEmail } from './helpers/provision.js'

test.describe('Auth — connexion apprenant', () => {
  test('refuse des identifiants inconnus puis connecte un apprenant isolé', async ({
    loginPage,
    learnerDashboardPage,
  }) => {
    const learner = provisionE2E({ role: 'APPRENANT' })

    await test.step('Refus d’un e-mail inconnu', async () => {
      await loginPage.submit(uniqueUnknownEmail(), 'WrongPass123!')
      await loginPage.expectInvalidCredentials()
    })

    await test.step('Connexion avec un compte unique', async () => {
      await loginPage.login(learner.email, learner.password)
      await learnerDashboardPage.expectLoaded(learner.first_name)
    })
  })
})
