import { $ } from '@wdio/globals'
import type { ChainablePromiseElement } from 'webdriverio'

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const timeOut = {
    short: 5_000,
    standard: 10_000,
    long: 30_000,
} as const

// ─── Internal helpers ─────────────────────────────────────────────────────────

// ChainablePromiseElement is what $() returns in WDIO v9 — it is NOT a plain
// Promise<Element> but a hybrid type that wraps all element methods as async.
// It provides getElement() to unwrap to the underlying WebdriverIO.Element.
export type ElementInput = WebdriverIO.Element | ChainablePromiseElement | string

async function resolve(elem: ElementInput): Promise<WebdriverIO.Element> {
    if (typeof elem === 'string') return $(elem).getElement()
    if ('getElement' in elem) return (elem as ChainablePromiseElement).getElement()
    return elem
}

// ─── Scroll ───────────────────────────────────────────────────────────────────

/**
 * Scrolls the element into the centre of the viewport before interacting.
 * Used internally by click/hover/setValue so interactions don't fail on
 * elements that are just outside the visible area.
 */
export const scrollIntoView = async (elem: ElementInput): Promise<void> => {
    const element = await resolve(elem)
    await element.scrollIntoView({ block: 'center', inline: 'center' })
}

// ─── Click ────────────────────────────────────────────────────────────────────

/**
 * Full-guard click: waits for the element to exist, be visible, be clickable,
 * scrolls it into view, waits for it to stop animating, then clicks.
 * Timeout budget is split across exist/displayed/clickable so no single
 * wait consumes the full budget.
 */
export const click = async (elem: ElementInput, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForExist({ timeout: timeout / 2 })
    await element.waitForDisplayed({ timeout: timeout / 4 })
    await element.waitForClickable({ timeout: timeout / 4 })
    await scrollIntoView(element)
    await element.waitForStable()
    await element.click()
}

export const doubleClick = async (elem: ElementInput, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout: timeout / 2 })
    await element.waitForClickable({ timeout: timeout / 2 })
    await scrollIntoView(element)
    await element.doubleClick()
}

export const rightClick = async (elem: ElementInput, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout: timeout / 2 })
    await element.waitForClickable({ timeout: timeout / 2 })
    await scrollIntoView(element)
    await element.click({ button: 'right' })
}

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * Clears the field then types the value character by character.
 * Prefer this over element.setValue for fields with input listeners (React, Vue)
 * because setValue sets the value property directly and may not fire onChange.
 */
export const setValue = async (elem: ElementInput, value: string, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout: timeout / 2 })
    await element.waitForEnabled({ timeout: timeout / 2 })
    await scrollIntoView(element)
    await element.clearValue()
    await element.setValue(value)
}

/**
 * Like setValue but appends to existing content instead of clearing first.
 */
export const appendValue = async (elem: ElementInput, value: string, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout: timeout / 2 })
    await element.waitForEnabled({ timeout: timeout / 2 })
    await element.addValue(value)
}

export const clearValue = async (elem: ElementInput, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout })
    await element.clearValue()
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export const getText = async (elem: ElementInput, timeout = timeOut.standard): Promise<string> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout })
    return element.getText()
}

export const getAttribute = async (
    elem: ElementInput,
    attribute: string,
    timeout = timeOut.standard
): Promise<string | null> => {
    const element = await resolve(elem)
    await element.waitForExist({ timeout })
    return element.getAttribute(attribute)
}

export const getValue = async (elem: ElementInput, timeout = timeOut.standard): Promise<string> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout })
    return element.getValue()
}

// ─── State checks ─────────────────────────────────────────────────────────────

/**
 * Returns true if the element is present in the DOM and visible within the
 * given timeout, false otherwise. Never throws.
 */
export const isDisplayed = async (elem: ElementInput, timeout = timeOut.standard): Promise<boolean> => {
    try {
        const element = await resolve(elem)
        await element.waitForDisplayed({ timeout })
        return true
    } catch {
        return false
    }
}

/**
 * Returns true if the element exists in the DOM (may be hidden) within the
 * given timeout, false otherwise. Never throws.
 */
export const isExisting = async (elem: ElementInput, timeout = timeOut.standard): Promise<boolean> => {
    try {
        const element = await resolve(elem)
        await element.waitForExist({ timeout })
        return true
    } catch {
        return false
    }
}

// ─── Wait ─────────────────────────────────────────────────────────────────────

/**
 * Waits for the element to exist and be visible, then returns it.
 * Use when you need the element reference after waiting.
 */
export const waitForElement = async (elem: ElementInput, timeout = timeOut.standard): Promise<WebdriverIO.Element> => {
    const element = await resolve(elem)
    await element.waitForExist({ timeout: timeout / 2 })
    await element.waitForDisplayed({ timeout: timeout / 2 })
    return element
}

export const waitForElementToDisappear = async (elem: ElementInput, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout, reverse: true })
}

// ─── Hover ────────────────────────────────────────────────────────────────────

export const hover = async (elem: ElementInput, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout })
    await scrollIntoView(element)
    await element.moveTo()
}

// ─── Select (dropdown) ────────────────────────────────────────────────────────

export const selectByText = async (elem: ElementInput, text: string, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout })
    await element.selectByVisibleText(text)
}

export const selectByValue = async (elem: ElementInput, value: string, timeout = timeOut.standard): Promise<void> => {
    const element = await resolve(elem)
    await element.waitForDisplayed({ timeout })
    await element.selectByAttribute('value', value)
}

// ─── Drag and drop ────────────────────────────────────────────────────────────

export const dragAndDrop = async (
    source: ElementInput,
    target: ElementInput,
    timeout = timeOut.standard
): Promise<void> => {
    const sourceEl = await resolve(source)
    const targetEl = await resolve(target)
    await sourceEl.waitForDisplayed({ timeout: timeout / 2 })
    await targetEl.waitForDisplayed({ timeout: timeout / 2 })
    await sourceEl.dragAndDrop(targetEl)
}
