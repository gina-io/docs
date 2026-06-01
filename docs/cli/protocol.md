---
id: cli-protocol
title: protocol
sidebar_label: protocol
sidebar_position: 10
description: CLI reference for gina protocol commands — list, set, and remove the HTTP protocol and scheme for Gina projects and bundles.
level: intermediate
prereqs:
  - '[settings.json](/reference/settings)'
  - '[HTTP/2 basics](https://developer.mozilla.org/en-US/docs/Glossary/HTTP_2)'
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

---

## `protocol:remove`

Revert a bundle to your project's **default** protocol and scheme by removing the
bundle's protocol override. Only the bundle's `config/settings.json` is changed —
the shared `ports.json` / `ports.reverse.json` are left untouched (`project:add`
pre-allocates every protocol's port, so the default-protocol port already exists).

```bash
gina protocol:remove <bundle> @<project>
gina protocol:remove <bundle> @<project> --dry-run
gina protocol:remove <bundle> @<project> --dry-run --format=json
```

A `<bundle>` is required (bundle-scoped). At config-load time Gina fills an absent
`server.protocol` / `server.scheme` from the project default, so removing the
override is safe. If the bundle has no port allocated for the default protocol,
the command refuses and points you at `protocol:set` (override with `--force`).
Restart the bundle afterwards.

:::tip
Preview first with `--dry-run`:

```text
[ dry-run ] would revert [ api@myproject ] from http/2.0/https to the project default http/1.1/http (no changes written).
```
:::
