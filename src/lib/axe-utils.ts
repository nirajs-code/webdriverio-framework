/// <reference types="@wdio/globals/types" />
import AxeBuilder from '@axe-core/webdriverio'
import allureReporter from '@wdio/allure-reporter'
import CucumberJSON from 'wdio-cucumberjs-json-reporter'

// ─── Types ────────────────────────────────────────────────────────────────────

// Derive all types from @axe-core/webdriverio's own bundled axe-core to avoid
// the structural mismatch between the bundled v4.11 and lighthouse's v4.2.
export type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>
type AxeViolation = AxeResults['violations'][number]
type AxeNode = AxeViolation['nodes'][number]

export type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical'

export interface AxeOptions {
    /** WCAG / best-practice tag filters. Defaults to ['wcag2a', 'wcag2aa']. */
    tags?: string[]
    /** CSS selectors to exclude from analysis. */
    exclude?: string[]
    /** CSS selectors to constrain analysis to (analyses whole page if omitted). */
    include?: string[]
    /** Rule-level overrides, e.g. { 'color-contrast': { enabled: false } }. */
    rules?: Record<string, { enabled: boolean }>
}

/** Maps WCAG conformance level names to the axe tag sets they correspond to. */
const WCAG_TAG_MAP: Record<string, string[]> = {
    'WCAG 2.0 A': ['wcag2a'],
    'WCAG 2.0 AA': ['wcag2a', 'wcag2aa'],
    'WCAG 2.1 A': ['wcag2a', 'wcag21a'],
    'WCAG 2.1 AA': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    'WCAG 2.2 AA': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    'Section 508': ['section508'],
    'best-practice': ['best-practice'],
}

const IMPACT_ORDER: AxeImpact[] = ['minor', 'moderate', 'serious', 'critical']

// ─── Run ──────────────────────────────────────────────────────────────────────

/**
 * Runs axe-core against the current page and returns the full results object.
 * Defaults to WCAG 2.0 AA (wcag2a + wcag2aa) unless overridden via options.tags.
 */
export const runAxe = async (options: AxeOptions = {}): Promise<AxeResults> => {
    const { tags = ['wcag2a', 'wcag2aa'], exclude = [], include = [], rules = {} } = options

    let builder = new AxeBuilder({ client: browser }).withTags(tags)

    for (const selector of exclude) builder = builder.exclude(selector)
    for (const selector of include) builder = builder.include(selector)

    if (Object.keys(rules).length > 0) {
        builder = builder.options({ rules })
    }

    return builder.analyze()
}

/**
 * Runs axe against the current page for a named WCAG conformance level.
 * Level must match a key in WCAG_TAG_MAP (e.g. 'WCAG 2.1 AA').
 */
export const runAxeForStandard = async (
    standard: string,
    options: Omit<AxeOptions, 'tags'> = {}
): Promise<AxeResults> => {
    const tags = WCAG_TAG_MAP[standard]
    if (!tags) throw new Error(`Unknown standard "${standard}". Valid values: ${Object.keys(WCAG_TAG_MAP).join(', ')}`)
    return runAxe({ ...options, tags })
}

// ─── Format ───────────────────────────────────────────────────────────────────

const formatNode = (node: AxeNode, idx: number): string => {
    const target = Array.isArray(node.target) ? node.target.join(' > ') : String(node.target)
    const summary = node.failureSummary?.split('\n')[0] ?? ''
    return `      ${idx + 1}) ${target}\n         ${summary}`
}

const formatViolation = (v: AxeViolation, idx: number): string =>
    [
        `  ${idx + 1}. [${(v.impact ?? 'unknown').toUpperCase()}] ${v.id}`,
        `     ${v.help}`,
        `     ${v.helpUrl}`,
        ...v.nodes.map((n, i) => formatNode(n, i)),
    ].join('\n')

export const formatViolations = (violations: AxeViolation[]): string => violations.map(formatViolation).join('\n\n')

// ─── Assert ───────────────────────────────────────────────────────────────────

/**
 * Throws a descriptive error listing every violation.
 * Use after runAxe() when any violation should fail the scenario.
 */
export const assertNoViolations = (results: AxeResults): void => {
    const { violations } = results
    if (violations.length === 0) return
    throw new Error(
        `${violations.length} accessibility violation(s) found on ${results.url}:\n\n` + formatViolations(violations)
    )
}

/**
 * Throws only when violations meet or exceed the given impact level.
 * e.g. assertNoViolationsByImpact(results, 'serious') ignores minor/moderate.
 */
export const assertNoViolationsByImpact = (results: AxeResults, minImpact: AxeImpact): void => {
    const threshold = IMPACT_ORDER.indexOf(minImpact)
    const filtered = results.violations.filter(v => {
        const idx = IMPACT_ORDER.indexOf(v.impact ?? 'minor')
        return idx >= threshold
    })
    if (filtered.length === 0) return
    throw new Error(
        `${filtered.length} violation(s) at "${minImpact}" impact or above on ${results.url}:\n\n` +
            formatViolations(filtered)
    )
}

// ─── Reporting ────────────────────────────────────────────────────────────────

const buildSummaryText = (results: AxeResults): string => {
    const counts = (arr: AxeViolation[]) =>
        IMPACT_ORDER.reduce(
            (acc, imp) => {
                const n = arr.filter(v => v.impact === imp).length
                return n ? { ...acc, [imp]: n } : acc
            },
            {} as Record<string, number>
        )

    const violationCounts = counts(results.violations)
    const lines = [
        `URL           : ${results.url}`,
        `Violations    : ${results.violations.length}`,
        `Passes        : ${results.passes.length}`,
        `Incomplete    : ${results.incomplete.length}`,
        `Inapplicable  : ${results.inapplicable.length}`,
    ]

    if (results.violations.length > 0) {
        lines.push('')
        lines.push('Violations by impact:')
        IMPACT_ORDER.forEach(imp => {
            if (violationCounts[imp]) lines.push(`  ${imp.padEnd(10)}: ${violationCounts[imp]}`)
        })
        lines.push('')
        lines.push('Detail:')
        lines.push(formatViolations(results.violations))
    }

    return lines.join('\n')
}

/**
 * Attaches the full axe results summary to both Allure and the cucumber JSON report.
 * Call this after runAxe() regardless of pass/fail so evidence is always captured.
 */
export const attachAxeResults = (results: AxeResults): void => {
    const summary = buildSummaryText(results)
    const label =
        results.violations.length === 0 ? 'Axe — No Violations' : `Axe — ${results.violations.length} Violation(s)`

    void CucumberJSON.attach(summary, 'text/plain')
    void allureReporter.addAttachment(label, Buffer.from(summary), 'text/plain')

    // Add an Allure label so the report can be filtered by a11y status
    void allureReporter.addLabel('accessibility', results.violations.length === 0 ? 'pass' : 'fail')
}

/**
 * Runs axe, attaches the results, then asserts no violations exist.
 * One-liner for the common "run and fail fast" case.
 */
export const auditAndAssert = async (options: AxeOptions = {}, minImpact?: AxeImpact): Promise<AxeResults> => {
    const results = await runAxe(options)
    attachAxeResults(results)
    if (minImpact) {
        assertNoViolationsByImpact(results, minImpact)
    } else {
        assertNoViolations(results)
    }
    return results
}

/**
 * Reads the axe-core runtime version from the active page context.
 * Returns null when axe has not been injected into the page yet.
 */
export const getAxeVersion = (): Promise<string | null> =>
    browser.execute(() => {
        const w = window as Window & { axe?: { version?: string } }
        return w.axe?.version ?? null
    })

/**
 * Ensures the injected axe runtime matches the expected major/minor prefix.
 * Use this as an optional smoke check to catch dependency drift early.
 */
export const assertAxeVersion = async (expectedPrefix = '4.11'): Promise<void> => {
    const version = await getAxeVersion()
    if (!version) return
    if (!version.startsWith(expectedPrefix)) {
        throw new Error(`Unsupported axe-core version "${version}" (expected prefix "${expectedPrefix}")`)
    }
}
