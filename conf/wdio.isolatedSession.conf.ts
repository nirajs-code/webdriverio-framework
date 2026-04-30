/// <reference types="@wdio/globals/types" />
import type { Options } from '@wdio/types'

import { localCapabilities, headlessCapabilities } from './wdio.capabilities.conf'
import { config as baseConfig } from './wdio.conf'
import { reloadSession } from '../src/lib/browser-utils'

const isHeadless = process.env.HEADLESS === 'true'
const isMobile = (process.env.PLATFORM || 'desktop').toLowerCase() === 'mobile'

// Module-level per-worker process — survives across beforeFeature → beforeScenario
// calls within the same worker without relying on untyped hook world/context.
let scenarioCount = 0

export const config = {
    ...baseConfig,

    capabilities: isHeadless ? headlessCapabilities : localCapabilities,

    // Intentionally empty: base afterScenario reloads the session after each scenario.
    // This conf reloads before each scenario instead (see beforeScenario), so the
    // base hook would cause a redundant double-reload on every scenario boundary.
    afterScenario: async function () {},

    beforeFeature: function () {
        scenarioCount = 0
    },

    beforeScenario: async function () {
        // Skip the reload before the very first scenario in each feature — the
        // session is already clean from either startup or the previous feature's reload.
        if (scenarioCount > 0) {
            await reloadSession()
        }

        // Maximise only for headed desktop — headless viewport is fixed via
        // --window-size in capability args; mobile emulation has a fixed viewport.
        if (!isHeadless && !isMobile) {
            await browser.maximizeWindow()
        }

        scenarioCount++
    },
} as Options.Testrunner
