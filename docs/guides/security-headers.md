---
title: Security Headers
sidebar_label: Security Headers
sidebar_position: 45
description: Opt-in middleware plugins that emit HTTP security response headers — X-Content-Type-Options today, with X-Frame-Options, Referrer-Policy, and HSTS landing in the rest of the 0.3.15-alpha cycle.
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

## Coming in the rest of `0.3.15-alpha`

Phase 1 ships four plugins; the remaining three are queued for follow-up commits within the same `0.3.15-alpha` cycle:

- **`gina.plugins.XFrameOptions({ value })` (#HDR2)** — clickjacking defense via the `X-Frame-Options` header. Settings: `xFrameOptions.value: "DENY"` or `"SAMEORIGIN"` (default `"SAMEORIGIN"`). Rejects the legacy `"ALLOW-FROM"` value (modern browsers ignore it; CSP `frame-ancestors` is the modern replacement).
- **`gina.plugins.ReferrerPolicy({ value })` (#HDR3)** — referrer leak control via the `Referrer-Policy` header. Settings: `referrerPolicy.value` is one of the eight RFC tokens (`"no-referrer"`, `"strict-origin-when-cross-origin"`, etc.). Default `"strict-origin-when-cross-origin"` matches the browser default since ~2021.
- **`gina.plugins.Hsts({ maxAge, includeSubDomains, preload })` (#HDR4)** — HTTPS-only enforcement via the `Strict-Transport-Security` header. Defaults: `maxAge: 15552000` (180 days), `includeSubDomains: false`, `preload: false`. Browser-parity invariant: `preload: true` requires `includeSubDomains: true` AND `maxAge >= 31536000` (1 year) per the HSTS preload-list submission requirements; the factory throws at call time when the combination is invalid.

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
