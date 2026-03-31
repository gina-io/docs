---
id: cli-port
title: port
sidebar_label: port
sidebar_position: 6
description: CLI reference for gina port commands — list, set, and reset port assignments for bundles in a Gina project.
level: intermediate
prereqs:
  - '[Projects and bundles](/concepts/projects-and-bundles)'
  - '[Ports concept](/concepts/ports)'
---

# `gina port`

Manage port assignments for bundles. Each bundle runs as an independent Node.js process on its own port, allocated automatically when the bundle is added and stored in `~/.gina/<version>/projects.json`. These commands let you list current assignments, override a specific port, or reallocate all ports from a given starting number.

See [Ports](../concepts/ports) for background on how Gina assigns and manages ports.

---

## `port:list`

List current port assignments for all bundles in a project.

```bash
gina port:list @<project>
```

---

## `port:set`

Assign a specific port to a bundle.

```bash
gina port:set <bundle> <port> @<project>
```

```bash
gina port:set api 4200 @myproject
```

---

## `port:reset`

Reallocate all bundle ports for a project, starting from a given number.
Useful after a port conflict or when restructuring a project.

```bash
gina port:reset @<project> --start-from=<n>
```

```bash
gina port:reset @myproject --start-from=3200
```

Ports are assigned sequentially: the first bundle gets `n`, the second `n+1`,
and so on.
