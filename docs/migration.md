---
sidebar_position: 99
---

# Migration guide

Step-by-step notes for upgrading between Gina versions. Each section lists only
the changes that require action on your part. Additive changes (new optional
fields, new features) are noted for awareness but do not require any change to
existing code.

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
      "privateKey":  "{GINA_HOMEDIR}/certificates/scopes/{scope}/{host}/private.key",
      "certificate": "{GINA_HOMEDIR}/certificates/scopes/{scope}/{host}/certificate.crt",
      "ca":          "{GINA_HOMEDIR}/certificates/scopes/{scope}/{host}/ca_bundle.crt"
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
