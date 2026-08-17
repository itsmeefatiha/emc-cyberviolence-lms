// @ts-check
import { test } from './fixtures.js'
import { provisionE2E } from './helpers/provision.js'

test.describe('Admin — supervision de la plateforme', () => {
  test('se connecte, ouvre le dashboard puis retrouve un utilisateur isolé', async ({
    loginPage,
    adminDashboardPage,
    userManagementPage,
  }) => {
    const admin = provisionE2E({ role: 'ADMIN', withLearner: true })
    const learner = admin.learner

    await test.step('Connexion administrateur', async () => {
      await loginPage.login(admin.email, admin.password)
      await adminDashboardPage.expectLoaded(admin.first_name)
    })

    await test.step('Recherche de l’apprenant provisionné', async () => {
      await adminDashboardPage.openUserManagement()
      await userManagementPage.expectLoaded()
      await userManagementPage.expectUserVisible(learner.email, learner.first_name)
    })
  })
})
