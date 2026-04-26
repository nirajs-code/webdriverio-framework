import { config as dotenvConfig } from 'dotenv'
import * as path from 'path'
import type { Options } from '@wdio/types'
import { localCapabilities } from './wdio.capabilities'

dotenvConfig({ path: path.resolve(__dirname, '../.env') })

const env = process.env.ENV || 'test'
const envConfig = require(`./env/${env}/config.json`)

export const config: Options.Testrunner = {
    runner: 'local',

    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            transpileOnly: true,
            project: path.resolve(__dirname, '../tsconfig.json')
        }
    },

    baseUrl: process.env.OVERWRITE_URL || envConfig.baseUrl,

    specs: [path.resolve(__dirname, '../src/features/**/*.feature')],
    exclude: [],

    maxInstances: 1,

    capabilities: localCapabilities,

    logLevel: 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    services: [],

    framework: 'cucumber',

    reporters: [
        'spec',
        ['allure', { outputDir: path.resolve(__dirname, '../allure-results') }]
    ],

    cucumberOpts: {
        require: [path.resolve(__dirname, '../src/steps/**/*.ts')],
        backtrace: false,
        requireModule: [],
        dryRun: false,
        failFast: false,
        name: [],
        snippets: true,
        source: true,
        strict: false,
        tagExpression: process.env.TAG || '@smoke',
        timeout: 60000,
        ignoreUndefinedDefinitions: false
    }
}
