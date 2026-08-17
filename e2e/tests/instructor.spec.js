// @ts-check
import { test } from './fixtures.js'
import { provisionE2E } from './helpers/provision.js'

test.describe('Formateur — tableau de bord et constructeur', () => {
  test('se connecte, voit son tableau de bord puis son parcours isolé', async ({
    loginPage,
    instructorDashboardPage,
    courseBuilderPage,
  }) => {
    const instructor = provisionE2E({ role: 'FORMATEUR', withCourse: true })

    await test.step('Connexion', async () => {
      await loginPage.login(instructor.email, instructor.password)
      await instructorDashboardPage.expectLoaded(instructor.first_name)
    })

    await test.step('Ouverture du constructeur de parcours', async () => {
      await instructorDashboardPage.openCourseBuilder()
      await courseBuilderPage.expectCourse(instructor.course_title)
    })
  })
})
