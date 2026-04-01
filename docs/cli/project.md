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

Print the status of every bundle in a project.

```bash
gina project:status @<project>
```

---

## `project:build`

Build all bundles in a project.

```bash
gina project:build @<project> [--env=<env>] [--scope=<scope>]
```
