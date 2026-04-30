import type { Options, Services } from '@wdio/types'

import { browserStackCapabilities } from './wdio.capabilities.conf'
import { config as baseConfig } from './wdio.conf'

// ─── BrowserStack service ─────────────────────────────────────────────────────

const obsEnabled = process.env.BS_TEST_OBSERVABILITY === 'true'
const browserstackUser = process.env.BROWSERSTACK_USERNAME?.trim()
const browserstackKey = process.env.BROWSERSTACK_ACCESS_KEY?.trim()

if (!browserstackUser || !browserstackKey) {
    throw new Error('BrowserStack credentials are required. Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY.')
}

const browserStackService: Services.ServiceEntry = [
    'browserstack',
    {
        browserstackLocal: true,
        testObservability: obsEnabled,
        ...(obsEnabled && {
            testObservabilityOptions: {
                user: process.env.BS_TESTOBS_USERNAME || process.env.BROWSERSTACK_USERNAME,
                key: process.env.BS_TESTOBS_ACCESS_KEY || process.env.BROWSERSTACK_ACCESS_KEY,
                projectName: process.env.npm_package_name || 'wdio_test',
                buildName: process.env.BUILD_NAME || 'local',
                buildTag: [process.env.ENV || 'test'],
            },
        }),
    },
]

// ─── Config ───────────────────────────────────────────────────────────────────

export const config = {
    ...baseConfig,
    user: browserstackUser,
    key: browserstackKey,
    capabilities: browserStackCapabilities,

    // Spread base services, drop lighthouse (CDP-only), inject BrowserStack service
    services: [
        ...(baseConfig.services as Services.ServiceEntry[]).filter(s => s !== 'lighthouse'),
        browserStackService,
    ],

    // Remote sessions need higher timeouts than local runs
    waitforTimeout: 30000,
    connectionRetryTimeout: 180000,
} as Options.Testrunner
