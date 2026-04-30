import { Given, When, Then } from '@wdio/cucumber-framework'
import { expect } from '@wdio/globals'

import LoginPage from '../pages/login.page'
import SecurePage from '../pages/secure.page'

const loginPage = new LoginPage()
const securePage = new SecurePage()

const pages: Record<string, { open(): Promise<void> }> = {
    login: loginPage,
}

Given(/^I am on the (\w+) page$/, async (page: string) => {
    if (!pages[page]) throw new Error(`No page object found for "${page}"`)
    await pages[page].open()
})

When(/^I login with (\w+)$/, async (userType: string) => {
    const user = globalThis.TestData.getUser(userType)
    await loginPage.login(user.username, user.password)
})

Then(/^I should see a flash message saying (.*)$/, async (message: string) => {
    await expect(securePage.flashAlert).toBeExisting()
    await expect(securePage.flashAlert).toHaveText(expect.stringContaining(message))
})
