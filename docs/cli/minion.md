---
id: cli-minion
title: minion
sidebar_label: minion
sidebar_position: 14
description: CLI reference for gina minion commands — list and reap the running bundle child-processes ("minions") of a project.
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
that have been detached from a project's `manifest.json` — the same orphans
`minion:kill` reaps. To stop a tracked bundle through its normal lifecycle, use
[`bundle:stop`](/cli/bundle).
:::

---

## `minion:kill`

Reap the running minions of a project — both the pidfile-tracked ones and any
orphaned `gina: <bundle>@<project>` processes still alive without a (or with a
stale) pidfile, found via a `ps` sweep. This is the process-truth counterpart to
`minion:list`: it terminates exactly what `minion:list` shows, plus the
pidfile-less orphans that [`bundle:stop`](/cli/bundle) (manifest-driven) cannot
reach.

```bash
gina minion:kill @<project>                  # reap the project's minions
gina minion:kill @<project> --dry-run        # preview without killing
gina minion:kill @<project> --dry-run --format=json
```

A `@<project>` is required — there is no all-projects form. Termination is
graceful-then-forceful: every target gets a `SIGTERM`, then after a short grace
period any survivor gets a `SIGKILL`. Stale pidfiles and the pidfiles of killed
targets are removed afterwards; mount symlinks are left untouched (that is
`bundle:stop`'s concern). The `ps` sweep is POSIX-only.

```text
minion:kill @myproject terminated 1 minion(s):
  [ killed ] api              pid 12345  (SIGTERM)
```

:::tip
Run with `--dry-run` first to see exactly which PIDs would be terminated:

```text
[ dry-run ] minion:kill @myproject would terminate 1 minion(s):
  [ would kill ] api              pid 12345
```
:::
