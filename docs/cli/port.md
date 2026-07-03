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

Assign a specific port to a bundle. Supports both positional and flag syntax.
When a required value is omitted, the CLI prompts interactively.

```bash
# Positional syntax — protocol:port, bundle, @project/env
gina port:set <protocol>:<port> <bundle> @<project>/<env>

# Flag syntax
gina port:set <bundle> @<project> --protocol=<proto> --scheme=<scheme> --port=<n> --env=<env>

# Interactive — prompts for protocol, scheme, port, and environment
gina port:set <bundle> @<project>
```

```bash
gina port:set http/1.1:4200 api @myproject/dev
gina port:set api @myproject --protocol=http/1.1 --scheme=http --port=4200 --env=dev
```

Ports in the reserved range **4100–4199** are rejected (Gina infrastructure).

### Reassign a port held by another bundle

By default, `port:set` rejects a port that another bundle or environment already
holds:

```
Port 8443 is already assigned to api@myproject/dev (use --force to reassign)
```

Pass `--force` to take the port anyway. The previous holder is evicted from both
the forward (`ports.json`) and reverse (`ports.reverse.json`) maps; it loses that
port for the protocol/scheme and re-pins itself the next time its own context
runs `port:set`. This is the intended shape for one-bundle-per-container
deployments that pin each bundle to a fixed port.

```bash
gina port:set frontend @myproject --protocol=http/2.0 --scheme=https --port=8443 --env=dev --force
```

---

## `port:reset`

Reallocate all bundle ports for a project, starting from a given number.
Useful after a port conflict or when restructuring a project.

```bash
gina port:reset @<project> --start-port-from=<n>
```

```bash
gina port:reset @myproject --start-port-from=3200
```

Ports are assigned sequentially: the first bundle gets `n`, the second `n+1`,
and so on.

:::note Reserved range and scan window
The scanner searches a **900-port window** from the starting number (default
`3100–3999`). If exhausted, use `--start-port-from=4200` or higher — ports
`4100–4199` are reserved and skipped automatically. See
[Ports](/concepts/ports) for details.
:::
