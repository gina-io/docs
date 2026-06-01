---
id: cli-project
title: project
sidebar_label: project
sidebar_position: 3
description: CLI reference for gina project commands — register, remove, list, start, stop, and build Gina projects and all their bundles.
level: beginner
prereqs:
  - '[Gina installed globally](/getting-started/installation)'
---

# `gina project`

Register and manage Gina projects. A project is a collection of bundles sharing a common `manifest.json` and `env.json`. These commands let you register a project directory with the framework, start or stop all its bundles at once, check their status, and trigger a full project build.

---

## `project:add`

Create and register a new project directory with the Gina framework.

**From inside the project directory** (directory must already exist and its name must match `@<project>`):

```bash
mkdir <project> && cd <project>
gina project:add @<project>
```

**From any directory using `--path`:**

```bash
gina project:add @<project> --path=<dir>
```

```bash
gina project:add @myproject --path=~/Sites/myproject
gina project:add @myproject --path=./myproject
```

Gina creates the directory if it does not exist, writes `manifest.json`, `package.json`, and `env.json`, and records the project path in `~/.gina/<version>/projects.json`.

### Options

| Option | Description |
|---|---|
| `--path=<dir>` | Target directory for the project. Defaults to the current working directory. |
| `--homedir=<dir>` | Override the project home directory (defaults to `~/.<project>`). |
| `--scope=<scope>` | Add a scope at creation time (e.g. `local`). |
| `--env=<env>` | Set the default environment (e.g. `dev`). |
| `--start-port-from=<port>` | Start the port scanner from this port number. |

---

## `project:import`

Alias for `project:add`. Re-registers a project that already exists on disk
but is missing from `~/.gina/projects.json` (e.g. after moving the machine
config or running `project:remove` without deleting the source).

```bash
gina project:import @<project>
```

---

## `project:rename`

Rename a project: moves the source directory, updates `manifest.json`,
`package.json`, `ports.json`, `ports.reverse.json`, and `projects.json`.

```bash
gina project:rename @<old-name> @<new-name>
```

```bash
gina project:rename @myproject @myproject-v2
```

---

## `project:remove`

Unregister a project. Does not delete source files.

```bash
gina project:remove @<project>
```

---

## `project:list`

List all registered projects and their paths.

```bash
gina project:list
```

---

## `project:start`

Start all bundles defined in a project's `manifest.json`.

```bash
gina project:start @<project>
```

---

## `project:stop`

Stop all running bundles in a project.

```bash
gina project:stop @<project>
```

---

## `project:status`

Show the running/stopped state, PID, and preferred port of each bundle in a project. The `@<project>` argument is optional — with no project given, `project:status` reports every registered project, mirroring [`project:list`](#projectlist).

```bash
gina project:status @<project>
```

Report a single project's bundles:

```bash
gina project:status @myproject
```

Report every registered project at once (no argument):

```bash
gina project:status
```

**Flags**

| Flag | Description |
|------|-------------|
| `--format=json` | Emit a JSON payload instead of the human-readable text table |

### Output

Each bundle is one run-state-led line — the state label, the padded bundle name, the preferred port, and the PID when running:

```text
[ running ] api              http/2.0 dev https 4208  pid 12345
[ stopped ] web              http/1.1 dev http 3000
```

With no project argument, each project's bundles are grouped under a banner:

```text
------------------------------------
myproject
------------------------------------
[ running ] api              http/2.0 dev https 4208  pid 12345
[ stopped ] web              http/1.1 dev http 3000
```

- **`[ running ]` / `[ stopped ]`** — probed from `~/.gina/run/<bundle>@<project>.pid` with `process.kill(pid, 0)`. A stale pidfile reports `[ stopped ]` without being deleted; pidfile clean-up stays with [`bundle:stop`](/cli/cli-bundle#bundlestop).
- **`http/2.0 dev https 4208`** — preferred port. Read from `~/.gina/ports.reverse.json`. Precedence: `http/2.0 https` → `http/1.1 https` → `http/1.1 http`; `dev` env is preferred when present, otherwise the first environment in the record. A bundle with no allocated port renders as `(no port)`.

An unregistered project name exits non-zero with an error.

With `--format=json`, a named project emits a flat array of per-bundle objects:

```json
[
  {
    "bundle": "api",
    "project": "myproject",
    "running": true,
    "pid": 12345,
    "env": "dev",
    "scheme": "http/2.0",
    "protocol": "https",
    "port": 4208,
    "ports": { "dev": { "http/2.0": { "https": 4208 } } }
  },
  {
    "bundle": "web",
    "project": "myproject",
    "running": false,
    "pid": null,
    "env": "dev",
    "scheme": "http/1.1",
    "protocol": "http",
    "port": 3000,
    "ports": { "dev": { "http/1.1": { "http": 3000 } } }
  }
]
```

The no-argument form (every project) wraps each project's array in a `{ project, bundles }` envelope:

```json
[
  { "project": "myproject", "bundles": [ /* per-bundle objects, as above */ ] }
]
```

A missing or malformed `ports.reverse.json` is tolerated — each bundle renders as `(no port)` with null port fields.

:::caution Docker bundles
Bundles running inside a Docker container write their pidfile inside the container, not on the host `~/.gina/run/` directory. Running `project:status` from a host shell reports them as `[ stopped ]` even when the container is up — use `docker ps` or `docker exec <container> gina project:status @<project>` for the container-side view.
:::

---

## `project:build`

Build all bundles in a project.

```bash
gina project:build @<project> [--env=<env>] [--scope=<scope>]
```
