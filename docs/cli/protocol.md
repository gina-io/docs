---
id: cli-protocol
title: protocol
sidebar_label: protocol
sidebar_position: 10
description: CLI reference for gina protocol commands — list and set the HTTP protocol and scheme for Gina projects and bundles.
---

# `gina protocol`

Manage the HTTP protocol and scheme settings for projects and bundles.
The default protocol is marked with `[ * ]` in list output.

---

## `protocol:list`

List the protocols and schemes configured for all projects, a single project,
or a specific bundle.

```bash
gina protocol:list                             # all projects
gina protocol:list @<project>                  # a specific project
gina protocol:list <bundle> @<project>         # a specific bundle
```

---

## `protocol:set`

Interactively set the protocol and scheme for a project or bundle. Runs a
port-scan wizard and updates `env.json`, `ports.json`, and
`ports.reverse.json` accordingly.

```bash
gina protocol:set [@<project>]
gina protocol:set <bundle> @<project>
```

```bash
gina protocol:set @myproject
gina protocol:set api @myproject
```
