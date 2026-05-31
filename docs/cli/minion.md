---
id: cli-minion
title: minion
sidebar_label: minion
sidebar_position: 14
description: CLI reference for gina minion commands — list the running bundle child-processes ("minions") of a project.
level: intermediate
prereqs:
  - '[bundle:start](/cli/bundle)'
  - '[project:status](/cli/project)'
---

# `gina minion`

Inspect the running bundle child-processes — **minions** — of your projects.

A *minion* is a live, detached Node.js process that runs one bundle: the process
`bundle:start` spawns. Each one registers a `<bundle>@<project>.pid` file under
the run directory (`~/.gina/run`).

---

## `minion:list`

List the running minions of a project — or of every registered project when no
project is given — grouped by project. Only live processes are shown; a bundle
that is stopped (or whose pidfile is stale) does not appear.

```bash
gina minion:list                            # every project with live minions
gina minion:list @<project>                 # a specific project
gina minion:list @<project> --format=json   # machine-readable
```

```bash
gina minion:list @myproject
```

Example output:

```text
[ running ] api              http/2.0 dev https 4208  pid 12345
```

With `--format=json`, a single `@<project>` prints a flat array of minion
objects; the bare form prints an array of `{ "project": "...", "minions": [ ... ] }`
groups.

:::note
`minion:list` reads the run directory directly, so it also surfaces processes
that have been detached from a project's `manifest.json`. To stop a tracked
bundle use [`bundle:stop`](/cli/bundle); reaping orphaned minions via
`minion:kill` is coming in `0.4.0`.
:::
