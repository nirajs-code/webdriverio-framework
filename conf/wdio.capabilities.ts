import type { Options } from '@wdio/types'

const browserName = process.env.BROWSER || 'chrome'

export const localCapabilities: WebdriverIO.Capabilities[] = [{
    browserName,
    ...(browserName === 'chrome' && {
        'goog:chromeOptions': {
            args: [
                '--no-sandbox',
                '--disable-gpu',
                '--disable-infobars',
                '--disable-dev-shm-usage',
                '--window-size=1920,1080'
            ]
        }
    }),
    ...(browserName === 'firefox' && {
        'moz:firefoxOptions': {
            args: ['--width=1920', '--height=1080']
        }
    }),
    ...(browserName === 'edge' && {
        'ms:edgeOptions': {
            args: [
                '--no-sandbox',
                '--disable-gpu',
                '--disable-infobars',
                '--window-size=1920,1080'
            ]
        }
    })
}]

export const headlessCapabilities: WebdriverIO.Capabilities[] = [{
    browserName,
    ...(browserName === 'chrome' && {
        'goog:chromeOptions': { args: ['--headless', '--disable-gpu', '--no-sandbox'] }
    }),
    ...(browserName === 'firefox' && {
        'moz:firefoxOptions': { args: ['-headless'] }
    })
}]

export const browserStackCapabilities: WebdriverIO.Capabilities[] = [{
    browserName,
    'bstack:options': {
        userName: process.env.BROWSERSTACK_USERNAME,
        accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
        projectName: process.env.npm_package_name || 'wdio_test',
        buildName: process.env.BUILD_NAME || 'local',
        sessionName: 'WebdriverIO Test'
    }
}]

export const browserStackServices: Options.Testrunner['services'] = [
    ['browserstack', { browserstackLocal: true }]
]
