// ─── Platform resolution ──────────────────────────────────────────────────────
//
// PLATFORM=desktop (default) → full browser window, multi-browser support.
// PLATFORM=mobile            → Chrome device emulation (local/headless) or
//                              real device on BrowserStack.

const PLATFORM = (process.env.PLATFORM || 'desktop').toLowerCase()
const BROWSER = process.env.BROWSER || 'chrome'
const DEVICE = process.env.MOBILE_DEVICE || 'iPhone 12 Pro'
const DEVICE_OS_VERSION = process.env.MOBILE_OS_VERSION || '16'

const isMobile = PLATFORM === 'mobile'

// ─── Shared browser args ──────────────────────────────────────────────────────

const CHROME_BASE_ARGS = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
const DESKTOP_SIZE_ARG = '--window-size=1920,1080'
const FIREFOX_SIZE_ARGS = ['--width=1920', '--height=1080']
const EDGE_BASE_ARGS = ['--no-sandbox', '--disable-gpu', '--window-size=1920,1080']

// ─── BrowserStack shared identity ────────────────────────────────────────────

const bsIdentity = {
    userName: process.env.BROWSERSTACK_USERNAME,
    accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
}

const bsMeta = {
    projectName: process.env.npm_package_name || 'wdio_test',
    buildName: process.env.BUILD_NAME || 'local',
}

// ─── Desktop — local ──────────────────────────────────────────────────────────

const _desktopLocal: WebdriverIO.Capabilities[] = [
    {
        browserName: BROWSER,
        ...(BROWSER === 'chrome' && {
            'goog:chromeOptions': { args: [...CHROME_BASE_ARGS, DESKTOP_SIZE_ARG] },
        }),
        ...(BROWSER === 'firefox' && {
            'moz:firefoxOptions': { args: FIREFOX_SIZE_ARGS },
        }),
        ...(BROWSER === 'edge' && {
            'ms:edgeOptions': { args: EDGE_BASE_ARGS },
        }),
    },
]

// ─── Desktop — headless ───────────────────────────────────────────────────────

const _desktopHeadless: WebdriverIO.Capabilities[] = [
    {
        browserName: BROWSER,
        ...(BROWSER === 'chrome' && {
            'goog:chromeOptions': { args: ['--headless', ...CHROME_BASE_ARGS, DESKTOP_SIZE_ARG] },
        }),
        ...(BROWSER === 'firefox' && {
            'moz:firefoxOptions': { args: ['-headless', ...FIREFOX_SIZE_ARGS] },
        }),
        ...(BROWSER === 'edge' && {
            'ms:edgeOptions': { args: ['--headless', ...EDGE_BASE_ARGS] },
        }),
    },
]

// ─── Mobile — local (Chrome device emulation) ─────────────────────────────────
//
// mobileEmulation is Chrome-only. BROWSER is ignored when PLATFORM=mobile —
// Chrome is always used for local and headless mobile runs.

const _mobileLocal: WebdriverIO.Capabilities[] = [
    {
        browserName: 'chrome',
        'goog:chromeOptions': {
            args: CHROME_BASE_ARGS,
            mobileEmulation: { deviceName: DEVICE },
        },
    },
]

// ─── Mobile — headless ────────────────────────────────────────────────────────

const _mobileHeadless: WebdriverIO.Capabilities[] = [
    {
        browserName: 'chrome',
        'goog:chromeOptions': {
            args: ['--headless', ...CHROME_BASE_ARGS],
            mobileEmulation: { deviceName: DEVICE },
        },
    },
]

// ─── BrowserStack — desktop ───────────────────────────────────────────────────

const _bsDesktop: WebdriverIO.Capabilities[] = [
    {
        browserName: BROWSER,
        'bstack:options': {
            ...bsIdentity,
            ...bsMeta,
            os: 'Windows',
            osVersion: '11',
            sessionName: `WebdriverIO — Desktop ${BROWSER}`,
        },
    },
]

// ─── BrowserStack — mobile (real device) ──────────────────────────────────────

const _bsMobile: WebdriverIO.Capabilities[] = [
    {
        browserName: 'safari',
        'bstack:options': {
            ...bsIdentity,
            ...bsMeta,
            sessionName: `WebdriverIO — Mobile ${DEVICE}`,
            deviceName: DEVICE,
            osVersion: DEVICE_OS_VERSION,
            realMobile: true,
        },
    },
]

// ─── Resolved exports ─────────────────────────────────────────────────────────
//
// Every conf file imports from here. PLATFORM is resolved once at load time
// so the correct capability set is used throughout the run.

export const localCapabilities = isMobile ? _mobileLocal : _desktopLocal
export const headlessCapabilities = isMobile ? _mobileHeadless : _desktopHeadless
export const browserStackCapabilities = isMobile ? _bsMobile : _bsDesktop
