/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

import { getCookie, setCookie, deleteCookie, clearCookies } from '../lib/browser-utils'
import type { Cookie } from '../lib/browser-utils'
import { PAGE_LOAD_TIMEOUT } from '../lib/constants'

export default class basePage {
    // ─── Navigation ───────────────────────────────────────────────────────────

    /**
     * Navigates to a path relative to baseUrl (e.g. 'login', 'dashboard').
     * Used by child pages via super.open('path').
     */
    async open(path: string): Promise<void> {
        await browser.url(path)
    }

    /**
     * Navigates to an absolute URL and waits for the page to fully load.
     */
    async navigateTo(url: string): Promise<void> {
        await browser.url(url)
        await browser.waitUntil(() => browser.execute(() => document.readyState === 'complete'), {
            timeout: PAGE_LOAD_TIMEOUT,
            timeoutMsg: 'Page did not reach readyState "complete" within 30s',
        })
    }

    /**
     * Hard-refreshes the current page (equivalent to F5).
     */
    async refresh(): Promise<void> {
        await browser.refresh()
    }

    // ─── Cookies ──────────────────────────────────────────────────────────────

    /**
     * Returns true if a cookie with the given name exists in the current session.
     */
    async checkCookiesExists(name: string): Promise<boolean> {
        const cookie = await getCookie(name)
        return cookie !== undefined
    }

    /**
     * Deletes a specific cookie by name, or all cookies when called with no argument.
     */
    async deleteCookies(name?: string): Promise<void> {
        if (name) {
            await deleteCookie(name)
        } else {
            await clearCookies()
        }
    }

    /**
     * Creates or overwrites a cookie. The cookie is scoped to the current domain
     * unless `options.domain` is specified.
     */
    async updateCookies(name: string, value: string, options?: Partial<Omit<Cookie, 'name' | 'value'>>): Promise<void> {
        await setCookie(name, value, options)
    }
}
