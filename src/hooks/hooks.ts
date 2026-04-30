/// <reference types="@wdio/globals/types" />
import type { ITestCaseHookParameter } from '@cucumber/cucumber'
import allureReporter from '@wdio/allure-reporter'
import { Before, After } from '@wdio/cucumber-framework'
import * as fs from 'fs'
import CucumberJSON from 'wdio-cucumberjs-json-reporter'

import { LIGHTHOUSE_REPORT_PATH, PERF_RESULTS_FOLDER } from '../lib/constants'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scenarioTags(scenario: ITestCaseHookParameter): string[] {
    return scenario.pickle.tags.map(t => t.name)
}

async function attachScreenshot(label: string): Promise<void> {
    const base64 = await browser.takeScreenshot()
    await Promise.resolve(CucumberJSON.attach(base64, 'image/png'))
    await Promise.resolve(allureReporter.addAttachment(label, Buffer.from(base64, 'base64'), 'image/png'))
}

// ─── Before ───────────────────────────────────────────────────────────────────

Before(function (scenario: ITestCaseHookParameter) {
    const name = scenario.pickle.name
    const tags = scenarioTags(scenario).join(', ')
    console.log(`\n▶ Scenario: ${name}${tags ? `  [${tags}]` : ''}`)
})

// ─── After (general) ──────────────────────────────────────────────────────────
//
// Runs after every scenario.
// Passed  → logs a checkmark.
// Failed  → attaches the BrowserStack session ID and a failure screenshot
//           so CI has instant forensics without digging through logs.

After(async function (scenario: ITestCaseHookParameter) {
    const { status, message } = scenario.result ?? {}
    const name = scenario.pickle.name
    const passedStatus = 'PASSED' as typeof status
    const failedStatus = 'FAILED' as typeof status

    if (status === passedStatus) {
        console.log(`  ✓ ${name}`)
        return
    }

    if (status === failedStatus) {
        console.error(`  ✗ ${name}`)
        if (message) console.error(`    ${message}`)

        // BrowserStack: surface the session link for instant replay.
        // The session URL is only meaningful when BS_USER / BS_KEY are set.
        const sessionId = browser.sessionId
        if (sessionId && process.env.BROWSERSTACK_USERNAME) {
            const sessionUrl =
                `https://automate.browserstack.com/builds/` +
                `${process.env.BUILD_NAME ?? 'unknown'}/sessions/${sessionId}`
            await Promise.resolve(CucumberJSON.attach(`BrowserStack session: ${sessionUrl}`, 'text/plain'))
            await Promise.resolve(allureReporter.addLink(sessionUrl, 'BrowserStack Session', 'other'))
        }

        // Screenshot into both the cucumber JSON and Allure reports so the
        // failure is visible in every report format without extra setup.
        await attachScreenshot('Failure Screenshot')
    }
})

// ─── After @pageperf ──────────────────────────────────────────────────────────
//
// Runs only for scenarios tagged @pageperf.
// Splits into two paths based on whether @lighthouse is also present.
//
//  @pageperf + @lighthouse
//    The lighthouse service leaves a local HTML report file on disk.
//    We reload the session (lighthouse can leave the browser in an odd state),
//    open the report via file://, screenshot it, attach it, then delete the file.
//
//  @pageperf (no @lighthouse)
//    A generic performance flow that left results in a local folder.
//    Screenshot the current page (performance results UI), attach, then wipe the folder.

After({ tags: '@pageperf' }, async function (scenario: ITestCaseHookParameter) {
    const tags = scenarioTags(scenario)

    if (tags.includes('@lighthouse')) {
        // Reload so the fresh session can load a file:// URL cleanly.
        await browser.reloadSession()

        if (fs.existsSync(LIGHTHOUSE_REPORT_PATH)) {
            await browser.url(`file://${LIGHTHOUSE_REPORT_PATH}`)
            await browser.waitUntil(() => browser.execute(() => document.readyState === 'complete'), {
                timeout: 15_000,
                timeoutMsg: 'Lighthouse report page did not load within 15s',
            })

            await attachScreenshot('Lighthouse Report')

            // Also attach the raw HTML so the full report is in Allure.
            const html = fs.readFileSync(LIGHTHOUSE_REPORT_PATH)
            void allureReporter.addAttachment('Lighthouse HTML', html, 'text/html')

            fs.rmSync(LIGHTHOUSE_REPORT_PATH, { force: true })
        } else {
            console.warn(`[hooks] @lighthouse: report not found at ${LIGHTHOUSE_REPORT_PATH}`)
        }
    } else {
        // Generic perf: screenshot whatever the perf flow left on screen.
        await attachScreenshot('Performance Results')

        if (fs.existsSync(PERF_RESULTS_FOLDER)) {
            fs.rmSync(PERF_RESULTS_FOLDER, { recursive: true, force: true })
        }
    }
})

// ─── Cleanup: cookies & storage ───────────────────────────────────────────────
//
// Tag a scenario @clearCookies when it writes cookies or localStorage that
// must not bleed into the next scenario (e.g. remember-me tokens, cart state).
// The base afterScenario in wdio.conf does a full session reload, but when
// wdio.desktop.conf is used (which manages reloads itself) this hook is the
// safety net.

After({ tags: '@clearCookies' }, async function () {
    await browser.deleteCookies()
    await browser.execute(() => {
        localStorage.clear()
        sessionStorage.clear()
    })
})

// ─── Cleanup: accept cookies modal ────────────────────────────────────────────
//
// Tag @acceptCookies on the first scenario in a feature that hits a fresh
// domain so the consent modal is dismissed before assertions run.

Before({ tags: '@acceptCookies' }, async function () {
    const banner = $('#onetrust-accept-btn-handler')
    const exists = await banner.isExisting().catch(() => false)
    if (exists) await banner.click()
})

// ─── Cleanup: restore modified data ───────────────────────────────────────────
//
// Tag @restoreData on scenarios that change shared test data (e.g. update
// a user profile, change a setting). The teardown logs a warning — actual
// restoration logic should be added per project (API call, DB reset, etc.).

After({ tags: '@restoreData' }, function (scenario: ITestCaseHookParameter) {
    console.log(`[hooks] @restoreData teardown required for: ${scenario.pickle.name}`)
    // TODO: add project-specific data restoration here (API call, DB seed, etc.)
})
