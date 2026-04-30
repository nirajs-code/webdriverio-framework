import type { Options } from '@wdio/types'

import { headlessCapabilities } from './wdio.capabilities.conf'
import { config as baseConfig } from './wdio.conf'

export const config = {
    ...baseConfig,
    capabilities: headlessCapabilities,
} as Options.Testrunner
