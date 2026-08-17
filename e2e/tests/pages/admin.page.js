// @ts-check
import { expect } from '@playwright/test'

export class AdminDashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Dashboard administrateur' })
    this.usersLink = page.getByRole('link', { name: 'Gestion des utilisateurs' })
  }

  /** @param {string} firstName */
  async expectLoaded(firstName) {
    await expect(this.page).toHaveURL(/\/admin\/dashboard/)
    await expect(this.heading).toBeVisible()
    await expect(this.page.getByText(firstName).first()).toBeVisible()
    await expect(this.page.getByText('Utilisateurs', { exact: true }).first()).toBeVisible()
  }

  async openUserManagement() {
    await this.usersLink.click()
  }
}

export class UserManagementPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Gestion des utilisateurs' })
    this.searchInput = page.getByPlaceholder("Rechercher un nom d'utilisateur ou un email...")
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/admin\/users/)
    await expect(this.heading).toBeVisible()
  }

  /**
   * @param {string} email
   * @param {string} firstName
   */
  async expectUserVisible(email, firstName) {
    await this.searchInput.fill(email)
    await expect(this.page.getByText(email)).toBeVisible()
    await expect(this.page.getByText(firstName).first()).toBeVisible()
  }
}
