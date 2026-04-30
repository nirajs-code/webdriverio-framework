/// <reference types="@wdio/globals/types" />
import allureReporter from '@wdio/allure-reporter'
import * as fs from 'fs'
import * as path from 'path'
import CucumberJSON from 'wdio-cucumberjs-json-reporter'

import { LIGHTHOUSE_REPORT_PATH } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LighthouseAuditOptions {
    networkThrottling?:
        | 'online'
        | 'GPRS'
        | 'Regular 2G'
        | 'Good 2G'
        | 'Regular 3G'
        | 'Good 3G'
        | 'Regular 4G'
        | 'DSL'
        | 'Wifi'

    cpuThrottling?: number
    cacheEnabled?: boolean
    formFactor?: 'desktop' | 'mobile'
}

export interface LighthouseMetrics {
    timeToFirstByte: number
    serverResponseTime: number
    domContentLoaded: number
    load: number
    firstPaint: number
    firstContentfulPaint: number
    firstMeaningfulPaint: number
    largestContentfulPaint: number
    interactive: number
    totalBlockingTime: number
    cumulativeLayoutShift: number
    speedIndex: number
    numRequests: number
    numScripts: number
    numStylesheets: number
    numFonts: number
    totalTaskTime: number
}

export interface PerformanceBudget {
    performanceScore?: number // 0–1 (e.g. 0.9 = 90)
    firstContentfulPaint?: number // ms
    largestContentfulPaint?: number // ms
    interactive?: number // ms (TTI)
    totalBlockingTime?: number // ms
    cumulativeLayoutShift?: number // score (0–1, lower is better)
    timeToFirstByte?: number // ms
    speedIndex?: number // ms
}

export interface CoreWebVitals {
    fcp: number
    lcp: number
    ttfb: number
    tbt: number
    cls: number
    performanceScore: number
    rating: {
        fcp: 'good' | 'needs-improvement' | 'poor'
        lcp: 'good' | 'needs-improvement' | 'poor'
        ttfb: 'good' | 'needs-improvement' | 'poor'
        cls: 'good' | 'needs-improvement' | 'poor'
    }
}

// Typed overlay for browser — lighthouse service injects these at runtime.
type LighthouseBrowser = typeof browser & {
    enablePerformanceAudits(opts?: LighthouseAuditOptions): Promise<void>
    disablePerformanceAudits(): Promise<void>
    getMetrics(): Promise<LighthouseMetrics>
    getPerformanceScore(): Promise<number>
    getDiagnostics(): Promise<Record<string, unknown>>
    getMainThreadWorkBreakdown(): Promise<Array<{ group: string; duration: number }>>
}

const lb = (): LighthouseBrowser => browser as LighthouseBrowser

const formatScorePercent = (score: number): string => (score * 100).toFixed(0)

// ─── CWV rating helpers (Core Web Vitals thresholds from web.dev) ─────────────

function rateFcp(ms: number) {
    return ms < 1_800 ? 'good' : ms < 3_000 ? 'needs-improvement' : 'poor'
}
function rateLcp(ms: number) {
    return ms < 2_500 ? 'good' : ms < 4_000 ? 'needs-improvement' : 'poor'
}
function rateTtfb(ms: number) {
    return ms < 800 ? 'good' : ms < 1_800 ? 'needs-improvement' : 'poor'
}
function rateCls(score: number) {
    return score < 0.1 ? 'good' : score < 0.25 ? 'needs-improvement' : 'poor'
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Enables lighthouse performance auditing for the current browser session.
 * Must be called before navigating to the page under test.
 */
export const enableAudits = (opts?: LighthouseAuditOptions): Promise<void> => lb().enablePerformanceAudits(opts)

/**
 * Disables lighthouse auditing and releases the CDP session resources.
 */
export const disableAudits = (): Promise<void> => lb().disablePerformanceAudits()

export const getMetrics = (): Promise<LighthouseMetrics> => lb().getMetrics()

/** Returns the overall lighthouse performance score (0–1). */
export const getPerformanceScore = (): Promise<number> => lb().getPerformanceScore()

export const getDiagnostics = (): Promise<Record<string, unknown>> => lb().getDiagnostics()

export const getThreadBreakdown = () => lb().getMainThreadWorkBreakdown()

/**
 * Returns the key Core Web Vitals with human-readable ratings.
 */
export const getCoreWebVitals = async (): Promise<CoreWebVitals> => {
    const [metrics, score] = await Promise.all([getMetrics(), getPerformanceScore()])
    const {
        firstContentfulPaint: fcp,
        largestContentfulPaint: lcp,
        timeToFirstByte: ttfb,
        totalBlockingTime: tbt,
        cumulativeLayoutShift: cls,
    } = metrics

    return {
        fcp,
        lcp,
        ttfb,
        tbt,
        cls,
        performanceScore: score,
        rating: {
            fcp: rateFcp(fcp),
            lcp: rateLcp(lcp),
            ttfb: rateTtfb(ttfb),
            cls: rateCls(cls),
        },
    }
}

// ─── Assertion ────────────────────────────────────────────────────────────────

/**
 * Throws a descriptive error if any metric exceeds the given budget.
 */
export const assertPerformanceBudget = async (budget: PerformanceBudget): Promise<void> => {
    const [metrics, score] = await Promise.all([getMetrics(), getPerformanceScore()])
    const failures: string[] = []

    const check = (label: string, actual: number, limit: number, unit = 'ms') => {
        if (actual > limit) failures.push(`${label}: ${actual.toFixed(0)}${unit} (budget: ${limit}${unit})`)
    }

    if (budget.performanceScore !== undefined && score < budget.performanceScore) {
        failures.push(
            `Performance score: ${formatScorePercent(score)} (budget: ${formatScorePercent(budget.performanceScore)})`
        )
    }
    if (budget.firstContentfulPaint) check('FCP', metrics.firstContentfulPaint, budget.firstContentfulPaint)
    if (budget.largestContentfulPaint) check('LCP', metrics.largestContentfulPaint, budget.largestContentfulPaint)
    if (budget.interactive) check('TTI', metrics.interactive, budget.interactive)
    if (budget.totalBlockingTime) check('TBT', metrics.totalBlockingTime, budget.totalBlockingTime)
    if (budget.timeToFirstByte) check('TTFB', metrics.timeToFirstByte, budget.timeToFirstByte)
    if (budget.speedIndex) check('SI', metrics.speedIndex, budget.speedIndex)
    if (budget.cumulativeLayoutShift !== undefined && metrics.cumulativeLayoutShift > budget.cumulativeLayoutShift) {
        failures.push(`CLS: ${metrics.cumulativeLayoutShift.toFixed(3)} (budget: ${budget.cumulativeLayoutShift})`)
    }

    if (failures.length > 0) {
        throw new Error(`Performance budget exceeded:\n${failures.map(f => `  • ${f}`).join('\n')}`)
    }
}

// ─── Reporting ────────────────────────────────────────────────────────────────

/**
 * Generates a styled HTML report from lighthouse metrics and saves it to disk.
 * The @pageperf + @lighthouse hook in hooks.ts will open this file, screenshot
 * it, attach it to reports, then delete it.
 */
export const saveLighthouseReport = async (): Promise<string> => {
    const [metrics, score, url] = await Promise.all([getMetrics(), getPerformanceScore(), browser.getUrl()])

    const scorePercent = formatScorePercent(score)
    const scoreColour = score >= 0.9 ? '#0cce6b' : score >= 0.5 ? '#ffa400' : '#ff4e42'

    const row = (label: string, value: string, rating?: string) => {
        const colour =
            rating === 'good'
                ? '#0cce6b'
                : rating === 'needs-improvement'
                  ? '#ffa400'
                  : rating === 'poor'
                    ? '#ff4e42'
                    : '#555'
        return `<tr><td>${label}</td><td style="color:${colour};font-weight:600">${value}</td></tr>`
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lighthouse Report — ${url}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #f5f5f5; color: #333; }
    header { background: #1a1a2e; color: #fff; padding: 24px 32px; }
    header h1 { margin: 0; font-size: 20px; }
    header p  { margin: 4px 0 0; font-size: 13px; opacity: .7; }
    .score-ring { display:inline-block; width:80px; height:80px; border-radius:50%;
                  border: 6px solid ${scoreColour}; line-height:68px; text-align:center;
                  font-size:22px; font-weight:700; color:${scoreColour}; margin: 16px 0; }
    .card { background:#fff; border-radius:8px; padding:24px 32px; margin:16px; box-shadow:0 1px 4px rgba(0,0,0,.1); }
    table { border-collapse:collapse; width:100%; }
    td    { padding:8px 4px; border-bottom:1px solid #eee; font-size:14px; }
    td:first-child { color:#555; width:240px; }
    h2 { font-size:16px; margin:0 0 16px; }
  </style>
</head>
<body>
  <header>
    <h1>Lighthouse Performance Report</h1>
    <p>${url} &mdash; ${new Date().toLocaleString()}</p>
  </header>
  <div class="card">
    <h2>Overall Score</h2>
    <div class="score-ring">${scorePercent}</div>
  </div>
  <div class="card">
    <h2>Core Web Vitals</h2>
    <table>
      ${row('First Contentful Paint (FCP)', `${metrics.firstContentfulPaint.toFixed(0)} ms`, rateFcp(metrics.firstContentfulPaint))}
      ${row('Largest Contentful Paint (LCP)', `${metrics.largestContentfulPaint.toFixed(0)} ms`, rateLcp(metrics.largestContentfulPaint))}
      ${row('Time to First Byte (TTFB)', `${metrics.timeToFirstByte.toFixed(0)} ms`, rateTtfb(metrics.timeToFirstByte))}
      ${row('Total Blocking Time (TBT)', `${metrics.totalBlockingTime.toFixed(0)} ms`)}
      ${row('Cumulative Layout Shift (CLS)', metrics.cumulativeLayoutShift.toFixed(3), rateCls(metrics.cumulativeLayoutShift))}
      ${row('Speed Index', `${metrics.speedIndex.toFixed(0)} ms`)}
      ${row('Time to Interactive (TTI)', `${metrics.interactive.toFixed(0)} ms`)}
    </table>
  </div>
  <div class="card">
    <h2>Resource Summary</h2>
    <table>
      ${row('DOM Content Loaded', `${metrics.domContentLoaded.toFixed(0)} ms`)}
      ${row('Page Load', `${metrics.load.toFixed(0)} ms`)}
      ${row('Total Task Time', `${metrics.totalTaskTime.toFixed(0)} ms`)}
      ${row('Requests', String(metrics.numRequests))}
      ${row('Scripts', String(metrics.numScripts))}
      ${row('Stylesheets', String(metrics.numStylesheets))}
      ${row('Fonts', String(metrics.numFonts))}
    </table>
  </div>
</body>
</html>`

    fs.mkdirSync(path.dirname(LIGHTHOUSE_REPORT_PATH), { recursive: true })
    fs.writeFileSync(LIGHTHOUSE_REPORT_PATH, html, 'utf-8')
    return LIGHTHOUSE_REPORT_PATH
}

/**
 * Attaches the Core Web Vitals summary directly to both Allure and the
 * cucumber JSON report without generating a separate HTML file.
 */
export const attachCwvSummary = async (): Promise<void> => {
    const cwv = await getCoreWebVitals()
    const text = [
        `Performance Score : ${formatScorePercent(cwv.performanceScore)}`,
        `FCP  : ${cwv.fcp.toFixed(0)} ms  [${cwv.rating.fcp}]`,
        `LCP  : ${cwv.lcp.toFixed(0)} ms  [${cwv.rating.lcp}]`,
        `TTFB : ${cwv.ttfb.toFixed(0)} ms  [${cwv.rating.ttfb}]`,
        `TBT  : ${cwv.tbt.toFixed(0)} ms`,
        `CLS  : ${cwv.cls.toFixed(3)}  [${cwv.rating.cls}]`,
    ].join('\n')

    void CucumberJSON.attach(text, 'text/plain')
    void allureReporter.addAttachment('Core Web Vitals', Buffer.from(text), 'text/plain')
}

/**
 * Convenience wrapper: enables audits, runs the async action, saves the HTML
 * report, then disables audits — even if the action throws.
 */
export const withAudits = async (action: () => Promise<void>, opts?: LighthouseAuditOptions): Promise<void> => {
    await enableAudits(opts)
    try {
        await action()
        await saveLighthouseReport()
    } finally {
        await disableAudits()
    }
}
