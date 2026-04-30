# WebdriverIO Test Framework — Claude Context

## Project overview

End-to-end test framework built on **WebdriverIO v9**, **Cucumber BDD**, and **TypeScript** (strict mode). Tests are written as `.feature` files, backed by typed page objects and step definitions. Supports local, headless, isolated-session, and BrowserStack execution targets across desktop and mobile platforms.

Node version: **20.9.0** (enforced by `.nvmrc`).

---

## Commands

```bash
npm run test                      # local Chrome headed — standard run
npm run test:headless             # headless (CI default)
npm run test:isolated             # per-feature session isolation, headed
npm run test:isolated:headless    # per-feature session isolation, headless
npm run test:browserstack         # remote execution on BrowserStack
npm run test:dry                  # Cucumber dry-run — validates step bindings only, no browser

npx tsc --noEmit                  # type-check without emitting (run after every file change)
```

**Platform axis** — prepend to any script to switch capability set:
```bash
PLATFORM=mobile npm run test                     # Chrome mobile emulation (headed)
PLATFORM=mobile npm run test:headless            # Chrome mobile emulation (headless)
PLATFORM=mobile npm run test:browserstack        # real device on BrowserStack
MOBILE_DEVICE="Pixel 5" npm run test            # override the emulated device
```

Run a specific tag: `TAG=@smoke npm run test:headless`
Run against prod: `ENV=prod npm run test:headless`
Override base URL: `OVERWRITE_URL=https://staging.example.com npm run test:headless`

---

## Repository layout

```
conf/
  wdio.conf.ts                  # base config — used for all standard local runs
  wdio.headless.conf.ts         # extends base; headless capabilities
  wdio.isolatedSession.conf.ts  # extends base; per-feature session reload + window maximize
  wdio.browserstack.conf.ts     # extends base; BrowserStack capabilities + services
  wdio.capabilities.conf.ts     # PLATFORM-aware capability exports (desktop / mobile)
  env/
    test/config.json             # baseUrl + testData for 'test' environment
    prod/config.json             # baseUrl + testData for 'prod' environment

src/
  features/        # Cucumber .feature files
  steps/           # Step definition files (*steps.ts)
  hooks/
    hooks.ts       # Cucumber Before/After lifecycle hooks
  pages/
    page.ts        # basePage — base class all page objects extend
    *.page.ts      # one file per page
  organisms/       # Atomic-design organisms (header, footer, etc.)
  services/
    TestDataService.ts  # WDIO ServiceInstance — loads testData, exposes globalThis.TestData
  lib/             # Pure utility modules (no test framework coupling)
    env.ts              # lazy env config loader (cached)
    wdio-utils.ts       # element interaction helpers (click, setValue, …)
    browser-utils.ts    # browser/session/network helpers (navigate, cookies, storage, …)
    selectors.ts        # CSS selector builder — selector('value').AriaLabel etc.
    BrowserFetch.ts     # session-aware fetch() runner — runs inside the browser via CDP
    lighthouse-utils.ts # Lighthouse performance audits
    axe-utils.ts        # Axe accessibility audits
  types/
    global.d.ts    # declares globalThis.TestData: TestDataService
```

---

## Key architectural rules

### Config layer (`conf/`)
- `wdio.conf.ts` is the base. All other conf files spread it: `{ ...baseConfig, capabilities: ... }`.
- All capability objects live in `wdio.capabilities.conf.ts`. Never define capabilities inline in a conf file.
- **`PLATFORM` env var** is read once in `wdio.capabilities.conf.ts` at load time. `desktop` (default) uses full browser windows; `mobile` uses Chrome device emulation locally or a real BrowserStack device. Every named export (`localCapabilities`, `headlessCapabilities`, `browserStackCapabilities`) already reflects the correct platform — conf files just import the name they need.
- `BROWSER` env var selects chrome/firefox/edge for desktop. Mobile always uses Chrome emulation (local) or safari (BrowserStack).
- `capabilities` is intentionally omitted from the `Options.Testrunner` type annotation on `runnerConfig` — it was removed from the v9 types by mistake. The cast is applied only at the final `export const config` line.
- `isDryRun()` lives in `wdio.conf.ts` and is imported by services/hooks that must short-circuit during dry runs.
- `getEnvironmentConfig()` in `src/lib/env.ts` is lazy (cached after first call) so dotenv has run before the first access.

### Page object layer (`src/pages/`)
- All page objects extend `basePage` (default export of `page.ts`).
- `basePage` provides: `open(path)`, `navigateTo(url)`, `refresh()`, `checkCookiesExists`, `deleteCookies`, `updateCookies`.
- Page objects are singleton instances (`export default new LoginPage()`).
- Element getters return `ChainablePromiseElement` (what `$()` returns in WDIO v9) — **not** `WebdriverIO.Element`. Pass them directly to `src/lib/wdio-utils.ts` helpers.

### `ChainablePromiseElement` — critical WDIO v9 typing
`$()` returns `ChainablePromiseElement`, a hybrid type that is **not** a plain `Promise`. It has `.getElement()` which resolves to `WebdriverIO.Element`. The `ElementInput` type in `wdio-utils.ts` accepts all three forms (`WebdriverIO.Element | ChainablePromiseElement | string`) and the internal `resolve()` function unwraps appropriately. Never add `Promise<WebdriverIO.Element>` to that union — it causes structural mismatch errors.

### Step definitions (`src/steps/`)
- Import page objects and lib utilities only. No conf imports.
- Test data accessed exclusively via `globalThis.TestData.getUser(userType)`.
- Never import `getEnvironmentConfig` directly in steps — all env access goes through `TestDataService`.

### `TestDataService` (`src/services/`)
- Implements `Services.ServiceInstance`. WDIO calls `before()` automatically in each worker process.
- `before()` sets `globalThis.TestData = this` so step files can call `globalThis.TestData.getUser()`.
- Constructor signature must match WDIO's injection contract: `(options, capabilities, config)`.
- Imports `isDryRun` from `conf/wdio.conf` (the one deliberate `src/ → conf/` import).

### Selector utility (`src/lib/selectors.ts`)
`selector(value)` returns an `as const` object. Use it in page objects and hooks:
```ts
selector('skeleton').ClassContainsValue   // [class*="skeleton"]
selector('onetrust-accept-btn-handler').Id // #onetrust-accept-btn-handler
selector('Submit').AriaLabel              // [aria-label="Submit"]
```

### BrowserFetch (`src/lib/BrowserFetch.ts`)
Runs `fetch()` inside the browser via `browser.execute()`. Use this — not axios or node-fetch — whenever a test needs to call an app API, because the browser session (cookies, CSRF tokens, OPCO context) is automatically included. Key helpers:
- `browserGet / browserPost / browserPut / browserPatch / browserDelete`
- `buildCsrfHeaders()` — resolves CSRF token from meta tag → hidden input → XSRF-TOKEN cookie
- `BrowserFetchError` thrown on 4xx/5xx by default; pass `throwOnError: false` to suppress

### Hooks (`src/hooks/hooks.ts`)
- `Before` — logs scenario name + tags.
- `After` (all) — `✓` on pass; on fail: attaches BrowserStack session URL + screenshot to cucumber JSON and Allure.
- `After { tags: '@pageperf' }` — if `@lighthouse`: reloads session, opens `.tmp/lighthouse-report.html`, screenshots, attaches, deletes. Otherwise: screenshots perf results page, removes `.tmp/perf-results/`.
- `After { tags: '@clearCookies' }` — deletes cookies + clears localStorage / sessionStorage.
- `Before { tags: '@acceptCookies' }` — clicks OneTrust banner if present.
- `After { tags: '@restoreData' }` — placeholder for project-specific data teardown.

---

## Environment variables

Defined in `.env` (git-ignored). Template in `.env.example`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENV` | `test` | Maps to `conf/env/<ENV>/config.json` |
| `OVERWRITE_URL` | — | Overrides `baseUrl` from config |
| `TAG` | `@smoke` | Cucumber tag expression for spec pre-filtering |
| `PLATFORM` | `desktop` | `desktop` / `mobile` — controls capability shape |
| `BROWSER` | `chrome` | `chrome` / `firefox` / `edge` (desktop only) |
| `MOBILE_DEVICE` | `iPhone 12 Pro` | Chrome DevTools device name (local) or BrowserStack device name (remote) |
| `MOBILE_OS_VERSION` | `16` | BrowserStack real device OS version (used when `PLATFORM=mobile`) |
| `MAX_INSTANCE` | `1` | Parallel worker count |
| `MAX_RETRY` | `0` | Cucumber scenario retry count |
| `DEBUG` | — | Enables verbose logs + Node inspector |
| `DEFAULT_NETWORK_TIMEOUT` | `120000` | WebDriver connection timeout (ms) |
| `HEADLESS` | — | Set `true` to activate headless mode in `wdio.desktop.conf.ts` |
| `BROWSERSTACK_USERNAME` | — | Required for `test:browserstack` |
| `BROWSERSTACK_ACCESS_KEY` | — | Required for `test:browserstack` |
| `BUILD_NAME` | `local` | BrowserStack build label |
| `BS_TEST_OBSERVABILITY` | `false` | Enable BrowserStack Test Observability |

---

## Reporters and artefacts

| Reporter | Output path | Consumed by |
|----------|------------|-------------|
| `spec` | stdout | local dev |
| `cucumberjs-json` | `.tmp/cucumber-results/` | custom HTML report |
| `junit` | `.tmp/junit-results/` | GitHub Actions, Jenkins |
| `allure` | `allure-results/` | Allure HTML report |

`onPrepare` wipes `.tmp/` and `allure-results/` before each run.
CI uploads `allure-results/` as an artifact (7-day retention).

---

## Lighthouse and Axe

### Lighthouse (performance)
- Service registered as `'lighthouse'` in `wdio.conf.ts`. Only activates for Chrome via CDP.
- Use `withAudits(action, opts?)` for the full enable → navigate → save → disable lifecycle.
- `saveLighthouseReport()` writes `.tmp/lighthouse-report.html` — the `@pageperf @lighthouse` After hook picks it up automatically.
- Tag performance scenarios `@pageperf @lighthouse` to trigger the hook cleanup.

### Axe (accessibility)
- Package: `@axe-core/webdriverio` (v4.11.x — has its own bundled `axe-core`).
- **Never import types from the top-level `axe-core` package** — it's a different version (v4.2 from lighthouse's deps) and causes `NodeResult.target` structural mismatch. Derive all types from `AxeResults` in `axe-utils.ts`.
- `auditAndAssert(options?, minImpact?)` is the one-liner for run + attach + assert.
- Tag accessibility scenarios `@accessibility`.

---

## CI (GitHub Actions)

- **Every push / PR to `main`**: runs `test:headless` with `ENV=test TAG=@smoke`.
- **Merges to `main` only**: additionally runs `test:browserstack`.
- Node version sourced from `.nvmrc` via `node-version-file`.
- BrowserStack credentials injected as repository secrets.

---

## TypeScript notes

- `strict: true`. No implicit `any`, no implicit returns.
- `"types": ["node", "@wdio/globals/types"]` in `tsconfig.json` — this is what makes `browser`, `$`, `$$`, `expect` available globally without imports.
- `/// <reference types="@wdio/globals/types" />` is added to conf files that use `browser` in hook callbacks, because conf files are loaded in the main process (not a WDIO worker) where the global types aren't automatically injected.
- Run `npx tsc --noEmit` after every change. Do not ship code that fails the type check.
- `capabilities` is absent from `Options.Testrunner` in WDIO v9 types (regression). The `runnerConfig` object in `wdio.conf.ts` is intentionally unannotated; the cast is applied only at `export const config`.

---

## Adding new pages

1. Create `src/pages/<name>.page.ts` extending `basePage`.
2. Define element getters returning `$('selector')` or `$$(selector)`.
3. Implement action methods using helpers from `src/lib/wdio-utils.ts`.
4. Export a singleton: `export default new MyPage()`.

## Adding new step files

1. Create `src/steps/<feature>.steps.ts`.
2. Import page objects and lib utilities only — no conf imports.
3. Access test data via `globalThis.TestData.getUser(userType)`.
4. The glob `src/steps/**/*.ts` in `cucumberOpts.require` picks it up automatically.

## Adding a new environment

1. Create `conf/env/<name>/config.json` with `{ "baseUrl": "...", "testData": { ... } }`.
2. Run with `ENV=<name> npm run test`.
