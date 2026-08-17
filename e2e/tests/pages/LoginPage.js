// @ts-check
import { expect } from '@playwright/test'

export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: /Bon retour/i })
    this.emailInput = page.getByPlaceholder('stanley@gmail.com')
    this.passwordInput = page.getByPlaceholder('••••••••••••')
    this.submitButton = page.getByRole('button', { name: 'Se connecter' })
    this.authError = page.getByText(/Aucun compte actif|Identifiants invalides/)
  }

  async goto() {
    await this.page.goto('/login')
    await expect(this.heading).toBeVisible()
  }

  /**
   * @param {string} email
   * @param {string} password
   */
  async submit(email, password) {
    await this.goto()
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  /**
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    await this.submit(email, password)
    await expect(this.page).not.toHaveURL(/\/login/, { timeout: 30_000 })
  }

  async expectInvalidCredentials() {
    await expect(this.authError).toBeVisible()
    await expect(this.page).toHaveURL(/\/login/)
  }
}
