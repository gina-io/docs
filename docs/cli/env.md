---
id: cli-env
title: env
sidebar_label: env
sidebar_position: 5
---

# `gina env`

Manage environments and environment variables. Environments control how bundles
are built and run (e.g. `dev`, `prod`). Configuration is stored in `env.json`
at the project root.

---

## `env:list`

List all defined environments.

```bash
gina env:list
```

This is an **offline** command — it does not require the framework server.

---

## `env:add`

Add a new environment.

```bash
gina env:add <env>
```

```bash
gina env:add staging
```

---

## `env:remove`

Remove an environment.

```bash
gina env:remove <env>
```

---

## `env:use`

Switch the active environment. Affects which config block from `env.json` is
applied on the next bundle start.

```bash
gina env:use <env>
```

```bash
gina env:use prod
```

---

## `env:get`

Read the value of a specific environment variable.

```bash
gina env:get <key>
```

---

## `env:set`

Set an environment variable.

```bash
gina env:set <key> <value>
```

---

## `env:unset`

Remove an environment variable.

```bash
gina env:unset <key>
```

---

## Using `LOG_LEVEL` via the environment

You can override the log level for a single bundle start without persisting it
to `settings.json`:

```bash
LOG_LEVEL=debug gina bundle:start api @myapp
```

Valid values: `trace` · `debug` · `info` · `warn` · `error` · `fatal`.
See [`gina framework:set`](./framework.md#frameworkset) for the persistent alternative.
