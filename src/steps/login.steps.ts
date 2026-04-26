import { Given, When, Then } from '@wdio/cucumber-framework'
import { expect } from '@wdio/globals'
import * as path from 'path'

import LoginPage from '../pages/login.page'
import SecurePage from '../pages/secure.page'

const env = process.env.ENV || 'test'
const envConfig = require(path.resolve(__dirname, `../../conf/env/${env}/config.json`))

const pages: Record<string, typeof LoginPage> = {
    login: LoginPage
}

Given(/^I am on the (\w+) page$/, async (page: string) => {
    if (!pages[page]) throw new Error(`No page object found for "${page}"`)
    await pages[page].open()
})

When(/^I login with (\w+)$/, async (userType: string) => {
    const user = envConfig.testData[userType]
    if (!user) throw new Error(`No test data found for user type "${userType}"`)
    await LoginPage.login(user.username, user.password)
})

Then(/^I should see a flash message saying (.*)$/, async (message: string) => {
    await expect(SecurePage.flashAlert).toBeExisting()
    await expect(SecurePage.flashAlert).toHaveText(expect.stringContaining(message))
})
