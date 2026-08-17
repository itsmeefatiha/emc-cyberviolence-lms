// @ts-check
import { expect } from '@playwright/test'

export class InstructorDashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Tableau de bord formateur' })
    this.builderLink = page.getByRole('link', { name: 'Constructeur de parcours' })
  }

  /** @param {string} firstName */
  async expectLoaded(firstName) {
    await expect(this.page).toHaveURL(/\/instructor\/dashboard/)
    await expect(this.heading).toBeVisible()
    await expect(this.page.getByText(firstName).first()).toBeVisible()
    await expect(this.page.getByText('Parcours', { exact: true }).first()).toBeVisible()
    await expect(this.page.getByText('Apprenants', { exact: true }).first()).toBeVisible()
  }

  async openCourseBuilder() {
    await this.builderLink.first().click()
  }
}

export class CourseBuilderPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Constructeur de parcours' })
  }

  /** @param {string} courseTitle */
  async expectCourse(courseTitle) {
    await expect(this.page).toHaveURL(/\/instructor\/courses/)
    await expect(this.heading).toBeVisible()
    await expect(this.page.getByText(courseTitle)).toBeVisible()
  }
}
