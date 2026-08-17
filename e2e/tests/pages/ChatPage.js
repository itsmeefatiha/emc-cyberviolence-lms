// @ts-check
import { expect } from '@playwright/test'

export class ChatPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Messagerie' })
    this.composer = page.getByPlaceholder('Écrire un message…')
  }

  async goto() {
    await this.page.goto('/chat')
    await expect(this.heading).toBeVisible()
  }

  /** @param {string} contactName */
  async openThreadWith(contactName) {
    if (!(await this.composer.isVisible())) {
      await this.page.getByRole('button', { name: new RegExp(contactName) }).first().click()
    }
    await expect(this.composer).toBeVisible()
  }

  /** @param {string} body */
  async sendMessage(body) {
    await this.composer.fill(body)
    await this.composer.press('Enter')
    await expect(this.page.getByText(body)).toBeVisible()
  }
}
