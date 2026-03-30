---
title: Migration Guide
sidebar_label: Migration Guide
sidebar_position: 99
description: Step-by-step upgrade notes for migrating between Gina framework versions, covering breaking changes, new config fields, and required actions.
level: intermediate
prereqs:
  - Existing Gina project
  - Version changelog
---

# Migration Guide

Step-by-step notes for upgrading between Gina versions. Each section lists only
the changes that require action on your part. Additive changes (new optional
fields, new features) are noted for awareness but do not require any change to
existing code. Start from the section that matches your current version and work
upward to the target version.

---

## 0.2.1 → 0.3.0

### `self.query()` — non-2xx errors now always reach the callback

:::caution Behavior change
In 0.2.x, when an upstream service returned a non-2xx status, `self.query()` called
`self.throwError()` **internally**, bypassing the callback entirely. The error page was
shown automatically and the callback never fired.

In 0.3.0, the callback **always fires** for non-2xx responses. The controller action is
responsible for deciding what to do with the error.
:::

**What you need to do:**

If your callback has an error branch, it continues to work — just change the terminal call:

```js
// Before (0.2.x) — callback never fired on non-2xx; throwError was called internally
self.query(opt, function(err, data) {
  if (err) {
    // This line was unreachable in 0.2.x
    return self.throwError(res, 502, err);
  }
  self.render(data);
});

// After (0.3.0) — callback always fires; use self.render(err) to show the error page
self.query(opt, function(err, data) {
  if (err) {
    return self.render(err);   // render() intercepts non-2xx and routes to throwError automatically
  }
  self.render(data);
});
```

If your callback had **no error branch** (relying on the automatic `throwError`), add one:

```js
// Before (0.2.x) — errors were silently handled internally
self.query(opt, function(err, data) {
  self.render(data);
});

// After (0.3.0) — errors reach the callback; handle them explicitly
self.query(opt, function(err, data) {
  if (err) return self.render(err);
  self.render(data);
});
```

See the [controller guide](./guides/controller.md#outgoing-requests) for the full error
shape and handling options.

---

### Async controller actions

:::note Additive — no action required
Existing sync controller actions continue to work exactly as before.
:::

Controller actions can now be declared `async`. The router automatically attaches
`.catch()` to any thenable returned by an action and routes the rejection to
`throwError(response, 500, ...)` — you do not need to wrap every action in
`try/catch` to prevent unhandled-rejection crashes.

```js
// Before (sync — still fully supported, no change needed)
var Controller = function() {
    var self = this;

    this.home = function(req, res, next) {
        self.renderJSON({ ok: true });
    };
};
module.exports = Controller;
```

```js
// After (async — opt in per action)
var db = getModel('blog'); // your database, schema, or bucket name

var Controller = function() {
    var self = this;

    this.home = async function(req, res, next) {
        var user = await db.userEntity.getById(req.session.user.id);
        self.renderJSON({ ok: true, user: user });
    };
};
module.exports = Controller;
```

Entity methods (`await entity.method()`) already worked since 0.2.0 — they
return a native Promise with an `.onComplete(cb)` shim for backwards
compatibility.

### `onCompleteCall(emitter)` — new global helper

For PathObject file operations (`mkdir`, `cp`, `mv`, `rm`) and `Shell` commands,
which fire `.onComplete(cb)` rather than returning a Promise, use the new global
`onCompleteCall()` adapter:

```js
var Controller = function() {
    var self = this;

    this.upload = async function(req, res, next) {
        await onCompleteCall( _(self.uploadDir).mkdir() );
        self.renderJSON({ ok: true });
    };
};
module.exports = Controller;
```

No require needed — `onCompleteCall` is injected globally by the path helper.

---

## 0.2.0 → 0.2.1

### `gina_version` in `manifest.json` — per-bundle framework version pin

:::note Additive — no action required
Bundles without a `gina_version` entry continue to use the socket server's
running version, exactly as before.
:::

A new optional `gina_version` field on each bundle entry in `manifest.json` pins
that bundle to a specific installed gina version. The socket server is unaffected.

```jsonc title="manifest.json"
{
  "bundles": {
    "api": {
      "version":      "0.0.1",
      "gina_version": "0.2.1-alpha.3",   // ← new optional field
      "src":          "src/api"
    }
  }
}
```

`bundle:add` now writes `gina_version` automatically (set to the current
framework version at scaffold time). Existing bundles are unchanged.

The `--gina-version=<version>` flag on `bundle:start` overrides the manifest
declaration at start time. See the [bundle CLI reference](./cli/bundle.md#per-bundle-framework-version)
for the full priority order and isolation behaviour.

---

## 0.1.7 → 0.1.8

### Config interpolation — `${variable}` syntax required

:::danger Breaking change
The `whisper()` interpolation engine — which substitutes variables in config
files (`env.json`, `settings.json`, `app.json`, `templates.json`, `statics.json`,
etc.) — now requires the `${variable}` syntax. Bare `{variable}` placeholders
(without the leading `$`) are **no longer replaced**.
:::

**Action required** for any config file that uses the bare `{variable}` syntax:

```jsonc title="Before (no longer works)"
"logDir":    "{GINA_HOMEDIR}/logs/{scope}/{bundleName}",
"publicUrl": "https://{host}:{port}",
"dbPath":    "{GINA_HOMEDIR}/db/{projectName}"
```

```jsonc title="After"
"logDir":    "${GINA_HOMEDIR}/logs/${scope}/${bundleName}",
"publicUrl": "https://${host}:${port}",
"dbPath":    "${GINA_HOMEDIR}/db/${projectName}"
```

All built-in framework templates shipped with gina have already been updated.
User-managed config files under your bundle's `config/` directory must be
updated manually.

:::note Unaffected syntax
- **Dot-notation path references** (`{gina.core}`, `{gina.utils}`) — whisper
  only matches `${identifier}` where the identifier is word characters (`\w+`).
  Dots fall outside that set, so dot-notation is never replaced regardless of
  whether `$` is present. Leave them as-is.
- **The `{src:...}` wrapper** in `templates.json` — this is a template
  file-include directive, not a whisper variable. The outer `{src:` prefix is
  literal and left untouched. Variables _inside_ the wrapper still use the
  `${variable}` format and are replaced normally:
  ```json
  "pluginLoader": "{src:${gina}/framework/v${version}/core/asset/plugin/dist/vendor/gina/js/gina.onload.min.js}"
  ```
:::

---

## 0.1.6 → 0.1.7

### Cache — sliding window and absolute ceiling

Two optional fields have been added to the per-route `cache` config in
`routing.json`. Existing configs that only use `ttl` are **unchanged** — this
is a purely additive change.

| Field | Type | Default | Description |
|---|---|---|---|
| `sliding` | boolean | `false` | When `true`, the TTL resets on every request that hits the cached entry. The entry stays warm as long as it keeps receiving traffic. |
| `maxAge` | number (seconds, fractional ok) | — | Absolute lifetime ceiling, measured from creation time. Only meaningful when `sliding: true`. Strongly recommended whenever sliding is enabled. |

The meaning of `ttl` changes depending on `sliding`:

| `sliding` | `ttl` meaning |
|---|---|
| `false` (default) | Absolute duration from creation — unchanged behaviour |
| `true` | Idle eviction threshold (seconds since last access); `maxAge` is the hard ceiling |

```jsonc title="routing.json"
// Unchanged — absolute TTL of 1 hour (no action required)
{ "type": "memory", "ttl": 3600 }

// Evict if not accessed for 5 minutes — no hard ceiling
{ "type": "memory", "ttl": 300, "sliding": true }

// Evict if idle for 5 minutes OR after 1 hour — recommended pattern
{ "type": "memory", "ttl": 300, "sliding": true, "maxAge": 3600 }
```

:::caution No hard ceiling without `maxAge`
Without `maxAge`, a constantly-accessed sliding entry never expires. Stale data
can persist indefinitely on busy routes. Always pair `sliding: true` with a
`maxAge` unless you have a separate invalidation strategy via
`invalidateOnEvents`.
:::

The `Cache-Status` response header format is extended for sliding entries:

| Scenario | Header value |
|---|---|
| Non-sliding (unchanged) | `gina-cache; hit; ttl=NNN` |
| Sliding | `gina-cache; hit; ttl=NNN; max-age=MMM` |

- `ttl=` — remaining seconds in the current idle window
- `max-age=` — remaining seconds until the absolute ceiling

See the [Caching guide](./guides/caching) for the full reference.

---

### Cache — sub-second TTL and maxAge values

`ttl` and `maxAge` now accept fractional seconds (e.g. `0.5` for 500 ms).
Previously, fractional values were silently truncated to zero, causing immediate
eviction. Integer values are unchanged — **no action required** on existing configs.

---

### Per-route query timeout — `queryTimeout` field

A new optional `queryTimeout` field is available on every route in `routing.json`. When set,
it acts as the timeout budget for outgoing `self.query()` calls made within that route's
controller action — without having to pass `requestTimeout` explicitly at every call site.

This is a **purely additive change** — existing `routing.json` files require no modification.

```jsonc title="routing.json"
"report-export": {
  "url": "/reports/:id/export",
  "param": { "control": "export" },
  "queryTimeout": "120s"   // or 120000 — both are accepted
}
```

Priority order for `self.query()` timeout (highest wins):

1. `requestTimeout` in the `self.query()` options object (explicit call-site override)
2. `queryTimeout` on the matched route in `routing.json` (per-route default)
3. Framework hard default — `10s`

See the [Routing guide](./guides/routing#per-route-query-timeout) for full details.

:::note Why not `timeout`?
`timeout` is reserved for future incoming-request cancellation. `queryTimeout` is scoped
exclusively to outgoing `self.query()` calls, making its intent unambiguous.
:::

---

### `app.json` proxy — `timeout` renamed to `requestTimeout`

The `timeout` field on a proxy target entry in `app.json` has been renamed to
`requestTimeout`. This is a **breaking rename** — update every `proxy.<service>`
block that declares a `timeout` value.

```jsonc title="src/dashboard/config/app.json — before"
"proxy": {
  "coreapi": {
    "hostname": "coreapi@myproject",
    "port"    : "coreapi@myproject",
    "timeout" : "30s"   // ← rename this
  }
}
```

```jsonc title="src/dashboard/config/app.json — after"
"proxy": {
  "coreapi": {
    "hostname"      : "coreapi@myproject",
    "port"          : "coreapi@myproject",
    "requestTimeout": "30s"   // ✓
  }
}
```

If `timeout` is omitted, behaviour is unchanged — the framework default of `10s` applies.

:::note Priority order for outgoing request timeout
`self.query()` resolves the request timeout in this order (highest wins):
1. `requestTimeout` in the `self.query()` options object (explicit call-site override)
2. `requestTimeout` on the matched proxy target in `app.json`
3. `queryTimeout` on the matched route in `routing.json`
4. Framework hard default — `10s`
:::

---

### Timeout config — human-readable string format

All timeout fields in `settings.json` and `app.json` now accept duration strings
in addition to plain millisecond integers. Plain integers continue to work
unchanged.

Accepted units: `ms`, `s`, `m`, `h`

```jsonc title="settings.json (example)"
"keepAliveTimeout": "5s",      // was 5000
"headersTimeout":   "5500ms",  // was 5500
"pingInterval":     "5s",      // was 5000
"pingTimeout":      "45s",     // was 45000
"timeout":          "30s"      // was 30000 (proxy config)
```

:::note autoTmpCleanupTimeout
The `autoTmpCleanupTimeout` string format (`"10m"` etc.) was documented since
0.1.x but silently broken — the value was parsed as `NaN`. It is correctly
parsed as of 0.1.7.
:::

---

## 0.1.x → 0.1.6

### Node.js

Minimum version bumped to **Node 18**. Maximum `< 26`. Drop support for Node
16 and 17.

---

### Docker / Kubernetes

Use the new `gina-container` binary for foreground bundle launch in containers.
It handles `SIGTERM` gracefully and does not use the background daemon mode.

In your `Dockerfile` or Kubernetes spec, replace:

```sh
gina bundle:start <bundle> @<project>
```

with:

```sh
gina-container bundle:start <bundle> @<project>
```

See the [K8s and Docker guide](./guides/k8s-docker) for the full signal
propagation design and graceful shutdown details.

---

### Upload config — automatic tmp cleanup

`autoTmpCleanupTimeout` is now available in `settings.json` to schedule
automatic removal of uploaded temporary files. No action required if you do not
use file uploads.

```jsonc title="settings.json"
"upload": {
  "autoTmpCleanupTimeout": false  // false | 0 to disable, or a duration e.g. "10m"
}
```

Default is `false` (disabled).

---

### Security — swig CVE-2023-25345

Patched in-place in the vendored swig 1.4.2. **No user action required.**

Template paths in `{% extends %}` tags and relative/absolute `file` paths are
now validated against the template root before being read.

---

## 0.0.9p2 → 0.1.x

### Node.js

Minimum version is now **Node 16**. Drop support for Node < 16.

---

### `settings.json` — new server fields

Add a `server` block to every bundle's `settings.json`:

```json title="src/<bundle>/config/settings.json"
{
  "server": {
    "engine": "isaac",
    "keepAliveTimeout": 5000,
    "headersTimeout": 5500,
    "http2Options": {
      "maxConcurrentStreams": 128
    }
  }
}
```

Use `"engine": "express"` to keep the legacy Express adapter.

---

### HTTP/2 (isaac engine)

TLS certificates are required. HTTP/1.1 fallback is available via `allowHTTP1`.

```json title="src/<bundle>/config/settings.json"
{
  "server": {
    "protocol": "http/2.0",
    "scheme": "https",
    "allowHTTP1": true,
    "credentials": {
      "privateKey":  "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/private.key",
      "certificate": "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/certificate.crt",
      "ca":          "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/ca_bundle.crt"
    }
  }
}
```

See the [HTTPS guide](./guides/https) for certificate setup instructions.

---

### `app.json` — proxy config new fields

```jsonc title="src/<bundle>/config/app.json"
"proxy": {
  "<service>": {
    "ca":       "<path to CA bundle>",
    "hostname": "<bundle>@<project>",
    "port":     "<bundle>@<project>",
    "path":     "<base path>"
  }
}
```

---

### engine.io / WebSocket (optional)

If using `ioServer`, add to `settings.json`:

```json title="src/<bundle>/config/settings.json"
{
  "ioServer": {
    "integrationMode": "attach",
    "transports": ["websocket", "polling"],
    "pingInterval": 5000,
    "pingTimeout": 10000
  }
}
```

---

## 0.0.9 → 0.0.9p1

- Move statics definitions from `config/views.json` to `config/statics.json`.
- In `project.json`, for each bundle declaration, remove the `target` key from
  `bundle.release.target`.

---

## 0.0.9p1 → 0.0.9p2

No action required.
