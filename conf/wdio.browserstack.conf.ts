import { config as baseConfig } from './wdio.conf'
import { browserStackCapabilities, browserStackServices } from './wdio.capabilities'

export const config = {
    ...baseConfig,
    capabilities: browserStackCapabilities,
    services: browserStackServices
}
