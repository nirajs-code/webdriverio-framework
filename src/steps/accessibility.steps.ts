import { Then } from '@wdio/cucumber-framework'

import {
    runAxe,
    runAxeForStandard,
    assertNoViolations,
    assertNoViolationsByImpact,
    attachAxeResults,
    type AxeImpact,
} from '../lib/axe-utils'

// ─── Full-page audits ─────────────────────────────────────────────────────────

Then(/^the page should have no accessibility violations$/, async () => {
    const results = await runAxe()
    attachAxeResults(results)
    assertNoViolations(results)
})

Then(
    /^the page should have no "(minor|moderate|serious|critical)" or above accessibility violations$/,
    async (impact: AxeImpact) => {
        const results = await runAxe()
        attachAxeResults(results)
        assertNoViolationsByImpact(results, impact)
    }
)

// ─── WCAG standard ────────────────────────────────────────────────────────────
//
// Usage:
//   Then the page should conform to "WCAG 2.1 AA"
//   Then the page should conform to "Section 508"

Then(/^the page should conform to "([^"]+)"$/, async (standard: string) => {
    const results = await runAxeForStandard(standard)
    attachAxeResults(results)
    assertNoViolations(results)
})

Then(
    /^the page should conform to "([^"]+)" with no "(minor|moderate|serious|critical)" or above violations$/,
    async (standard: string, impact: AxeImpact) => {
        const results = await runAxeForStandard(standard)
        attachAxeResults(results)
        assertNoViolationsByImpact(results, impact)
    }
)

// ─── Scoped audits ────────────────────────────────────────────────────────────

Then(/^the "([^"]+)" region should have no accessibility violations$/, async (selector: string) => {
    const results = await runAxe({ include: [selector] })
    attachAxeResults(results)
    assertNoViolations(results)
})

Then(/^the page should have no accessibility violations excluding "([^"]+)"$/, async (selector: string) => {
    const results = await runAxe({ exclude: selector.split(',').map(s => s.trim()) })
    attachAxeResults(results)
    assertNoViolations(results)
})

// ─── Component / tag-filtered audits ─────────────────────────────────────────

Then(/^the page should have no "(wcag2a|wcag2aa|wcag21aa|wcag22aa|best-practice)" violations$/, async (tag: string) => {
    const results = await runAxe({ tags: [tag] })
    attachAxeResults(results)
    assertNoViolations(results)
})

// ─── Soft audit (attach only, no assertion) ───────────────────────────────────
//
// Use when you want visibility into violations without failing the scenario —
// useful for exploratory/baseline runs before enforcing a standard.

Then(/^I audit the page for accessibility violations$/, async () => {
    const results = await runAxe()
    attachAxeResults(results)

    if (results.violations.length > 0) {
        console.warn(
            `  ⚠ ${results.violations.length} accessibility violation(s) found (not failing — audit-only step)`
        )
    } else {
        console.log('  ✓ No accessibility violations found')
    }
})

// ─── DataTable: multi-region scoped audit ─────────────────────────────────────
//
// Audits a list of page regions independently.
//
//   Then each region should have no accessibility violations:
//     | header  |
//     | main    |
//     | footer  |

Then(/^each region should have no accessibility violations:$/, async (table: { rawTable: string[][] }) => {
    const selectors = table.rawTable
        .flat()
        .map(s => s.trim())
        .filter(Boolean)
    const failures: string[] = []

    for (const selector of selectors) {
        const results = await runAxe({ include: [selector] })
        attachAxeResults(results)
        if (results.violations.length > 0) {
            failures.push(`"${selector}": ${results.violations.length} violation(s)`)
        }
    }

    if (failures.length > 0) {
        throw new Error(`Accessibility violations in:\n${failures.map(f => `  • ${f}`).join('\n')}`)
    }
})
