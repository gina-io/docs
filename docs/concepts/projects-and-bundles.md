---
title: Projects and Bundles
sidebar_label: Projects and Bundles
sidebar_position: 1
description: Gina organises code into projects and bundles — a project groups related services, while each bundle runs as an independent Node.js process with its own port and lifecycle.
level: beginner
prereqs:
  - '[Gina installed](/getting-started/installation)'
  - '[gina CLI basics](/cli/)'
---

# Projects and bundles

Projects and bundles are the two core organisational units in Gina. A project represents your domain (a website, product, or service group), and each bundle inside it is a standalone Node.js application with its own process, port, and configuration. This separation lets you run a frontend, an API, and an admin panel side by side without a custom process manager.

## Projects

A **project** is Gina's top-level organisational unit. It maps to a domain — one project per website, product, or service group.

A project:
- Has a unique name prefixed with `@` in CLI commands (e.g. `@myproject`)
- Lives at a path you choose on your filesystem (e.g. `~/Sites/myproject`)
- Contains one or more bundles
- Holds shared configuration in `env.json` and `manifest.json`

### Project commands

| Command | Description |
|---------|-------------|
| `gina project:add @name --path=<path>` | Register a new project |
| `gina project:rm @name` | Unregister a project |
| `gina project:build @name --env=<env>` | Build the project for a given environment |

---

## Bundles

A **bundle** is a single application or service within a project. Each bundle runs as an independent Node.js process.

### Bundle types

| Type | Description |
|------|-------------|
| API (default) | Serves JSON responses |
| Frontend | Serves HTML via template engine |
| Service | Background service or worker |

### Bundle source layout

After `gina bundle:add frontend @myproject`, the bundle source is created at:

```
myproject/src/frontend/
├── config/
│   ├── app.json                         ← Application metadata
│   ├── routing.json                     ← URL routing rules
│   ├── settings.json                    ← Bundle settings (region, timezone, etc.)
│   ├── settings.server.json             ← Server options (port, protocol)
│   └── statics.json                     ← Static file serving rules
├── controllers/
│   ├── controller.js                    ← Base controller
│   └── controller.content.js           ← Action controller
├── public/                              ← Static assets (CSS, JS, images)
├── templates/                           ← HTML templates (Swig by default)
└── index.js                             ← Bundle entry point
```

### Bundle commands

| Command | Description |
|---------|-------------|
| `gina bundle:add <name> @project` | Create a new bundle |
| `gina bundle:start <name> @project` | Start a bundle |
| `gina bundle:stop <name> @project` | Stop a bundle |
| `gina bundle:restart <name> @project` | Restart a bundle |
| `gina bundle:start @project` | Start all bundles in a project |
| `gina bundle:restart @project` | Restart all bundles in a project |

### Port allocation

Gina allocates ports automatically. The starting port for a project defaults to `3100`. Each additional bundle in the project gets the next available port.

You can reset port allocation:

```bash
gina port:reset @myproject --start-port-from=3100
```

---

## Per-bundle framework version

Each bundle can be pinned to a specific installed gina version, independent of
the socket server. This lets you upgrade one bundle at a time without stopping
the rest of the project.

Declare `gina_version` on the bundle entry in `manifest.json`:

```jsonc title="manifest.json"
{
  "bundles": {
    "api": {
      "version":      "0.0.1",
      "gina_version": "0.3.0",     // this bundle runs under 0.3.0
      "src":          "src/api"
    },
    "frontend": {
      "version":      "0.0.1",
      "gina_version": "0.3.1",     // this bundle runs under 0.3.1
      "src":          "src/frontend"
    }
  }
}
```

**Priority order** (highest wins):

1. `--gina-version=<version>` CLI flag at start time
2. `gina_version` in `manifest.json` for the bundle
3. The socket server's running version (default — no declaration needed)

**Isolation:** each spawned bundle process gets its own `GINA_VERSION`,
`GINA_FRAMEWORK_DIR`, and `GINA_CORE` overrides derived from the resolved
version. The socket server and other bundles are unaffected.

**Validation:** the declared version is checked against the tracked version
registry in `~/.gina/main.json` before the process is spawned. An emergency log
is emitted and start is aborted if the version is not installed.

`gina bundle:add` writes `gina_version` automatically (set to the current
framework version). See the [bundle CLI reference](../cli/bundle.md#per-bundle-framework-version)
for the full flag documentation.

---

## Views

By default, a new bundle renders JSON. To add HTML template support:

```bash
gina view:add frontend @myproject
```

See the [Views guide](../guides/views) for details on templates and the Swig engine.
