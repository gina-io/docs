---
title: settings.json
sidebar_label: settings.json
sidebar_position: 4
description: Reference for settings.json and its server, locale, cache, upload, and WebSocket sub-files — the full server configuration surface for a Gina bundle.
level: intermediate
prereqs:
  - '[Projects and bundles](/concepts/projects-and-bundles)'
---

# settings.json

Controls how the bundle's HTTP server runs: engine, protocol, locale, file uploads,
and caching. Several companion files extend the same settings tree for credentials,
CORS, and per-environment cache toggles.

```
src/<bundle>/config/
├── settings.json                       ← server, locale, upload, cache
├── settings.server.json                ← webroot, CORS (server-side only)
├── settings.server.credentials.json    ← TLS certificate paths
├── settings.server.cache.${env}.json    ← cache on/off per environment
└── settings.server.resolvers.json      ← DNS resolvers per scope
```

All `settings*.json` files in the `config/` directory are merged into a single
settings tree at startup. See the [load order](./index.md#load-order) for how
section names are derived from filenames.

---

## settings.json

The primary server settings file.

```json title="src/frontend/config/settings.json"
{
  "server": {
    "engine"   : "isaac",
    "protocol" : "http/2.0",
    "scheme"   : "https",
    "address"  : "0.0.0.0"
  },
  "locale": {
    "region"              : "en_CM",
    "preferedLanguages"   : ["en-CM", "en"],
    "firstDayOfWeek"      : 1,
    "calendar"            : "gregorian",
    "24HourTimeFormat"    : true
  },
  "cache": {
    "enable": false
  }
}
```

### `server`

| Field | Type | Default | Description |
|---|---|---|---|
| `engine` | `"isaac"` | `"isaac"` | HTTP server engine. `"isaac"` is the built-in HTTP/2 engine |
| `protocol` | `"http/2.0"` \| `"http/1.1"` | `"http/2.0"` | Wire protocol |
| `scheme` | `"https"` \| `"http"` | `"https"` | URL scheme |
| `address` | string | `"0.0.0.0"` | Bind address. Use `"127.0.0.1"` for IPv4-only or `"::"` for IPv6-only |
| `allowHTTP1` | boolean | `true` | Accept HTTP/1.1 connections on the HTTP/2 server |
| `keepAliveTimeout` | string | `"5s"` | Keep-alive socket timeout (e.g. `"5s"`, `"30s"`) |
| `headersTimeout` | string | `"5500ms"` | Headers timeout — must be greater than `keepAliveTimeout` |
| `backlog` | number | `511` | Connection queue length |

### `locale`

Locale settings are used by the i18n layer, date/number formatting, and currency display.

| Field | Type | Default | Description |
|---|---|---|---|
| `region` | string | `"EN"` | Locale code. Format: `"lang_COUNTRY"` (e.g. `"en_CM"`, `"fr_CM"`, `"fr_FR"`) |
| `preferedLanguages` | string[] | `["en-CM", "en"]` | Accepted-Language preference order |
| `firstDayOfWeek` | `0`–`6` | `1` | `0` = Sunday, `1` = Monday |
| `calendar` | string | `"gregorian"` | Calendar system |
| `24HourTimeFormat` | boolean | `true` | Use 24-hour time format |
| `temperature` | string | `"celsius"` | `"celsius"` or `"fahrenheit"` |
| `measurementUnits` | string | `"metric"` | `"metric"` or `"imperial"` |

### `cache`

Master switch for route-level response caching. Per-route `cache` fields in
`routing.json` are ignored when caching is disabled here.

```json
{
  "cache": {
    "enable": true,
    "path"  : "/var/cache/myproject",
    "ttl"   : 3600
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enable` | boolean | `false` | Master on/off switch |
| `path` | string | — | Directory for `fs`-type cached files |
| `ttl` | number (seconds) | — | Default TTL when a route's `cache` config does not set one |

See the [Caching guide](../guides/caching) for the full per-route field reference.

### `upload`

Configures multipart file uploads via [busboy](https://github.com/mscdex/busboy).
Upload groups must be declared here before the upload endpoints in `routing.json`
can accept files.

```json
{
  "upload": {
    "encoding"            : "utf8",
    "maxFieldsSize"       : "2MB",
    "maxFields"           : 1000,
    "autoTmpCleanupTimeout": false,
    "groups": {
      "avatar": {
        "path"              : "${tmpPath}",
        "allowedExtensions" : ["jpg", "jpeg", "png", "webp"],
        "isMultipleAllowed" : false,
        "maxFieldsSize"     : "512K"
      }
    }
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `encoding` | string | `"utf8"` | Upload encoding |
| `maxFieldsSize` | string | `"2MB"` | Global max upload size. Per-group override takes precedence |
| `maxFields` | number | `1000` | Max number of files when `isMultipleAllowed: true` |
| `autoTmpCleanupTimeout` | string \| `false` | `false` | Auto-delete tmp files after this duration (e.g. `"10m"`, `"1h"`). Set `false` to disable |
| `groups` | object | — | Named upload groups. At least one group required to enable uploads |

**Group fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `path` | string | — | Destination directory. Supports `${tmpPath}` |
| `allowedExtensions` | string[] \| `"*"` | — | Allowed file extensions. `"*"` accepts everything |
| `isMultipleAllowed` | boolean | `false` | Allow multiple files per upload |
| `maxFieldsSize` | string | global | Per-group size override (e.g. `"8MB"`, `"512K"`) |
| `filePrefix` | string | — | Prefix added to the saved filename |
| `subFolder` | string | — | Subfolder within `path`. Supports `:paramName` substitution |

### WebSocket — `engine.io`

Enable WebSocket support by adding an `engine.io` block.

```json
{
  "engine.io": {
    "port"            : 8888,
    "transports"      : ["polling", "websocket"],
    "pingInterval"    : 5000,
    "pingTimeout"     : 45000,
    "upgradeTimeout"  : 5000
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `port` | number | `8888` | WebSocket listener port |
| `transports` | string[] | — | Allowed transports: `"polling"`, `"websocket"` |
| `pingInterval` | number (ms) | — | How often the server pings connected clients |
| `pingTimeout` | number (ms) | — | Time before a silent client is disconnected |
| `upgradeTimeout` | number (ms) | — | Time allowed for transport upgrade |

---

## settings.server.json {#settingsserverjson}

Server-side-only overrides. These values are available on the server and not
exposed to templates or client-side code.

```json title="src/frontend/config/settings.server.json"
{
  "server": {
    "webroot"            : "/frontend",
    "webrootAutoredirect": true
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `server.webroot` | string | `"/"` | URL prefix prepended to every route. `/frontend` makes `GET /home` accessible at `/frontend/home` |
| `server.webrootAutoredirect` | boolean | `true` | Redirect `GET /frontend` → `GET /frontend/` automatically. Set to `false` when webroot is `"/"` |

---

## settings.server.credentials.json {#settingsservercredentialsjson}

TLS certificate and private key paths. These values are merged under
`server.credentials` and are only ever read by the server process — never
sent to the client.

```json title="src/frontend/config/settings.server.credentials.json"
{
  "server": {
    "credentials": {
      "privateKey"  : "/etc/ssl/${scope}/${host}/private.key",
      "certificate" : "/etc/ssl/${scope}/${host}/certificate.crt",
      "ca"          : "/etc/ssl/${scope}/${host}/ca_bundle.crt",
      "allowHTTP1"  : true
    }
  }
}
```

| Field | Type | Description |
|---|---|---|
| `privateKey` | string | Path to the private key file. Supports [path template variables](./index.md#path-template-variables) |
| `certificate` | string | Path to the certificate (or chained certificate) file |
| `ca` | string | Path to the CA bundle file |
| `allowHTTP1` | boolean | Accept HTTP/1.1 on the same port. Required for non-HTTP/2 clients |

:::note
Path template variables such as `${scope}`, `${host}`, and `${rootDomain}` are
particularly useful here since certificate paths typically vary by environment
and domain. See [path template variables](./index.md#path-template-variables) for
the full list.
:::

:::caution Add to `.gitignore`
`settings.server.credentials.json` reveals your server topology — certificate paths
expose hostnames, scope names, and directory structure that differ between environments
and should not be committed. Add it to `.gitignore` and distribute it out of band
(secrets manager, deployment pipeline, or manual copy per environment).
:::

---

## settings.server.cache.${env}.json {#settingsservercacheenvjson}

Overrides the `server.cache` block for a specific environment. The most common
use is to disable caching locally while keeping it active in production.

The `${env}` in the filename must match `NODE_ENV` for the file to take effect.
When the env does not match, the file is parsed but its section key resolves to
`server.cache.${env}` — an unused key — so it has no impact.

```json title="src/frontend/config/settings.server.cache.dev.json"
{
  "enable": false,
  "ttl"   : 3600
}
```

```json title="src/frontend/config/settings.server.cache.prod.json"
{
  "enable": true,
  "ttl"   : 7200
}
```

With both files present, running with `NODE_ENV=dev` disables caching; running
with `NODE_ENV=prod` enables it with a 2-hour TTL. The base `settings.json`
`cache` block acts as the fallback for any other environment.

---

## settings.server.resolvers.json {#settingsserverresolversjson}

Configures DNS resolvers per scope. Useful in containerised deployments where
cluster-internal DNS differs from public DNS.

```json title="src/frontend/config/settings.server.resolvers.json"
{
  "server": {
    "resolvers": {
      "local"      : ["127.0.0.1", "1.1.1.1"],
      "beta"       : ["10.244.0.10", "1.1.1.1"],
      "production" : ["10.244.0.10", "1.1.1.1"]
    }
  }
}
```

Each key is a scope name; the value is an ordered array of DNS server addresses.
Scopes are declared with `gina scope:add`. See [Scopes](../concepts/scopes).
