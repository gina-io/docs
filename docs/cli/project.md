---
id: cli-project
title: project
sidebar_label: project
sidebar_position: 3
---

# `gina project`

Register and manage Gina projects. A project is a collection of bundles sharing
a common `manifest.json` and `env.json`.

---

## `project:add`

Register an existing project directory with the Gina framework. Run this once
after creating a project or cloning a repository.

```bash
gina project:add @<project>
```

```bash
gina project:add @myproject
```

Gina reads `manifest.json` in the current directory and records the project
path in `~/.gina/<version>/projects.json`.

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
