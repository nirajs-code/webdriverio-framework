import { config as baseConfig } from './wdio.conf'
import { headlessCapabilities } from './wdio.capabilities'

export const config = {
    ...baseConfig,
    capabilities: headlessCapabilities
}
