---
title: Observability — Prometheus Metrics
sidebar_label: Observability
sidebar_position: 5.5
description: Built-in Prometheus metrics endpoint for Gina bundles. Opt-in via app.json metrics.enabled. Exposes Node.js process metrics plus HTTP request counters and duration histograms with cardinality-safe route labels. IP allowlist by default.
level: intermediate
prereqs:
  - '[routing.json reference](/reference/routing)'
  - '[app.json reference](/reference/app)'
  - '[Prometheus exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/)'
  - '[prom-client npm](https://www.npmjs.com/package/prom-client)'
---

# Observability — Prometheus Metrics

Each Gina bundle can expose a built-in `/_gina/metrics` endpoint that emits
[Prometheus exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/)
text. Point your Prometheus scraper at `host:port/_gina/metrics` per bundle —
no sidecar required. Each bundle is an independent scrape target on its own
port.

The feature is opt-in via `app.json`. Loading is via the standard peer-dep
pattern: `prom-client` is installed in your project's `node_modules`, not
vendored.

---

## How it works

```mermaid
sequenceDiagram
    participant B as Browser / Client
    participant G as Gina handler
    participant L as Lifecycle hook
    participant M as lib.metrics
    participant P as Prometheus scraper

    Note over B,M: Per-request — recorded automatically when metrics is enabled
    B->>G: GET /home
    G->>L: response.on('finish') registered at request entry
    G-->>B: 200 OK (response.end)
    L->>M: recordRequest({method, route, status, duration})
    M->>M: gina_http_requests_total{method,route,status} += 1
    M->>M: gina_http_request_duration_seconds.observe(duration_s)

    Note over B,P: Scrape — periodic GET against the metrics endpoint
    P->>G: GET /_gina/metrics (from 127.0.0.1)
    G->>M: lib.metrics.isClientAllowed(req)?
    M-->>G: true (loopback in allowlist)
    G->>M: lib.metrics.isEnabled()?
    M-->>G: true
    G->>M: lib.metrics.getMetrics()
    M-->>G: # HELP ... # TYPE ... <text>
    G-->>P: 200 text/plain; version=0.0.4; charset=utf-8
```

---

## Adoption

Three steps:

### 1. Install `prom-client` in your project

```bash
npm install prom-client
```

`prom-client` is a peer dependency — Gina does not bundle it. The framework
loads it from your project's `node_modules` directory using the same
convention as `mysql2`, `ioredis`, and the AI SDKs.

### 2. Opt in via `app.json`

```json title="src/<bundle>/config/app.json"
{
  "$schema":  "https://gina.io/schema/app.json",
  "name":     "<bundle>",
  "version":  "0.0.1",
  "metrics": {
    "enabled":   true,
    "path":      "/_gina/metrics",
    "allowFrom": ["127.0.0.1", "::1"],
    "prefix":    "gina_",
    "defaultMetrics": true
  }
}
```

### 3. Restart the bundle

```bash
gina bundle:restart <bundle>
```

Verify with:

```bash
curl http://127.0.0.1:<port>/_gina/metrics
```

You should see Prometheus exposition output beginning with `# HELP gina_…`.

---

## Configuration reference

All keys live under `app.json` `metrics`:

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `enabled` | boolean | `false` | Master opt-in. `false` = endpoint returns 503 with a hint; no metrics are collected and no listener is registered. |
| `path` | string | `/_gina/metrics` | Endpoint path. Custom paths are not yet supported (the router only registers the default). |
| `allowFrom` | string[] | `["127.0.0.1", "::1"]` | IP allowlist. Empty array `[]` denies everyone (explicit lockdown). |
| `prefix` | string | `gina_` | Prefix applied to every metric name. |
| `defaultMetrics` | boolean | `true` | When `true`, `prom-client.collectDefaultMetrics()` seeds Node.js process metrics. |

Changes to the `metrics` block require a bundle restart. There is no
hot-reload (same convention as other `app.json` values).

---

## Built-in metrics

When the endpoint is enabled and a bundle is running, the following metrics
are exposed (all prefixed with `prefix` — defaults shown):

### Node.js process

Seeded by `prom-client.collectDefaultMetrics()`. Includes:

- `gina_process_cpu_user_seconds_total`
- `gina_process_cpu_system_seconds_total`
- `gina_process_resident_memory_bytes`
- `gina_nodejs_heap_size_total_bytes`
- `gina_nodejs_heap_size_used_bytes`
- `gina_nodejs_eventloop_lag_seconds`
- `gina_nodejs_active_handles_total`
- `gina_nodejs_active_requests_total`
- `gina_nodejs_gc_duration_seconds` (histogram)

…and several more — see [prom-client default metrics](https://github.com/siimon/prom-client#default-metrics).

### HTTP request counter

```
gina_http_requests_total{method, route, status}
```

Counter incremented once per request when the response has been sent.

### HTTP request duration

```
gina_http_request_duration_seconds{method, route, status}
```

Histogram with default buckets covering 5ms to 10s (override via
`durationBuckets` if you call `lib.metrics.start()` directly):

```
[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
```

---

## Cardinality safety

The `route` label uses **`req.routing.rule`** — the routing.json key — NOT
the raw URL. Without this guarantee, every distinct path-parameter value
(`/users/123`, `/users/124`, …) creates a new time-series and Prometheus
cardinality blows up.

For unmatched paths (404 / 405 / errors that occur before route resolution),
the label is derived from the response status code:

| Status | Route label |
| --- | --- |
| `404` | `__not_found__` |
| `405` | `__method_not_allowed__` |
| `>= 500` (no matched route) | `__error__` |
| Other (no matched route) | `__no_route__` |

This keeps the cardinality bounded even under aggressive URL probing.

---

## Security — IP allowlist

The metrics endpoint reads the client IP from `request.socket.remoteAddress`
(or `request.connection.remoteAddress` as a fallback). It deliberately does
**NOT** trust the `X-Forwarded-For` header — reverse proxies could spoof
that, and the metrics endpoint is for direct scrapers (Prometheus, internal
admin tooling), never proxied public traffic.

`::ffff:127.0.0.1` (IPv6-mapped IPv4) is normalised to `127.0.0.1`, so a
listed IPv4 entry matches both forms.

If you need to expose metrics to a remote Prometheus server, list its
hostname's resolved IP explicitly:

```json
"allowFrom": ["127.0.0.1", "::1", "10.0.0.42"]
```

For lockdown (no scrapers allowed), set `allowFrom: []`.

---

## Adding custom metrics

The framework's `lib.metrics.getRegistry()` returns the underlying
`prom-client` Registry instance. Register custom counters / histograms /
gauges on it from your controller code:

```js
var prom = require(_(getPath('project') + '/node_modules/prom-client', true));
var lib  = require('gina').lib;

var registry = lib.metrics.getRegistry();
if (registry) {
    var ordersTotal = new prom.Counter({
        name:       'orders_total',
        help:       'Total orders placed',
        labelNames: ['payment_method'],
        registers:  [registry]
    });

    // In your controller:
    ordersTotal.inc({ payment_method: 'card' });
}
```

Custom metrics show up at the same `/_gina/metrics` endpoint alongside the
built-ins.

---

## Endpoint responses

| Scenario | Status | Content-Type | Body |
| --- | --- | --- | --- |
| Client IP not in allowlist | `403` | `application/json` | `{ "error": "forbidden", "message": "..." }` |
| `metrics.enabled` is `false` (or `start()` failed) | `503` | `text/plain; version=0.0.4` | `# /_gina/metrics — metrics not enabled\n# set app.json metrics.enabled to true and install prom-client...` |
| Success | `200` | `text/plain; version=0.0.4; charset=utf-8` | Prometheus exposition |
| Internal error during `getMetrics()` | `500` | `application/json` | `{ "error": "metrics_error", "message": "..." }` |

---

## Operational notes

- **Per-bundle scrape targets.** Configure Prometheus to scrape each bundle
  at its own `host:port/_gina/metrics`. Bundles do not aggregate; they are
  independent processes with independent metrics.
- **Zero overhead when disabled.** When `metrics.enabled` is `false`, the
  request-lifecycle listener is never registered. The `if
  (lib.metrics.isEnabled())` gate at request entry is the only per-request
  cost.
- **No hot-reload.** Bundle restart is required to pick up `app.json
  metrics` changes — same as other `app.json` config.
- **Bundle init — non-fatal on missing peer-dep.** If `metrics.enabled` is
  `true` but `prom-client` is not installed, the framework emits
  `console.warn('[lib.metrics] init skipped: ...')` instead of crashing
  the bundle. The endpoint returns 503 until you install the package and
  restart.
- **No `X-Forwarded-For` trust.** Document the proxy chain in your
  Prometheus deployment if scrapers are remote — list the proxy's egress IP
  in `allowFrom`, NOT the original client IP from XFF.

---

## Related

- [`app.json` reference](/reference/app)
- [`routing.json` reference](/reference/routing)
- [Prometheus best practices: cardinality](https://prometheus.io/docs/practices/naming/#labels)
- [`prom-client` documentation](https://github.com/siimon/prom-client)
