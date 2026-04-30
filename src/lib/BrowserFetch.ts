/// <reference types="@wdio/globals/types" />

/**
 * BrowserFetch — session-aware API helper.
 *
 * Runs fetch() inside the current WDIO browser process via browser.execute(),
 * so every request automatically carries the session's cookies, CSRF state,
 * Accept-Language header, and any OPCO / tenant context that the browser holds.
 *
 * This is the correct way to call authenticated app APIs from a test:
 * using Node-level HTTP (axios, node-fetch) requires you to manually clone
 * cookies, auth headers, and session tokens — and they still won't share the
 * exact browser session. BrowserFetch delegates to the browser itself.
 *
 * Usage:
 *   const { data } = await browserGet<User>('/api/v1/me')
 *   const { data } = await browserPost<Order>('/api/v1/orders', { sku: 'ABC' })
 *   const csrf    = await readCsrfToken()
 *   const { data } = await browserPost('/api/v1/checkout', body, { headers: { 'X-CSRF-Token': csrf } })
 */

// ─── Serialization contract ───────────────────────────────────────────────────
//
// browser.execute() sends arguments as JSON, so only plain-object types cross
// the Node ↔ browser boundary. These internal types are the wire format.

interface _FetchInit {
    method: string
    headers: Record<string, string>
    body: string | null
    credentials: string
    mode: string
}

interface _RawResponse {
    status: number
    statusText: string
    ok: boolean
    headers: Record<string, string>
    body: string // always text; caller decides how to parse
    url: string
}

interface _RawError {
    fetchError: true
    message: string
}

type _BrowserResult = _RawResponse | _RawError

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BrowserFetchOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
    headers?: Record<string, string>
    /**
     * Body to send. Plain objects / arrays are JSON-serialised and
     * Content-Type: application/json is injected automatically unless
     * the caller already provides a Content-Type header.
     */
    body?: string | Record<string, unknown> | unknown[]
    /**
     * Controls the browser's credentials policy for cross-origin requests.
     * Defaults to 'include' so session cookies travel with every call.
     */
    credentials?: 'include' | 'omit' | 'same-origin'
    mode?: 'cors' | 'no-cors' | 'same-origin'
    /**
     * When true (default), throws BrowserFetchError for HTTP 4xx / 5xx.
     * Set to false to receive the response object regardless of status.
     */
    throwOnError?: boolean
}

/**
 * Typed response returned by every BrowserFetch call.
 * `data` is the body parsed as JSON when possible, raw string otherwise.
 */
export interface BrowserFetchResponse<T = unknown> {
    status: number
    statusText: string
    ok: boolean
    headers: Record<string, string>
    /** Raw response body as text. */
    body: string
    /** Body parsed as JSON, or the raw string if the response is not JSON. */
    data: T
    /** Final URL after any redirects. */
    url: string
}

/**
 * Thrown when the response status is >= 400 and throwOnError is true.
 * Carries the full status / body so step-level assertions can inspect it.
 */
export class BrowserFetchError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly body: string,
        public readonly url: string
    ) {
        super(`BrowserFetch: HTTP ${status} ${statusText} — ${url}`)
        this.name = 'BrowserFetchError'
    }
}

// ─── Browser-side script ──────────────────────────────────────────────────────
//
// This function is serialised and sent to the browser by browser.execute().
// It MUST be self-contained: no imports, no closures over Node.js variables.
// Any data it needs comes through the serialised arguments (_url, _init).

const _browserScript = async (_url: string, _init: _FetchInit): Promise<_BrowserResult> => {
    try {
        const res = await fetch(_url, {
            method: _init.method,
            headers: _init.headers,
            body: _init.body ?? undefined,
            credentials: _init.credentials as RequestCredentials,
            mode: _init.mode as RequestMode,
        })

        const body = await res.text()

        // Headers is a Headers object — convert to plain object for serialisation.
        const headers: Record<string, string> = {}
        res.headers.forEach((value, key) => {
            headers[key] = value
        })

        return {
            status: res.status,
            statusText: res.statusText,
            ok: res.ok,
            headers,
            body,
            url: res.url,
        }
    } catch (err) {
        // Network-level errors (DNS, connection refused, CORS preflight failure).
        return {
            fetchError: true,
            message: err instanceof Error ? err.message : String(err),
        }
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _buildInit(opts: BrowserFetchOptions): _FetchInit {
    const { method = 'GET', headers = {}, body, credentials = 'include', mode = 'cors' } = opts

    let serialisedBody: string | null = null
    const resolvedHeaders = { ...headers }

    if (body !== null && body !== undefined) {
        if (typeof body === 'string') {
            serialisedBody = body
        } else {
            serialisedBody = JSON.stringify(body)
            // Inject Content-Type only when the caller hasn't provided one.
            const hasContentType = Object.keys(resolvedHeaders).some(k => k.toLowerCase() === 'content-type')
            if (!hasContentType) {
                resolvedHeaders['Content-Type'] = 'application/json'
            }
        }
    }

    return { method, headers: resolvedHeaders, body: serialisedBody, credentials, mode }
}

function _parseBody<T>(raw: string): T {
    try {
        return JSON.parse(raw) as T
    } catch {
        return raw as unknown as T
    }
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Executes fetch() inside the current browser session and returns a typed
 * response. Relative URLs are resolved against the page currently loaded in
 * the browser (the browser handles this natively).
 *
 * @example
 *   // Authenticated GET — session cookies included automatically
 *   const { data } = await browserFetch<UserProfile>('/api/v1/profile')
 *
 *   // POST with JSON body
 *   const { status } = await browserFetch('/api/v1/cart', {
 *       method: 'POST',
 *       body: { sku: 'ABC123', qty: 2 },
 *   })
 *
 *   // Inspect a 404 without throwing
 *   const res = await browserFetch('/api/v1/missing', { throwOnError: false })
 *   if (res.status === 404) { ... }
 */
export async function browserFetch<T = unknown>(
    url: string,
    options: BrowserFetchOptions = {}
): Promise<BrowserFetchResponse<T>> {
    const { throwOnError = true, ...fetchOpts } = options
    const init = _buildInit(fetchOpts)

    // browser.execute() serialises the function source and args over CDP.
    // Cast needed because the generic return of execute() is TransformReturn<T>,
    // not the inner Promise type, when the script itself is async.
    const raw = await browser.execute(_browserScript as unknown as (...args: unknown[]) => _BrowserResult, url, init)

    // Network-level failure (not an HTTP error — fetch itself threw).
    if ('fetchError' in raw) {
        throw new Error(`BrowserFetch network error: ${raw.message}`)
    }

    const response: BrowserFetchResponse<T> = {
        status: raw.status,
        statusText: raw.statusText,
        ok: raw.ok,
        headers: raw.headers,
        body: raw.body,
        data: _parseBody<T>(raw.body),
        url: raw.url,
    }

    if (!raw.ok && throwOnError) {
        throw new BrowserFetchError(raw.status, raw.statusText, raw.body, raw.url)
    }

    return response
}

// ─── Shorthand methods ────────────────────────────────────────────────────────

type _CommonOpts = Omit<BrowserFetchOptions, 'method' | 'body'>

export const browserGet = <T = unknown>(url: string, options?: _CommonOpts): Promise<BrowserFetchResponse<T>> =>
    browserFetch<T>(url, { ...options, method: 'GET' })

export const browserPost = <T = unknown>(
    url: string,
    body?: BrowserFetchOptions['body'],
    options?: _CommonOpts
): Promise<BrowserFetchResponse<T>> => browserFetch<T>(url, { ...options, method: 'POST', body })

export const browserPut = <T = unknown>(
    url: string,
    body?: BrowserFetchOptions['body'],
    options?: _CommonOpts
): Promise<BrowserFetchResponse<T>> => browserFetch<T>(url, { ...options, method: 'PUT', body })

export const browserPatch = <T = unknown>(
    url: string,
    body?: BrowserFetchOptions['body'],
    options?: _CommonOpts
): Promise<BrowserFetchResponse<T>> => browserFetch<T>(url, { ...options, method: 'PATCH', body })

export const browserDelete = <T = unknown>(url: string, options?: _CommonOpts): Promise<BrowserFetchResponse<T>> =>
    browserFetch<T>(url, { ...options, method: 'DELETE' })

// ─── Session / auth helpers ───────────────────────────────────────────────────

/**
 * Reads a CSRF token from a <meta> tag in the page.
 * Most Rails / Laravel / Django apps render one as:
 *   <meta name="csrf-token" content="TOKEN">
 */
export const readCsrfToken = (metaName = 'csrf-token'): Promise<string | null> =>
    browser.execute((name: string) => {
        const meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
        return meta?.content ?? null
    }, metaName)

/**
 * Reads a CSRF / request-verification token from a hidden <input> in the DOM.
 * Useful for ASP.NET (RequestVerificationToken) or similar frameworks.
 */
export const readCsrfInput = (inputName = '__RequestVerificationToken'): Promise<string | null> =>
    browser.execute((name: string) => {
        const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
        return input?.value ?? null
    }, inputName)

/**
 * Returns the value of a single cookie visible to the current page.
 * Handy for reading XSRF-TOKEN / csrftoken cookies that need to be
 * mirrored into a request header (e.g. X-XSRF-TOKEN).
 */
export const readCookieValue = (cookieName: string): Promise<string | null> =>
    browser.execute((name: string) => {
        const match = document.cookie.split('; ').find(row => row.startsWith(`${name}=`))
        return match ? decodeURIComponent(match.split('=')[1]) : null
    }, cookieName)

/**
 * Builds a headers object pre-populated with the current session's CSRF token.
 * Merges with any additional headers the caller provides.
 *
 * Resolution order:
 *   1. <meta name="csrf-token">          (Rails, Laravel)
 *   2. <input name="__RequestVerificationToken">  (ASP.NET)
 *   3. XSRF-TOKEN cookie                 (Angular, Axios default)
 *
 * @example
 *   const headers = await buildCsrfHeaders({ 'Accept-Language': 'fr-FR' })
 *   const { data } = await browserPost('/api/orders', body, { headers })
 */
export const buildCsrfHeaders = async (extra: Record<string, string> = {}): Promise<Record<string, string>> => {
    const token = (await readCsrfToken()) ?? (await readCsrfInput()) ?? (await readCookieValue('XSRF-TOKEN'))

    return {
        ...(token ? { 'X-CSRF-Token': token, 'X-XSRF-TOKEN': token } : {}),
        ...extra,
    }
}
