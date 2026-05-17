---
title: Security Headers
sidebar_label: Security Headers
sidebar_position: 45
description: Opt-in middleware plugins that emit HTTP security response headers — X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, Origin-Agent-Cluster, and Content-Security-Policy. Phase 1 modern coverage shipped in 0.3.15-alpha; Phase 2 opens with #HDR5 Csp in 0.4.0-alpha.
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

## Content-Security-Policy (`#HDR5`)

`gina.plugins.Csp({ directives, reportOnly })` emits the `Content-Security-Policy` (or `Content-Security-Policy-Report-Only`) response header on every response, limiting which resources the browser is allowed to load and from where. CSP is the modern defense against cross-site scripting (XSS) and data injection — by declaring an allowlist of permitted source origins for scripts, styles, images, fonts, frames, and connections, the browser refuses to execute anything that doesn't match the policy, even if an attacker manages to inject content via stored XSS.

**Opens Phase 2** of the security-headers track in `0.4.0-alpha`. CSP has a larger configuration surface than the Phase 1 plugins — see the dedicated [Content-Security-Policy guide](/guides/csp) for the full reference (directive whitelist, value formats, security guidance, failure modes).

### Adoption

```js title="src/<bundle>/index.js"
var express = require('express');
var csp     = require('gina').plugins.Csp({
    directives: {
        'default-src': ["'self'"],
        'script-src':  ["'self'", 'https://cdn.example.com'],
        'style-src':   ["'self'", "'unsafe-inline'"],
        'img-src':     ["'self'", 'data:', 'https:'],
        'upgrade-insecure-requests': true
    }
});
var app     = express();

app.use(csp);
```

`directives` is required — there is no sensible cross-bundle default since every bundle has its own resource graph. The factory throws at call time if `directives` is missing or empty.

### Configuration

```jsonc title="src/<bundle>/config/settings.json"
{
  "csp": {
    "directives": {
      "default-src": ["'self'"],
      "script-src":  ["'self'", "https://cdn.example.com"],
      "style-src":   ["'self'", "'unsafe-inline'"],
      "img-src":     ["'self'", "data:"],
      "upgrade-insecure-requests": true
    },
    "reportOnly": false
  }
}
```

| Field        | Type    | Default | Notes                                                                |
|--------------|---------|---------|----------------------------------------------------------------------|
| `directives` | object  | —       | **Required.** Throws if missing or empty.                            |
| `reportOnly` | boolean | `false` | When `true`, emits `Content-Security-Policy-Report-Only` instead.   |

### Strict whitelist on directive names

The plugin enforces a **strict whitelist of 27 CSP Level 3 standard directives**. Unknown directive names throw at factory call time — fail-fast is the only way to catch typos like `scrpt-src` (browsers silently ignore unknown directives, so without the throw the page would be unprotected with no error). Full directive list and value-format reference in the [dedicated guide](/guides/csp).

### `reportOnly` — non-enforcing migration testing

Setting `reportOnly: true` switches the response header name from `Content-Security-Policy` to `Content-Security-Policy-Report-Only`. Browsers report violations but do not block any resources. Useful when rolling out a new policy: ship it as report-only first, collect violations from real traffic for a few days, refine the policy, then flip to enforcing.

### v0 limitation — static directives only

v0 ships **static directives only**. Per-response nonce wiring (emitting `script-src 'nonce-<random>'` with a fresh nonce per render that the template engine then writes onto inline `<script>` tags) requires template-render integration and defers to a future CSP-aware view-layer plugin that can co-operate with swig / nunjucks template rendering.

For now, inline scripts and styles must use `'unsafe-inline'` (loosens the policy — only acceptable when the rest of the policy is strict enough to make XSS injection of inline content hard) or be moved to external files served from a script-src-allowed origin.

### Failure modes

| Condition                                                | Outcome                                              |
|----------------------------------------------------------|------------------------------------------------------|
| `directives` omitted / null / non-object                 | Factory throws at call time                          |
| `directives` is an empty object                          | Factory throws with directives-list pointer          |
| `directives` contains an unknown directive name          | Factory throws with full whitelist in message        |
| Boolean-only directive given a non-boolean value         | Factory throws with directive name in message        |
| Source-list directive given `true` (and not `sandbox`)   | Factory throws with directive-category explanation   |
| Source-list directive array contains a non-string entry  | Factory throws with index in message                 |
| All directives resolve to `false` (omitted)              | Factory throws — empty CSP is invalid                |
| `reportOnly` is non-boolean                              | Factory throws                                       |
| Plugin not registered                                    | Header not emitted; browser applies no CSP           |
| Header already set by an earlier middleware              | Existing value preserved (idempotent)                |
| Response already sent (`res.headersSent === true`)       | Node's `setHeader` no-ops; request resumes           |

## Cross-Origin-Embedder-Policy (`#HDR6`)

`gina.plugins.Coep({ value })` emits `Cross-Origin-Embedder-Policy` (COEP) on every response, controlling which cross-origin resources the page may embed.

COEP is half of the **cross-origin isolation** pair (the other half is `Cross-Origin-Opener-Policy` / #HDR13). Setting both to their strictest values (`COEP: require-corp` + `COOP: same-origin`) unlocks browser features gated behind isolation: `SharedArrayBuffer` (required by WebAssembly threads, multi-threaded `OffscreenCanvas`), and high-resolution `performance.now()` (sub-millisecond precision, coarsened otherwise to mitigate Spectre side-channel attacks).

COEP also independently defends against cross-site script injection: with `require-corp` set, the browser refuses to load any cross-origin resource that doesn't explicitly opt in via `Cross-Origin-Resource-Policy` (CORP, #HDR14) or CORS. An attacker who injects `<script src="https://evil.com/x.js">` can't load the script unless `evil.com` returns the matching CORP or CORS header.

Browser support: Chrome 83+, Edge 83+, Firefox 79+, Safari 15.2+.

### Adoption

One line in the bundle bootstrap, after the express app is created:

```js title="src/<bundle>/index.js"
var express = require('express');
var coep    = require('gina').plugins.Coep();
var app     = express();

app.use(coep);
```

### Configuration

```jsonc title="src/<bundle>/config/settings.json"
{
  "coep": {
    "value": "require-corp"
  }
}
```

| Field   | Type   | Default        | Valid values                                       |
|---------|--------|----------------|----------------------------------------------------|
| `value` | string | `require-corp` | `require-corp`, `credentialless`, `unsafe-none`    |

### Three values per the W3C HTML spec

| Token            | Behaviour                                                                                  |
|------------------|--------------------------------------------------------------------------------------------|
| `require-corp`   | **Default**. Cross-origin resources must opt-in via CORP or CORS, otherwise blocked. Required (paired with `COOP: same-origin`) for `SharedArrayBuffer` and high-res `performance.now()`. |
| `credentialless` | Cross-origin no-CORS requests sent WITHOUT credentials (cookies, HTTP auth). Less restrictive than `require-corp` but still gates the cross-origin-isolation combo. |
| `unsafe-none`    | Browser default. No restrictions; equivalent to not setting the header. Use to explicitly opt OUT (e.g. to override a stricter upstream default). |

Tokens are case-insensitive at the plugin layer — values are normalised to lowercase before validation and emission. The spec defines them as lowercase enumerated strings; browsers parse case-sensitively, so the emitted header is always lowercase.

Caller-supplied options always win over settings:

```js
var coep = require('gina').plugins.Coep({ value: 'credentialless' });
```

### Tradeoff with the `require-corp` default

The strict default `require-corp` enables the SharedArrayBuffer + cross-origin-isolation combo, but BREAKS pages that load cross-origin resources (images, fonts, scripts on a CDN, embedded videos) that don't carry the matching `Cross-Origin-Resource-Policy` (CORP) or CORS header. Symptoms: blocked resources appear as failed network requests in DevTools with a `NotSameOriginAfterDefaultedToSameOriginByCoep` error.

Three escape hatches when `require-corp` breaks an embed:

1. **Set CORP on the embedded resource** (preferred) — if you control the origin serving the embed, add `Cross-Origin-Resource-Policy: cross-origin` (or use #HDR14 `gina.plugins.Corp()` on that bundle).
2. **Downgrade to `credentialless`** — cookies and HTTP auth are stripped on cross-origin no-CORS requests, but no explicit CORP header is required. Compatible with most public CDN content (fonts, images) that don't need credentials.
3. **Downgrade to `unsafe-none`** — gives up cross-origin isolation entirely. The page can embed anything but loses `SharedArrayBuffer` and high-resolution timers.

### Pair with COOP for the SharedArrayBuffer combo

To enable `SharedArrayBuffer` and the rest of the cross-origin-isolated-context features, register BOTH plugins together (COOP ships in a follow-up slice):

```js
var coep = require('gina').plugins.Coep();                          // require-corp (default)
var coop = require('gina').plugins.Coop({ value: 'same-origin' });  // default — when #HDR13 ships
app.use(coep);
app.use(coop);
```

The page becomes cross-origin-isolated and `window.crossOriginIsolated` returns `true`. See the W3C HTML spec section on [cross-origin isolation](https://html.spec.whatwg.org/multipage/browsers.html#cross-origin-isolated) for the full feature gate.

### Failure modes

| Condition                                                | Outcome                                              |
|----------------------------------------------------------|------------------------------------------------------|
| `value` omitted                                          | Defaults to `require-corp`                            |
| `value` is not one of the 3 W3C tokens                   | Factory throws at call time (bundle won't start)     |
| `value` is not a string                                  | Factory throws at call time                          |
| Plugin not registered                                    | Header not emitted; browser uses default behaviour   |
| Header already set by an earlier middleware              | Existing value preserved (idempotent)                |
| Response already sent (`res.headersSent === true`)       | Node's `setHeader` no-ops; request resumes           |
| Cross-origin embed without matching CORP/CORS            | Embed BLOCKED (DevTools shows the `NotSameOriginAfterDefaultedToSameOriginByCoep` error) — see the three escape hatches above |

## Origin-Agent-Cluster (`#HDR7`)

`gina.plugins.OriginAgentCluster()` emits `Origin-Agent-Cluster: ?1` on every response, requesting that the browser place this page's origin in its own agent cluster (origin-keyed) rather than the default site-keyed (eTLD+1) cluster.

By default, two same-site cross-origin pages (e.g. `app.example.com` and `marketing.example.com`) share an agent cluster — they can synchronously script each other if either page sets `document.domain`. Origin-Agent-Cluster opts the page out of this: it gets its own agent, isolated from sibling-origin pages, and `document.domain` becomes a no-op. The browser may also place origin-keyed agents in their own OS process where possible, limiting the blast radius of Spectre-class side-channel attacks.

### Adoption

One line in the bundle bootstrap, after the express app is created:

```js title="src/<bundle>/index.js"
var express            = require('express');
var originAgentCluster = require('gina').plugins.OriginAgentCluster();
var app                = express();

app.use(originAgentCluster);
```

### Configuration

```jsonc title="src/<bundle>/config/settings.json"
{
  "originAgentCluster": {}
}
```

The block is reserved for future fields (e.g. per-route opt-out). Today the plugin has no tunable options — `?1` (Structured Header boolean true) is the only useful value per the [HTML spec](https://html.spec.whatwg.org/multipage/document-sequences.html#origin-keyed-agent-clusters); `?0` is the browser default and emitting it would be a no-op. There is no `enabled` flag; register the plugin to opt in, do not register to opt out.

### Browser support

Chrome 88+, Edge 88+, Firefox 109+, Safari 15+. Older browsers ignore the header silently — safe to register unconditionally.

### When NOT to register

If your bundle relies on `document.domain` to bridge same-site origins (e.g. `app.example.com` and `legacy.example.com` setting `document.domain = "example.com"` to script each other), Origin-Agent-Cluster will break that pattern. The pattern is rare in modern web apps but worth checking.

### Failure modes

| Condition                                                | Outcome                                              |
|----------------------------------------------------------|------------------------------------------------------|
| Plugin not registered                                    | Header not emitted; browser uses default site-keyed agent |
| Header already set by an earlier middleware              | Existing value preserved (idempotent)                |
| Response already sent (`res.headersSent === true`)       | Node's `setHeader` no-ops; request resumes           |
| Browser predates the feature                             | Header ignored silently — harmless                   |
| Same-origin policy relies on `document.domain`           | Will break; do not register the plugin               |

## Phase 1 complete (modern coverage)

All five modern Phase 1 plugins on the `#HDR` track shipped in `0.3.15-alpha`:

- `gina.plugins.XContentTypeOptions()` (#HDR1) — MIME-sniffing defense
- `gina.plugins.XFrameOptions({ value })` (#HDR2) — clickjacking defense
- `gina.plugins.ReferrerPolicy({ value })` (#HDR3) — referrer leakage control
- `gina.plugins.Hsts({ maxAge, includeSubDomains, preload })` (#HDR4) — HTTPS-only enforcement
- `gina.plugins.OriginAgentCluster()` (#HDR7) — origin-keyed isolation

**Phase 1.5 — helmet-parity gap-fill** (roadmapped for `0.3.16-alpha`+): the lower-priority headers helmet bundles but we don't yet cover (`HidePoweredBy` #HDR8, `X-DNS-Prefetch-Control` #HDR9, `X-XSS-Protection` #HDR10, `X-Download-Options` #HDR11, `X-Permitted-Cross-Domain-Policies` #HDR12). Defense-in-depth + parity narrative; the four legacy ones (#HDR10–12 + #HDR9 to a lesser extent) have minimal practical value in 2026.

**Phase 2 — dynamic / higher-break-risk** (targeted at `0.4.0-alpha`): `Csp` (#HDR5) **shipped** with static directives only — per-response nonce wiring defers to a future CSP-aware view-layer plugin that can co-operate with swig / nunjucks template rendering. Cross-origin policies (#HDR6) revised to a three-plugin split (Coep / Coop / Corp = HDR6 / HDR13 / HDR14) for consistency with the future combined-wrapper API; `Coep` (#HDR6) **shipped**, `Coop` and `Corp` follow. The combined `gina.plugins.SecurityHeaders({...})` wrapper (#HDR15) closes Phase 2 — one mount + one settings block composing HDR1-7 + HDR5 + HDR6 / HDR13 / HDR14 (mirrors helmet's `helmet()` combined wrapper).

## Phase 2 — in progress (`0.4.0-alpha`)

The dynamic / higher-break-risk headers ship in Phase 2:

- **`gina.plugins.Csp({ directives, reportOnly })` (#HDR5)** — Content-Security-Policy with static directives. **Shipped** — see the dedicated [Content-Security-Policy guide](/guides/csp) for the full reference. Per-response nonce wiring deferred to a future CSP-aware view-layer plugin.
- **`gina.plugins.Coep({ value })` (#HDR6)** — Cross-Origin-Embedder-Policy. Required for SharedArrayBuffer access (Spectre defense). **Shipped** — see the [Cross-Origin-Embedder-Policy section](#cross-origin-embedder-policy-hdr6) above.
- **`gina.plugins.Coop({ value })` (#HDR13)** — Cross-Origin-Opener-Policy. Isolates `window.opener` references on top-level navigation. **Coming up.**
- **`gina.plugins.Corp({ value })` (#HDR14)** — Cross-Origin-Resource-Policy. Restricts which other origins can fetch this resource. **Coming up.**
- **`gina.plugins.SecurityHeaders({...})` (#HDR15)** — Combined wrapper composing HDR1-7 + HDR5 + HDR6 / HDR13 / HDR14 for one-mount + one-config-block convenience. Mirrors helmet's `helmet()` combined wrapper. **Coming up — closes Phase 2.**

## CORS vs response-header policies

CORS handling is a separate concern from this guide. The framework's CORS infrastructure (request-side authorization for cross-origin calls) lives in the server engine and is configured via `settings.json > server.response.header['access-control-allow-origin']`. The plugins documented here are response-side POLICY headers (clickjacking defense, sniffing defense, transport upgrade, etc.) — they apply to every response, not just cross-origin ones.

## See also

- [Sessions guide](/guides/sessions) — `gina.plugins.Session()` hardened cookie defaults (#CSRF1)
- [CSRF guide](/guides/csrf) — `gina.plugins.Csrf()` signed double-submit token middleware + Origin pre-filter (#CSRF2/#CSRF3)
- [Roadmap — Web Security Headers](/roadmap) — track status and Phase 2 plans
