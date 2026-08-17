// @ts-check
import { test as base } from '@playwright/test'
import { LoginPage } from './pages/LoginPage.js'
import {
  CatalogPage,
  CourseOverviewPage,
  LearnerDashboardPage,
  LessonPage,
} from './pages/learner.page.js'
import { ChatPage } from './pages/ChatPage.js'
import { CourseBuilderPage, InstructorDashboardPage } from './pages/instructor.page.js'
import { AdminDashboardPage, UserManagementPage } from './pages/admin.page.js'

/**
 * Custom POM fixtures injected into every spec that imports `test` from this file.
 * @typedef {object} AppFixtures
 * @property {LoginPage} loginPage
 * @property {LearnerDashboardPage} learnerDashboardPage
 * @property {CatalogPage} catalogPage
 * @property {CourseOverviewPage} courseOverviewPage
 * @property {LessonPage} lessonPage
 * @property {ChatPage} chatPage
 * @property {InstructorDashboardPage} instructorDashboardPage
 * @property {CourseBuilderPage} courseBuilderPage
 * @property {AdminDashboardPage} adminDashboardPage
 * @property {UserManagementPage} userManagementPage
 */

/**
 * @typedef {import('@playwright/test').PlaywrightTestArgs &
 *   import('@playwright/test').PlaywrightTestOptions &
 *   AppFixtures} TestArgs
 * @typedef {import('@playwright/test').PlaywrightWorkerArgs &
 *   import('@playwright/test').PlaywrightWorkerOptions} WorkerArgs
 */

export const test = /** @type {import('@playwright/test').TestType<TestArgs, WorkerArgs>} */ (
  base.extend({
    loginPage: async ({ page }, use) => {
      await use(new LoginPage(page))
    },
    learnerDashboardPage: async ({ page }, use) => {
      await use(new LearnerDashboardPage(page))
    },
    catalogPage: async ({ page }, use) => {
      await use(new CatalogPage(page))
    },
    courseOverviewPage: async ({ page }, use) => {
      await use(new CourseOverviewPage(page))
    },
    lessonPage: async ({ page }, use) => {
      await use(new LessonPage(page))
    },
    chatPage: async ({ page }, use) => {
      await use(new ChatPage(page))
    },
    instructorDashboardPage: async ({ page }, use) => {
      await use(new InstructorDashboardPage(page))
    },
    courseBuilderPage: async ({ page }, use) => {
      await use(new CourseBuilderPage(page))
    },
    adminDashboardPage: async ({ page }, use) => {
      await use(new AdminDashboardPage(page))
    },
    userManagementPage: async ({ page }, use) => {
      await use(new UserManagementPage(page))
    },
  })
)

export { expect } from '@playwright/test'
