---
id: config-reference
title: Configuration Reference
sidebar_label: Overview
sidebar_position: 1
---

# Configuration Reference

Every bundle in a gina project is configured through a set of JSON files in its `config/`
directory. There is no configuration in code — routing, server settings, templates, and
database connections are all declared in these files.

```
src/
└── <bundle>/
    └── config/
        ├── app.json
        ├── routing.json
        ├── settings.json
        ├── settings.server.json
        ├── settings.server.credentials.json
        ├── statics.json
        ├── templates.json
        ├── connectors.json
        └── security.json
```

---

## Config files at a glance

| File | Required | Purpose |
|---|:---:|---|
| [`app.json`](./app) | ✓ | Bundle identity, proxy connections, app-level constants |
| [`routing.json`](./routing) | ✓ | URL → controller action mapping |
| [`settings.json`](./settings) | ✓ | Server engine, protocol, locale, uploads |
| [`settings.server.json`](./settings#settingsserverjson) | — | Webroot, CORS — server-side-only overrides |
| [`settings.server.credentials.json`](./settings#settingsservercredentialsjson) | — | TLS certificate and private key paths |
| [`settings.server.cache.{env}.json`](./settings#settingsservercacheenvjson) | — | Cache on/off per environment |
| [`settings.server.resolvers.json`](./settings#settingsserverresolversjson) | — | DNS resolvers per scope |
| [`statics.json`](./statics) | — | URL path → filesystem path aliases |
| [`templates.json`](./templates) | — | Page template definitions (stylesheets, scripts, layouts) |
| [`connectors.json`](./connectors) | — | Database connector configuration |
| [`security.json`](./security) | — | Session expiry overrides |

---

## Naming convention

Config filenames follow a structured pattern:

```
settings.<section>.<env>.json
```

- **`<section>`** — dot-separated path that determines where the content is merged in the
  final config tree. `settings.server.json` is merged under the `server` key.
  `settings.server.credentials.json` is merged under `server.credentials`.
- **`<env>`** — optional environment suffix (`dev`, `prod`, `beta` …). The file only has
  effect when the active `NODE_ENV` matches.

:::note
The env-suffix **stripping** behaviour — where `settings.server.cache.dev.json` resolves
to section `server.cache` when env=dev — is specific to `settings*.json` files.

For all other config files, the `<base>.<section>` part still applies: `app.alerts.json`
is merged under `app.alerts`, `app.crons.json` under `app.crons`, and so on. Env-specific
variants of those files (`app.alerts.dev.json`) are handled via the overlay mechanism
described below, not by stripping the suffix from the section key.
:::

---

## Environment overlays

For every config file `foo.json`, you can create `foo.{env}.json` alongside it.
When the active `NODE_ENV` matches, the env file is loaded **on top of** the base file —
env values win on conflict.

```
src/<bundle>/config/
├── connectors.json         ← base (all envs)
└── connectors.dev.json     ← overlay, active only when NODE_ENV=dev
```

This lets you keep different database hosts for local development without touching
the production config.

:::caution
Files starting with a dot (`.`) are **always skipped** by the framework. Never rely on
dotfiles for configuration the framework needs to read.
:::

---

## Load order

Config is loaded in two phases on bundle start.

**Phase 1 — Settings** (`settings*.json`)

All `settings*.json` files are collected and merged into a single settings tree.
The section name is extracted from the filename; env-suffixed files only contribute
to their section when `NODE_ENV` matches.

```
settings.json                   → root
settings.server.json            → server
settings.server.credentials.json→ server.credentials
settings.server.cache.dev.json  → server.cache   (dev only)
```

**Phase 2 — Everything else**

For each remaining config file:

1. Load `foo.{env}.json` if it exists (env overlay)
2. Load `foo.json` (base)
3. Merge — env overlay wins on conflict
4. Apply shared config from `shared/config/` if present

**Framework defaults** are merged below user values for three files:

| File | Framework baseline |
|---|---|
| `settings.json` | `core/template/conf/settings.json` — engine, address, upload defaults |
| `statics.json` | `core/template/conf/statics.json` — gina vendor CSS/JS, public root |
| `templates.json` | `core/template/conf/templates.json` — `_common` with layout and gina assets |

Your values always win. The framework baseline only fills in keys you have not declared.

---

## Path template variables

Values in config files can reference framework-resolved paths using `{variable}` placeholders.
These are substituted at load time.

| Variable | Resolves to |
|---|---|
| `{gina}` | Absolute path to the gina install |
| `{version}` | Active gina version string |
| `{scope}` | Active scope (`local`, `beta`, `production` …) |
| `{rootDomain}` | Root domain of the project (e.g. `example.com`) |
| `{host}` | Hostname of the bundle |
| `{projectVersionMajor}` | Major version of the project |
| `{bundlePath}` | Absolute path to the current bundle |
| `{templatesPath}` | Absolute path to the bundle's templates directory |
| `{publicPath}` | Absolute path to the bundle's public directory |
| `{handlersPath}` | Absolute path to the bundle's handlers directory |
| `{tmpPath}` | Absolute path to the project tmp directory |
| `{cachePath}` | Absolute path to the project cache directory |

---

## Shared config

Place a config file under `shared/config/` at the project root to make it available
to every bundle. Bundle-level files take precedence over shared files when both exist.

```
myproject/
├── shared/
│   └── config/
│       ├── routing.global.json   ← global middleware for all bundles
│       └── statics.json          ← shared static paths
└── src/
    └── <bundle>/
        └── config/
            └── statics.json      ← takes precedence over shared/config/statics.json
```
