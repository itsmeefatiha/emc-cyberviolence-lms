// @ts-check
import { expect } from '@playwright/test'

export class LearnerDashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.ongoingHeading = page.getByRole('heading', { name: 'En cours' })
    this.exploreLink = page.getByRole('link', { name: 'Explorer', exact: true })
  }

  /** @param {string} firstName */
  async expectLoaded(firstName) {
    await expect(this.page).toHaveURL(/\/dashboard/)
    await expect(this.page.getByText(firstName).first()).toBeVisible()
    await expect(this.ongoingHeading).toBeVisible()
  }
}

export class CatalogPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: /Parcours de Formation/i })
    this.exploreLink = page.getByRole('link', { name: 'Explorer', exact: true })
  }

  async goto() {
    await this.exploreLink.click()
    await expect(this.page).toHaveURL(/\/browse/)
    await expect(this.heading).toBeVisible()
  }

  /** @param {string} courseTitle */
  async openCourse(courseTitle) {
    const courseHeading = this.page.getByRole('heading', { name: courseTitle })
    await expect(courseHeading).toBeVisible()
    await courseHeading.click()
  }
}

export class CourseOverviewPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.enrollButton = page.getByRole('button', { name: "S'inscrire au parcours" })
  }

  /** @param {string} courseTitle */
  async expectLoaded(courseTitle) {
    await expect(this.page).toHaveURL(/\/courses\/[^/]+$/)
    await expect(this.page.getByRole('heading', { name: courseTitle })).toBeVisible()
  }

  async enroll() {
    await this.enrollButton.click()
  }
}

export class LessonPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.completeButton = page.getByRole('button', { name: /Marquer comme terminé|Terminé/ })
  }

  /**
   * @param {{ courseTitle: string, lessonTitle: string, lessonBody: string }} content
   */
  async expectLoaded(content) {
    await expect(this.page).toHaveURL(/\/courses\/[^/]+\/(lessons\/|learn)/)
    await expect(this.page.getByRole('heading', { name: content.courseTitle })).toBeVisible()
    await expect(this.page.getByRole('heading', { name: content.lessonTitle })).toBeVisible()
    await expect(this.page.getByText(content.lessonBody)).toBeVisible()
    await expect(this.completeButton).toBeVisible()
  }
}
