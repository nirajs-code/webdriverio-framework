import type { Options } from '@wdio/types'

export const config: Options.Testrunner = {
    runner: 'local',

    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            transpileOnly: true,
            project: './tsconfig.json'
        }
    },

    specs: ['./src/features/*.feature'],
    exclude: [],

    maxInstances: 1,

    capabilities: [{
        browserName: 'chrome'
    }],

    logLevel: 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    services: [],

    framework: 'cucumber',

    reporters: [
        'spec',
        ['allure', { outputDir: 'allure-results' }]
    ],

    cucumberOpts: {
        require: ['./src/steps/*.ts'],
        backtrace: false,
        requireModule: [],
        dryRun: false,
        failFast: false,
        name: [],
        snippets: true,
        source: true,
        strict: false,
        tagExpression: '',
        timeout: 60000,
        ignoreUndefinedDefinitions: false
    }
}
