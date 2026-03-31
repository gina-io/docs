---
id: cli-env
title: env
sidebar_label: env
sidebar_position: 5
description: CLI reference for gina env commands — list, add, remove, switch environments and manage environment variables for Gina bundles.
level: intermediate
prereqs:
  - '[Projects and bundles](/concepts/projects-and-bundles)'
  - '[env.json](/cli/env)'
---

# `gina env`

Manage environments and environment variables. Environments control how bundles are built and run (for example, `dev` or `prod`), and each environment can carry its own set of key-value variables. Configuration is stored in `env.json` at the project root.

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

## `env:link-dev`

Link an environment to the dev slot (`dev_env`) for a project. If `def_env`
was previously the development environment, it is promoted to the new default.

```bash
gina env:link-dev <env> [@<project>]
```

```bash
gina env:link-dev staging @myproject
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
