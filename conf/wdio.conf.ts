/// <reference types="@wdio/globals/types" />
import type { Options, Services } from '@wdio/types'
import { config as dotenvConfig } from 'dotenv'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { localCapabilities } from './wdio.capabilities.conf'
import { reloadSession } from '../src/lib/browser-utils'
import { TestDataService } from '../src/services/TestDataService'

dotenvConfig({ path: path.resolve(__dirname, '../.env') })

// ─── Environment config ────────────────────────────────────────────────────────

// Mirrors conf/env/<ENV>/config.json.
// Only baseUrl and users are typed — everything else goes in testData.
// To add new test data: put it in config.json under "testData" and access it
// via TestDataService.get<YourType>('your_key') — no interface change needed.
export interface EnvConfig {
    baseUrl: string
    users: Record<string, { username: string; password: string }>
    testData: Record<string, unknown>
}

let cachedEnvConfig: EnvConfig | null = null

export function getEnvironmentConfig(): EnvConfig {
    if (cachedEnvConfig) return cachedEnvConfig

    const env = process.env.ENV || 'test'
    const configPath = path.resolve(__dirname, `env/${env}/config.json`)
    const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Invalid environment config at ${configPath}`)
    }
    const raw = parsed as EnvConfig

    raw.baseUrl = process.env.OVERWRITE_URL?.trim() || raw.baseUrl
    cachedEnvConfig = raw
    return cachedEnvConfig
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Returns true when the runner was invoked with --cucumberOpts.dryRun.
 * Use this to skip hooks that must not fire during a dry run (e.g. browser actions).
 */
export function isDryRun(): boolean {
    return process.argv.includes('--cucumberOpts.dryRun')
}

/**
 * Resolves once the URL responds, or rejects after timeoutMs.
 * Called in onPrepare so the whole run fails immediately if the env is down
 * rather than producing dozens of confusing connection errors.
 */
async function checkUrlAvailability(url: string, timeoutMs = 30000): Promise<void> {
    const protocol = url.startsWith('https') ? await import('https') : await import('http')

    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`Base URL "${url}" not reachable after ${timeoutMs}ms`)),
            timeoutMs
        )
        const req = protocol.get(url, () => {
            clearTimeout(timer)
            req.destroy()
            resolve()
        })
        req.on('error', (err: Error) => {
            clearTimeout(timer)
            reject(new Error(`Base URL "${url}" not available: ${err.message}`))
        })
    })
}

// ─── Tag-based spec pre-filtering ─────────────────────────────────────────────
//
// Without this, WDIO spawns a worker for every feature file and Cucumber
// discards non-matching scenarios at runtime — wasteful at scale.
// With this, only files that contain at least one scenario matching TAG are
// passed to the runner, so no unnecessary workers are ever started.

const specsGlob = path.resolve(__dirname, '../src/features/**/*.feature')
const tagExpression = process.env.TAG || ''

/**
 * Returns two-dimensional array: one entry per scenario, each entry being the
 * combined feature-level + scenario-level tags for that scenario.
 */
function extractTagGroups(content: string): string[][] {
    const featureTagMatch = content.match(/^((?:@\S+\s*)+)\n\s*Feature:/m)
    const featureTags = featureTagMatch ? (featureTagMatch[1].match(/@\S+/g) ?? []) : []

    const groups: string[][] = []
    const pattern = /((?:@\S+\s*)+)\n\s*(?:Scenario Outline|Scenario):/g
    let m: RegExpExecArray | null

    while ((m = pattern.exec(content)) !== null) {
        groups.push([...featureTags, ...(m[1].match(/@\S+/g) ?? [])])
    }

    // File has tags but no Scenario blocks (e.g. Background-only) — include it
    if (groups.length === 0 && featureTags.length > 0) groups.push(featureTags)

    return groups
}

/**
 * Evaluates a tag expression string against an array of tags.
 * Supports: @tag, not @tag, @a and @b, @a or @b (no parentheses needed for simple cases).
 */
function matchesTagExpression(tags: string[], expression: string): boolean {
    if (!expression) return true
    const expr = expression.trim()

    // 'or' has lower precedence than 'and'
    const orParts = expr.split(/\s+or\s+/i)
    if (orParts.length > 1) return orParts.some(p => matchesTagExpression(tags, p.trim()))

    const andParts = expr.split(/\s+and\s+/i)
    if (andParts.length > 1) return andParts.every(p => matchesTagExpression(tags, p.trim()))

    if (/^not\s+/i.test(expr)) return !matchesTagExpression(tags, expr.replace(/^not\s+/i, '').trim())

    return tags.includes(expr)
}

function getFilteredSpecs(): string[] {
    if (!tagExpression) return [specsGlob]

    const featuresRoot = path.resolve(__dirname, '../src/features')
    const files = fs
        .readdirSync(featuresRoot, { recursive: true })
        .filter((entry): entry is string => typeof entry === 'string')
        .filter(entry => entry.endsWith('.feature'))
        .map(entry => path.resolve(featuresRoot, entry))

    const matched = files.filter(file => {
        const content = fs.readFileSync(file, 'utf-8')
        return extractTagGroups(content).some(tags => matchesTagExpression(tags, tagExpression))
    })

    if (matched.length === 0) {
        console.warn(`[spec-filter] No files matched TAG="${tagExpression}" — running all specs`)
        return [specsGlob]
    }

    console.log(`[spec-filter] TAG="${tagExpression}" → ${matched.length}/${files.length} file(s)`)
    return matched
}

// ─── Runner config ─────────────────────────────────────────────────────────────

// capabilities is a valid WDIO runtime property but was accidentally dropped from
// Options.Testrunner in v9 types — use inferred type here and cast at export.
const runnerConfig = {
    runner: 'local',

    specs: getFilteredSpecs(),
    exclude: [],

    // Controllable via env so CI pipelines can tune parallelism without code changes
    maxInstances: process.env.MAX_INSTANCE ? parseInt(process.env.MAX_INSTANCE, 10) : 1,

    capabilities: localCapabilities,

    // 'debug' activates verbose driver logging + Node inspector; 'info' otherwise
    logLevel: process.env.DEBUG ? 'debug' : 'info',
    bail: 0,

    // Attach Node inspector when DEBUG=true so you can step through test code
    execArgv: process.env.DEBUG ? ['--inspect'] : [],

    waitforTimeout: 10000,
    connectionRetryTimeout: process.env.DEFAULT_NETWORK_TIMEOUT
        ? parseInt(process.env.DEFAULT_NETWORK_TIMEOUT, 10)
        : 120000,
    connectionRetryCount: 3,

    services: [
        [TestDataService] as unknown as Services.ServiceEntry,
        // Injects browser.enablePerformanceAudits / getMetrics / etc. via CDP.
        // Only activates for Chrome — ignored by other browsers at runtime.
        'lighthouse',
    ],
    framework: 'cucumber',

    reporters: [
        // Human-readable console output
        'spec',

        // Structured JSON — used to generate custom HTML reports offline
        [
            'cucumberjs-json',
            {
                jsonFolder: path.resolve(__dirname, '../.tmp/cucumber-results'),
                language: 'en',
                disableHooks: true,
            },
        ],

        // JUnit XML — consumed natively by GitHub Actions, Jenkins, GitLab CI
        [
            'junit',
            {
                outputDir: path.resolve(__dirname, '../.tmp/junit-results'),
                outputFileFormat: (opts: { cid: string }) => `junit-results-${opts.cid}.xml`,
            },
        ],

        // Allure — rich HTML report with environment metadata on the overview page
        [
            'allure',
            {
                outputDir: path.resolve(__dirname, '../allure-results'),
                disableWebdriverStepsReporting: true,
                disableWebdriverScreenshotsReporting: false,
                useCucumberStepReporter: true,
                reportedEnvironmentVars: {
                    Browser: process.env.BROWSER || 'chrome',
                    Environment: process.env.ENV || 'test',
                    Tags: tagExpression || 'none',
                    Platform: os.platform(),
                    NodeVersion: process.version,
                    OS: os.version(),
                },
            },
        ],
    ],

    cucumberOpts: {
        require: [path.resolve(__dirname, '../src/hooks/**/*.ts'), path.resolve(__dirname, '../src/steps/**/*.ts')],
        backtrace: false,
        requireModule: [],
        dryRun: false,
        failFast: false,
        name: [],
        snippets: true,
        source: true,
        strict: false,
        tagExpression: tagExpression || '@smoke',
        timeout: 60000,
        ignoreUndefinedDefinitions: false,
        // Retry failed scenarios in CI without code changes
        retry: process.env.MAX_RETRY ? parseInt(process.env.MAX_RETRY, 10) : 0,
    },

    // ─── Hooks ──────────────────────────────────────────────────────────────────

    onPrepare: async function () {
        // Wipe stale reports so old results never bleed into a new run
        fs.rmSync(path.resolve(__dirname, '../.tmp'), { recursive: true, force: true })
        fs.rmSync(path.resolve(__dirname, '../allure-results'), { recursive: true, force: true })

        // Fail the whole run immediately if the base URL is unreachable.
        // Without this, every test worker would fail with a cryptic connection error.
        if (!isDryRun()) {
            const { baseUrl } = getEnvironmentConfig()
            if (!baseUrl) throw new Error('baseUrl is not set in the environment config')
            console.log(`[onPrepare] Checking reachability: ${baseUrl}`)
            await checkUrlAvailability(baseUrl, 30000)
            console.log('[onPrepare] Base URL is reachable — starting tests')
        }
    },

    afterScenario: async function () {
        try {
            await reloadSession()
        } catch (error) {
            // Log but don't rethrow — a failed cleanup must not mask the scenario result.
            console.error(`[afterScenario] ${error instanceof Error ? error.message : String(error)}`)
        }
    },
}

export const config = {
    ...runnerConfig,
    baseUrl: getEnvironmentConfig().baseUrl,
} as Options.Testrunner
