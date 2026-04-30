import { Given, When, Then } from '@wdio/cucumber-framework'

import {
    enableAudits,
    disableAudits,
    getMetrics,
    getPerformanceScore,
    getCoreWebVitals,
    assertPerformanceBudget,
    attachCwvSummary,
    saveLighthouseReport,
    type LighthouseAuditOptions,
    type PerformanceBudget,
} from '../lib/lighthouse-utils'

// ─── Setup ────────────────────────────────────────────────────────────────────

Given(/^performance audits are enabled$/, async () => {
    await enableAudits({ formFactor: 'desktop', cacheEnabled: false })
})

Given(/^performance audits are enabled for mobile$/, async () => {
    await enableAudits({
        formFactor: 'mobile',
        cpuThrottling: 4,
        networkThrottling: 'Regular 3G',
        cacheEnabled: false,
    } satisfies LighthouseAuditOptions)
})

Given(
    /^performance audits are enabled with (.+) network and (\d+)x CPU throttle$/,
    async (network: string, cpu: string) => {
        await enableAudits({
            networkThrottling: network as LighthouseAuditOptions['networkThrottling'],
            cpuThrottling: parseInt(cpu, 10),
            cacheEnabled: false,
        })
    }
)

// ─── Navigation ───────────────────────────────────────────────────────────────

// Navigating during an active audit session is what triggers lighthouse
// data collection — the page load event is captured by the CDP listener.

When(/^I navigate to "([^"]+)" with performance tracking$/, async (url: string) => {
    await browser.url(url)
})

// ─── Score assertions ─────────────────────────────────────────────────────────

Then(/^the performance score should be above (\d+)$/, async (score: string) => {
    const actual = await getPerformanceScore()
    const threshold = parseInt(score, 10) / 100
    if (actual < threshold) {
        throw new Error(`Performance score ${(actual * 100).toFixed(0)} is below threshold ${score}`)
    }
    console.log(`  ✓ Performance score: ${(actual * 100).toFixed(0)} (threshold: ${score})`)
})

// ─── Core Web Vitals assertions ───────────────────────────────────────────────

Then(/^the page should meet core web vitals standards$/, async () => {
    const cwv = await getCoreWebVitals()
    const failures: string[] = []

    if (cwv.rating.fcp === 'poor') failures.push(`FCP  ${cwv.fcp.toFixed(0)}ms  is poor  (threshold: <3000ms)`)
    if (cwv.rating.lcp === 'poor') failures.push(`LCP  ${cwv.lcp.toFixed(0)}ms  is poor  (threshold: <4000ms)`)
    if (cwv.rating.ttfb === 'poor') failures.push(`TTFB ${cwv.ttfb.toFixed(0)}ms is poor  (threshold: <1800ms)`)
    if (cwv.rating.cls === 'poor') failures.push(`CLS  ${cwv.cls.toFixed(3)}    is poor  (threshold: <0.25)`)

    if (failures.length > 0) {
        throw new Error(
            `Core Web Vitals — ${failures.length} failing metric(s):\n${failures.map(f => `  • ${f}`).join('\n')}`
        )
    }

    await attachCwvSummary()
})

Then(/^the LCP should be below (\d+) milliseconds$/, async (ms: string) => {
    const metrics = await getMetrics()
    const limit = parseInt(ms, 10)
    if (metrics.largestContentfulPaint > limit) {
        throw new Error(`LCP ${metrics.largestContentfulPaint.toFixed(0)}ms exceeds limit of ${limit}ms`)
    }
})

Then(/^the FCP should be below (\d+) milliseconds$/, async (ms: string) => {
    const metrics = await getMetrics()
    const limit = parseInt(ms, 10)
    if (metrics.firstContentfulPaint > limit) {
        throw new Error(`FCP ${metrics.firstContentfulPaint.toFixed(0)}ms exceeds limit of ${limit}ms`)
    }
})

Then(/^the TTFB should be below (\d+) milliseconds$/, async (ms: string) => {
    const metrics = await getMetrics()
    const limit = parseInt(ms, 10)
    if (metrics.timeToFirstByte > limit) {
        throw new Error(`TTFB ${metrics.timeToFirstByte.toFixed(0)}ms exceeds limit of ${limit}ms`)
    }
})

Then(/^the TBT should be below (\d+) milliseconds$/, async (ms: string) => {
    const metrics = await getMetrics()
    const limit = parseInt(ms, 10)
    if (metrics.totalBlockingTime > limit) {
        throw new Error(`TBT ${metrics.totalBlockingTime.toFixed(0)}ms exceeds limit of ${limit}ms`)
    }
})

Then(/^the CLS should be below ([\d.]+)$/, async (threshold: string) => {
    const metrics = await getMetrics()
    const limit = parseFloat(threshold)
    if (metrics.cumulativeLayoutShift > limit) {
        throw new Error(`CLS ${metrics.cumulativeLayoutShift.toFixed(3)} exceeds limit of ${limit}`)
    }
})

// ─── Budget table assertion ───────────────────────────────────────────────────
//
// Accepts a Cucumber DataTable with rows [metric, value]:
//
//   | performanceScore      | 90    |
//   | firstContentfulPaint  | 1800  |
//   | largestContentfulPaint| 2500  |
//   | totalBlockingTime     | 300   |
//   | cumulativeLayoutShift | 0.1   |

Then(/^the page should meet the performance budget:$/, async (table: { rawTable: string[][] }) => {
    const budget: PerformanceBudget = {}
    for (const [key, value] of table.rawTable) {
        const k = key.trim() as keyof PerformanceBudget
        budget[k] = parseFloat(value)
        if (k === 'performanceScore') (budget as Record<string, number>)[k] /= 100
    }
    await assertPerformanceBudget(budget)
    console.log('  ✓ All performance budget constraints met')
})

// ─── Report ───────────────────────────────────────────────────────────────────

Then(/^a lighthouse report should be saved$/, async () => {
    const filepath = await saveLighthouseReport()
    console.log(`  ✓ Lighthouse report saved: ${filepath}`)
})

Then(/^performance audits are disabled$/, async () => {
    await disableAudits()
})
