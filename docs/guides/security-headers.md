---
title: Security Headers
sidebar_label: Security Headers
sidebar_position: 45
description: Opt-in middleware plugins that emit HTTP security response headers — X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and HSTS. Phase 1 complete in 0.3.15-alpha.
level: intermediate
prereqs:
  - '[Sessions guide](/guides/sessions)'
  - '[CSRF guide](/guides/csrf)'
  - '[Existing Gina project](/getting-started/first-project)'
---

# Security Headers

Opt-in `gina.plugins.*` middlewares that emit individual HTTP security response headers. Each plugin is single-concern, opt-in by default-off, and reads its configuration from a flat top-level `settings.json` key. Native implementation — no `helmet` dependency.

The pattern mirrors the existing `Session` ([#CSRF1](/guides/sessions#hardened-cookie-defaults)) and `Csrf` ([#CSRF2/#CSRF3](/guides/csrf)) plugin shape: import via `gina.plugins.<Name>`, mount via `app.use(...)`, configure via `settings.json`. Bundles that don't adopt these plugins continue to work unchanged.

## How it works

```mermaid
sequenceDiagram
    participant Client as Browser
    participant App as express()
    participant Plugin as gina.plugins.XContentTypeOptions
    participant Ctrl as Controller

    Client->>App: HTTP request
    App->>Plugin: middleware fires
    Plugin->>Plugin: res.getHeader('x-content-type-options')?
    alt header already set upstream
        Plugin->>App: next() — no overwrite
    else header not set
        Plugin->>App: res.setHeader('x-content-type-options', 'nosniff'); next()
    end
    App->>Ctrl: routing → controller
    Ctrl->>Client: response (with x-content-type-options: nosniff)
```

Each plugin is idempotent — if an earlier middleware already set the header, the existing value is preserved and `next()` is called immediately. First-writer-wins. Safe to stack with helmet-style upstream gates or with multiple registrations of the same plugin.

## X-Content-Type-Options (`#HDR1`)

`gina.plugins.XContentTypeOptions()` emits `X-Content-Type-Options: nosniff` on every response. The header instructs browsers to honour the declared `Content-Type` strictly, blocking MIME-sniffing attacks where a `text/plain` response whose body starts with `<script>` could be upgraded to HTML and the script executed in the page's origin.

### Adoption

One block in the bundle bootstrap, after the express app is created:

```js title="src/<bundle>/index.js"
var express             = require('express');
var xContentTypeOptions = require('gina').plugins.XContentTypeOptions();
var app                 = express();

app.use(xContentTypeOptions);
```

Order with other gina security plugins does not matter — the header is emitted on the response, not consumed from the request.

### Configuration

```jsonc title="src/<bundle>/config/settings.json"
{
  "xContentTypeOptions": {}
}
```

The block is reserved for future fields (e.g. per-route opt-out). Today the plugin has no tunable options — the only valid header value is `nosniff` per RFC 7034 and the WHATWG Fetch Standard. There is no `enabled` flag; register the plugin to opt in, do not register to opt out.

### Failure modes

| Condition                                                | Outcome                                  |
|----------------------------------------------------------|------------------------------------------|
| Plugin not registered                                    | Header not emitted; browser may sniff    |
| Header already set by an earlier middleware              | Existing value preserved (idempotent)    |
| Response already sent (`res.headersSent === true`)       | Node's `setHeader` no-ops; request resumes |

## X-Frame-Options (`#HDR2`)

`gina.plugins.XFrameOptions({ value })` emits the `X-Frame-Options` response header on every response, defending against clickjacking by controlling whether the page may be rendered inside a `<frame>`, `<iframe>`, `<embed>` or `<object>`. The browser refuses to render the page inside a frame at all (`DENY`) or only when the framing page shares the same origin (`SAMEORIGIN`).

`Content-Security-Policy: frame-ancestors` is the modern replacement (more expressive, cross-browser since ~2015), but `X-Frame-Options` is still emitted by every defensive HTTP stack because legacy clients and some intermediaries honour the older header and ignore CSP.

### Adoption

One line in the bundle bootstrap, after the express app is created:

```js title="src/<bundle>/index.js"
var express       = require('express');
var xFrameOptions = require('gina').plugins.XFrameOptions();
var app           = express();

app.use(xFrameOptions);
```

### Configuration

```jsonc title="src/<bundle>/config/settings.json"
{
  "xFrameOptions": {
    "value": "SAMEORIGIN"
  }
}
```

| Field   | Type   | Default       | Valid values            |
|---------|--------|---------------|-------------------------|
| `value` | string | `SAMEORIGIN`  | `DENY` or `SAMEORIGIN`  |

Caller-supplied options always win over settings:

```js
var xFrameOptions = require('gina').plugins.XFrameOptions({ value: 'DENY' });
```

Values are normalised to uppercase before validation — `"deny"` is accepted and emitted as `DENY`.

### Rejected: `ALLOW-FROM <uri>`

The legacy `ALLOW-FROM <uri>` value is rejected at factory call time. Modern browsers ignore it: Chrome / Edge / Safari never supported it, Firefox dropped it in 70 (October 2019). Use `Content-Security-Policy: frame-ancestors <source-list>` instead — it works cross-browser and accepts richer source expressions.

The factory throws with a message pointing at the [MDN reference for `frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors).

### Failure modes

| Condition                                                | Outcome                                              |
|----------------------------------------------------------|------------------------------------------------------|
| `value` omitted                                          | Defaults to `SAMEORIGIN`                             |
| `value` is not "DENY" or "SAMEORIGIN" (or alias of)      | Factory throws at call time (bundle won't start)     |
| `value` starts with `ALLOW-FROM`                         | Factory throws with dedicated `frame-ancestors` hint |
| Plugin not registered                                    | Header not emitted; page is framable by any origin   |
| Header already set by an earlier middleware              | Existing value preserved (idempotent)                |
| Response already sent (`res.headersSent === true`)       | Node's `setHeader` no-ops; request resumes           |

## Referrer-Policy (`#HDR3`)

`gina.plugins.ReferrerPolicy({ value })` emits the `Referrer-Policy` response header on every response, controlling how much referrer information the browser includes when navigating away from the page or fetching sub-resources. The `Referer` request header reveals the previous page's URL — including path and query string — to the destination, which can leak sensitive information: session tokens in URLs, internal page paths, account IDs, search queries.

Modern browsers (Chrome 85+, Firefox 87+, Safari 14.5+, Edge 85+) default to `strict-origin-when-cross-origin` since ~2021 — a sensible privacy / compatibility balance. Emitting the header explicitly locks the policy in regardless of the user's browser default and signals intent.

### Adoption

One line in the bundle bootstrap, after the express app is created:

```js title="src/<bundle>/index.js"
var express        = require('express');
var referrerPolicy = require('gina').plugins.ReferrerPolicy();
var app            = express();

app.use(referrerPolicy);
```

### Configuration

```jsonc title="src/<bundle>/config/settings.json"
{
  "referrerPolicy": {
    "value": "strict-origin-when-cross-origin"
  }
}
```

| Field   | Type   | Default                              | Valid values         |
|---------|--------|--------------------------------------|----------------------|
| `value` | string | `strict-origin-when-cross-origin`    | One of the 8 tokens  |

The eight valid tokens per the [W3C Referrer Policy spec](https://www.w3.org/TR/referrer-policy/):

| Token                                | Behaviour                                                            |
|--------------------------------------|----------------------------------------------------------------------|
| `no-referrer`                        | Never send the Referer header.                                       |
| `no-referrer-when-downgrade`         | Strip Referer only on HTTPS→HTTP. Pre-2021 browser default.          |
| `origin`                             | Send origin only (no path / query).                                  |
| `origin-when-cross-origin`           | Full Referer same-origin; origin only cross-origin.                  |
| `same-origin`                        | Send Referer only on same-origin requests.                           |
| `strict-origin`                      | Send origin only; no Referer at all on HTTPS→HTTP.                   |
| `strict-origin-when-cross-origin`    | **Default**. Full Referer same-origin; origin only cross-origin; no Referer on HTTPS→HTTP. |
| `unsafe-url`                         | Always send the full URL. **Dangerous** — leaks paths and queries.   |

Caller-supplied options always win over settings:

```js
var referrerPolicy = require('gina').plugins.ReferrerPolicy({ value: 'no-referrer' });
```

Tokens are case-insensitive per the spec — values are normalised to lowercase before validation and emission (so `"NO-REFERRER"` is accepted and emitted as `no-referrer`). Invalid tokens throw at factory call time with the full eight-token list + W3C spec URL in the message.

### Choosing a policy

- **Sites that handle authenticated user data** — `strict-origin-when-cross-origin` (default) or `same-origin`. The default leaks no path / query info cross-origin, which protects most session-token-in-URL anti-patterns.
- **Privacy-focused sites** — `no-referrer`. Maximum privacy at the cost of breaking some analytics flows that rely on referrer attribution.
- **Public marketing / documentation sites** — `strict-origin-when-cross-origin` is also a good default; only use `origin-when-cross-origin` if you have a specific cross-origin partner that needs full path info.
- **Never use `unsafe-url`** unless you've confirmed that every URL the page can link out to is safe to leak in full.

### Failure modes

| Condition                                                | Outcome                                              |
|----------------------------------------------------------|------------------------------------------------------|
| `value` omitted                                          | Defaults to `strict-origin-when-cross-origin`        |
| `value` is not one of the 8 W3C tokens                   | Factory throws at call time (bundle won't start)     |
| Plugin not registered                                    | Header not emitted; browser uses its built-in default |
| Header already set by an earlier middleware              | Existing value preserved (idempotent)                |
| Response already sent (`res.headersSent === true`)       | Node's `setHeader` no-ops; request resumes           |

## HSTS (`#HDR4`)

`gina.plugins.Hsts({ maxAge, includeSubDomains, preload })` emits the `Strict-Transport-Security` response header on every response, instructing browsers to access the host exclusively over HTTPS for the next `maxAge` seconds. Once a browser receives a valid HSTS policy from a host, it refuses to make plain HTTP requests to that host for the duration — attempts get upgraded to HTTPS before the network even sees them. This defeats SSL-stripping attacks where an active MITM intercepts the client's first HTTP request and prevents it from ever escalating to HTTPS.

### Adoption

One line in the bundle bootstrap, after the express app is created:

```js title="src/<bundle>/index.js"
var express = require('express');
var hsts    = require('gina').plugins.Hsts();
var app     = express();

app.use(hsts);
```

### Configuration

```jsonc title="src/<bundle>/config/settings.json"
{
  "hsts": {
    "maxAge":            15552000,
    "includeSubDomains": false,
    "preload":           false
  }
}
```

| Field               | Type    | Default     | Notes                                      |
|---------------------|---------|-------------|--------------------------------------------|
| `maxAge`            | number  | `15552000`  | Seconds. Default = 180 days.               |
| `includeSubDomains` | boolean | `false`     | Apply HSTS to all sub-domains too.         |
| `preload`           | boolean | `false`     | Opt into the HSTS preload list.            |

Caller-supplied options always win over settings:

```js
var hsts = require('gina').plugins.Hsts({
    maxAge:            63072000,
    includeSubDomains: true,
    preload:           true
});
```

### Browser-parity invariant on `preload`

`preload: true` requires `includeSubDomains: true` AND `maxAge >= 31536000` (1 year) per the [HSTS preload-list submission requirements](https://hstspreload.org/#deployment-recommendations). The factory throws at call time when the combination is invalid:

```
[gina.plugins.Hsts] preload=true requires includeSubDomains=true per the
HSTS preload-list submission requirements — see
https://hstspreload.org/#deployment-recommendations
```

```
[gina.plugins.Hsts] preload=true requires maxAge>=31536000 (1 year)
per the HSTS preload-list submission requirements; received
maxAge=15552000. See https://hstspreload.org/#deployment-recommendations
```

The HSTS preload list is the browsers' hard-coded HSTS database. Once your hostname is in it, all browsers treat HSTS as active from the moment they install the browser update, regardless of whether they've ever fetched a response from your host. Removal takes months and isn't guaranteed — opting in is a one-way operation in practical terms.

### Choosing values

- **`maxAge`** — start small (`300` = 5 minutes) during initial rollout to bound the blast radius of a mistake; ramp to `15552000` (180 days) for steady state; `63072000` (2 years) is the conventional value for preload-list submission.
- **`includeSubDomains`** — only enable if you're certain *every* sub-domain (including ones added in the future) will be HTTPS-only. Common foot-gun: `app.example.com` enabling `includeSubDomains` and breaking `legacy.example.com` that's stuck on HTTP.
- **`preload`** — only opt in once you've run stable in steady-state for weeks, audited every sub-domain, and accepted that removal is slow.

### Spec note — transport gating

This plugin emits the header on every response regardless of transport. RFC 6797 §7.2 says "An HSTS Host MUST NOT include the STS header field in HTTP responses conveyed over non-secure transport". However, §8.1 also says the user agent "MUST ignore any present STS header field(s)" received over insecure transport — the receiver enforces the policy correctly regardless of what the server sends.

The plugin's design favours proxy-deployment robustness (no dependency on `x-forwarded-proto` being preserved by intermediaries) over sender-side spec purity. helmet's `Strict-Transport-Security` middleware takes the same approach, so adopters migrating from helmet see identical wire behaviour. Bundles that need strict §7.2 compliance can simply not register the plugin in non-HTTPS bundles.

### Failure modes

| Condition                                                | Outcome                                              |
|----------------------------------------------------------|------------------------------------------------------|
| All fields omitted                                       | Emits `max-age=15552000`                             |
| `maxAge` is not a non-negative integer                   | Factory throws at call time                          |
| `preload=true` with `includeSubDomains=false`            | Factory throws with hstspreload.org pointer          |
| `preload=true` with `maxAge<31536000`                    | Factory throws with hstspreload.org pointer          |
| `maxAge=0`                                               | Emits `max-age=0` (clears existing HSTS policy)      |
| Plugin not registered                                    | Header not emitted; browser uses no HSTS policy      |
| Header already set by an earlier middleware              | Existing value preserved (idempotent)                |
| Response already sent (`res.headersSent === true`)       | Node's `setHeader` no-ops; request resumes           |

## Phase 1 complete

All four Phase 1 plugins on the `#HDR` track shipped in `0.3.15-alpha`. Phase 2 (`Csp` #HDR5 + `CrossOriginPolicies` #HDR6) is deferred to `0.4.0` — the dynamic / higher-break-risk headers that require template-render integration or can break legitimate cross-origin loads.

## Phase 2 — deferred to `0.4.0`

The dynamic / higher-break-risk headers ship later, in a separate phase:

- **`gina.plugins.Csp({ directives, reportOnly })` (#HDR5)** — Content-Security-Policy with static directives. Per-response nonce wiring requires template-render integration and defers to a separate CSP-aware view-layer plugin.
- **`gina.plugins.CrossOriginPolicies({ embedder, opener, resource })` (#HDR6)** — COEP/COOP/CORP browsing-context isolation (SharedArrayBuffer gating, `window.opener` isolation, cross-origin resource embedding). Can break legitimate cross-origin loads; opt-in even more conservatively than Phase 1.

## CORS vs response-header policies

CORS handling is a separate concern from this guide. The framework's CORS infrastructure (request-side authorization for cross-origin calls) lives in the server engine and is configured via `settings.json > server.response.header['access-control-allow-origin']`. The plugins documented here are response-side POLICY headers (clickjacking defense, sniffing defense, transport upgrade, etc.) — they apply to every response, not just cross-origin ones.

## See also

- [Sessions guide](/guides/sessions) — `gina.plugins.Session()` hardened cookie defaults (#CSRF1)
- [CSRF guide](/guides/csrf) — `gina.plugins.Csrf()` signed double-submit token middleware + Origin pre-filter (#CSRF2/#CSRF3)
- [Roadmap — Web Security Headers](/roadmap) — track status and Phase 2 plans
