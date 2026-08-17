// @ts-check
import { test } from './fixtures.js'
import { SHARED_CATALOG } from './helpers/catalog.js'
import { provisionE2E } from './helpers/provision.js'

test.describe('Messagerie apprenant ↔ formateur', () => {
  test('ouvre une conversation avec le formateur et envoie un message', async ({
    loginPage,
    learnerDashboardPage,
    chatPage,
  }) => {
    const learner = provisionE2E({ role: 'APPRENANT', enrollSharedCourse: true })
    const body = `Message E2E ${crypto.randomUUID()}`

    await test.step('Connexion', async () => {
      await loginPage.login(learner.email, learner.password)
      await learnerDashboardPage.expectLoaded(learner.first_name)
    })

    await test.step('Ouverture du fil avec le formateur', async () => {
      await chatPage.goto()
      await chatPage.openThreadWith(SHARED_CATALOG.instructorFullName)
    })

    await test.step('Envoi d’un message', async () => {
      await chatPage.sendMessage(body)
    })
  })
})
