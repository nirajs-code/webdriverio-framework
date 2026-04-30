/// <reference types="@wdio/globals/types" />
import * as fs from 'fs'
import * as path from 'path'

import { timeOut } from './wdio-utils'

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Navigates to the URL and waits for the page to reach readyState "complete".
 */
export const navigateTo = async (url: string, timeout = timeOut.long): Promise<void> => {
    await browser.url(url)
    await browser.waitUntil(() => browser.execute(() => document.readyState === 'complete'), {
        timeout,
        timeoutMsg: `Page did not reach readyState "complete" within ${timeout}ms`,
    })
}

export const getTitle = (): Promise<string> => browser.getTitle()

export const getCurrentUrl = (): Promise<string> => browser.getUrl()

/**
 * Waits for the current URL to include the given string or match the regex.
 */
export const waitForUrl = async (expected: string | RegExp, timeout = timeOut.standard): Promise<void> => {
    await browser.waitUntil(
        async () => {
            const url = await browser.getUrl()
            return typeof expected === 'string' ? url.includes(expected) : expected.test(url)
        },
        { timeout, timeoutMsg: `URL did not match "${String(expected)}" within ${timeout}ms` }
    )
}

/**
 * Waits for the page title to include the given string or match the regex.
 */
export const waitForTitle = async (expected: string | RegExp, timeout = timeOut.standard): Promise<void> => {
    await browser.waitUntil(
        async () => {
            const title = await browser.getTitle()
            return typeof expected === 'string' ? title.includes(expected) : expected.test(title)
        },
        { timeout, timeoutMsg: `Title did not match "${String(expected)}" within ${timeout}ms` }
    )
}

// ─── Tabs / Windows ───────────────────────────────────────────────────────────

/**
 * Opens a new tab (optionally navigating to a URL) and returns its window handle.
 */
export const openNewTab = async (url = 'about:blank'): Promise<string> => {
    await browser.newWindow(url)
    const handles = await browser.getWindowHandles()
    return handles[handles.length - 1]
}

/**
 * Switches to a tab by numeric index (0-based) or by its window handle string.
 */
export const switchToTab = async (handleOrIndex: string | number): Promise<void> => {
    if (typeof handleOrIndex === 'number') {
        const handles = await browser.getWindowHandles()
        if (handleOrIndex >= handles.length) {
            throw new Error(`Tab index ${handleOrIndex} out of range — ${handles.length} tab(s) open`)
        }
        await browser.switchToWindow(handles[handleOrIndex])
    } else {
        await browser.switchToWindow(handleOrIndex)
    }
}

/**
 * Closes the current tab and switches back to the previous one.
 */
export const closeCurrentTab = async (): Promise<void> => {
    const handles = await browser.getWindowHandles()
    await browser.closeWindow()
    if (handles.length > 1) {
        await browser.switchToWindow(handles[handles.length - 2])
    }
}

export const getWindowHandles = (): Promise<string[]> => browser.getWindowHandles()

// ─── Frames ───────────────────────────────────────────────────────────────────

/**
 * Switches context into the given iframe element.
 */
export const switchToFrame = async (frameElement: WebdriverIO.Element): Promise<void> => {
    await browser.switchToFrame(frameElement)
}

/**
 * Switches back to the top-level browsing context from inside a frame.
 */
export const switchToMainFrame = async (): Promise<void> => {
    await browser.switchToFrame(null)
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const getAlertText = (): Promise<string> => browser.getAlertText()

export const acceptAlert = async (text?: string): Promise<void> => {
    if (text !== undefined) await browser.sendAlertText(text)
    await browser.acceptAlert()
}

export const dismissAlert = (): Promise<void> => browser.dismissAlert()

// ─── Cookies ──────────────────────────────────────────────────────────────────

export interface Cookie {
    name: string
    value: string
    path?: string
    domain?: string
    secure?: boolean
    httpOnly?: boolean
    expiry?: number
    sameSite?: 'strict' | 'lax' | 'none'
}

export const getCookie = (name: string): Promise<Cookie | undefined> =>
    browser.getCookies([name]).then(cookies => cookies[0] as Cookie | undefined)

export const setCookie = (
    name: string,
    value: string,
    options?: Partial<Omit<Cookie, 'name' | 'value'>>
): Promise<void> => browser.setCookies([{ name, value, ...options }])

export const deleteCookie = (name: string): Promise<void> => browser.deleteCookies([name])

export const clearCookies = (): Promise<void> => browser.deleteCookies()

// ─── Storage ──────────────────────────────────────────────────────────────────

export const clearLocalStorage = (): Promise<unknown> => browser.execute(() => localStorage.clear())

export const clearSessionStorage = (): Promise<unknown> => browser.execute(() => sessionStorage.clear())

/**
 * Clears both localStorage and sessionStorage in one call.
 */
export const clearStorage = async (): Promise<void> => {
    await clearLocalStorage()
    await clearSessionStorage()
}

export const getLocalStorageItem = (key: string): Promise<string | null> =>
    browser.execute((k: string) => localStorage.getItem(k), key)

export const setLocalStorageItem = (key: string, value: string): Promise<unknown> =>
    browser.execute((k: string, v: string) => localStorage.setItem(k, v), key, value)

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Reloads the browser session with up to `retries` attempts.
 * A fresh session clears cookies, storage, and all open tabs.
 */
export const reloadSession = async (retries = 3): Promise<void> => {
    if (!Number.isInteger(retries) || retries < 1) {
        throw new Error(`reloadSession requires retries >= 1 (received: ${retries})`)
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await browser.reloadSession()
            return
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            if (attempt === retries) {
                throw new Error(`Session reload failed after ${retries} attempts: ${msg}`)
            }
            console.warn(`[reloadSession] Attempt ${attempt}/${retries} failed — retrying`)
            await browser.pause(1000)
        }
    }
}

// ─── Script execution ─────────────────────────────────────────────────────────

/**
 * Executes a script in the browser context and returns the result.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const executeScript = (script: string | ((...args: any[]) => any), ...args: unknown[]): Promise<unknown> =>
    browser.execute(script, ...args)

/**
 * Returns the navigation timing entry as a plain object.
 * Uses the modern PerformanceNavigationTiming API (replaces deprecated performance.timing).
 */
export const getPerformanceTiming = (): Promise<PerformanceNavigationTiming | null> =>
    browser.execute(() => {
        const entries = performance.getEntriesByType('navigation')
        return entries.length > 0 ? (JSON.parse(JSON.stringify(entries[0])) as PerformanceNavigationTiming) : null
    })

// ─── Screenshots ──────────────────────────────────────────────────────────────

/**
 * Saves a PNG screenshot to `filePath`.
 * Creates parent directories automatically.
 * Defaults to `.tmp/screenshots/<timestamp>.png`.
 */
export const takeScreenshot = async (filePath?: string): Promise<string> => {
    const target = filePath ?? path.resolve(process.cwd(), '.tmp', 'screenshots', `screenshot-${Date.now()}.png`)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    await browser.saveScreenshot(target)
    return target
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/**
 * Controlled pause. Prefer waitForElement / waitUntil for element-level waits;
 * use this only when waiting for a non-element condition with no polling hook.
 */
export const pause = (ms: number): Promise<void> => browser.pause(ms)

export const getWindowSize = (): Promise<{ width: number; height: number }> => browser.getWindowSize()

export const setWindowSize = (width: number, height: number): Promise<void> => browser.setWindowSize(width, height)
