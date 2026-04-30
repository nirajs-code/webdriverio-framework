import type { Options, Services } from '@wdio/types'

import { getEnvironmentConfig, isDryRun } from '../../conf/wdio.conf'
import type { EnvConfig } from '../../conf/wdio.conf'

export interface UserCredentials {
    username: string
    password: string
}

export class TestDataService implements Services.ServiceInstance {
    private _config!: EnvConfig

    // WDIO requires this exact constructor signature when a class is registered
    // in services[]. The three args are injected automatically by the runner.
    constructor(
        private readonly _options: Record<string, unknown>,
        private readonly _capabilities: WebdriverIO.Capabilities,
        private readonly _runnerConfig: Omit<Options.Testrunner, 'capabilities'>
    ) {}

    before(_caps: WebdriverIO.Capabilities, _specs: string[], _browser: Options.Testrunner): void {
        if (isDryRun()) return

        this._config = getEnvironmentConfig()
        globalThis.TestData = this
    }

    getUser(userType: string): UserCredentials {
        const user = this._config.users[userType]
        if (!user) throw new Error(`TestData: no user found for type "${userType}"`)
        return user
    }

    /**
     * Returns a value from the testData bag in config.json, cast to the requested type.
     * Throws if the key is missing so failures surface at access time, not usage time.
     *
     * Examples:
     *   globalThis.TestData.get<string>('default_address')
     *   globalThis.TestData.get<number>('timeout_ms')
     *   globalThis.TestData.get<{ street: string }>('billing_address')
     */
    get<T>(key: string): T {
        const value = this._config.testData[key]
        if (value === undefined || value === null || value === '') {
            throw new Error(`TestData: key "${key}" is not set in testData config`)
        }
        return value as T
    }

    getAddress(): string {
        return this.get<string>('default_address')
    }
    getMobile(): string {
        return this.get<string>('mobile')
    }
}
