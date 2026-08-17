// @ts-check
import { test } from './fixtures.js'
import { SHARED_CATALOG } from './helpers/catalog.js'
import { provisionE2E } from './helpers/provision.js'

test.describe('Apprenant — catalogue vers leçon', () => {
  test('parcourt le catalogue, s’inscrit et ouvre la première leçon', async ({
    loginPage,
    learnerDashboardPage,
    catalogPage,
    courseOverviewPage,
    lessonPage,
  }) => {
    const learner = provisionE2E({ role: 'APPRENANT' })

    await test.step('Connexion', async () => {
      await loginPage.login(learner.email, learner.password)
      await learnerDashboardPage.expectLoaded(learner.first_name)
    })

    await test.step('Ouverture du parcours dans le catalogue', async () => {
      await catalogPage.goto()
      await catalogPage.openCourse(SHARED_CATALOG.courseTitle)
      await courseOverviewPage.expectLoaded(SHARED_CATALOG.courseTitle)
    })

    await test.step('Inscription et accès à la première leçon', async () => {
      await courseOverviewPage.enroll()
      await lessonPage.expectLoaded(SHARED_CATALOG)
    })
  })
})
