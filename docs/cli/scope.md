---
id: cli-scope
title: scope
sidebar_label: scope
sidebar_position: 7
description: CLI reference for gina scope commands — list, add, remove, switch scopes, and create local or production symlinks for Gina bundles.
level: intermediate
prereqs:
  - '[Scopes concept](/concepts/scopes)'
  - '[Environments](/concepts/environments)'
---

# `gina scope`

Manage build scopes. A scope controls which set of configuration overrides and symlinks is active for a build or deployment target (for example, `local` or `production`). Scopes work alongside environments to give you fine-grained control over how bundles are configured and deployed.

See [Scopes](../concepts/scopes) for the conceptual reference.

---

## `scope:list`

List all defined scopes.

```bash
gina scope:list
```

---

## `scope:add`

Add a new scope.

```bash
gina scope:add <scope>
```

```bash
gina scope:add staging
```

A scope applies to every bundle of a project; to deploy a bundle in some scopes
only, see [Restrict a bundle to certain scopes](/concepts/scopes#restrict-a-bundle-to-certain-scopes).
A scope name is made of letters, digits, `_`, `.` and `-`, and starts with a
lowercase letter, a digit, `_` or `.`; any other name is refused, as is the name of a
property every object inherits, such as `constructor`.

---

## `scope:remove`

Remove a scope.

```bash
gina scope:remove <scope>
```

---

## `scope:use`

Switch the active scope.

```bash
gina scope:use <scope>
```

```bash
gina scope:use production
```

---

## `scope:link-local`

Make a scope the project's local slot (`local_scope`). If the project's default scope
(`def_scope`) was the previous local scope, it moves to the new one too. Nothing is
symlinked: the command updates the project's entry in `~/.gina/projects.json`. See
[Link scopes to local and production slots](/concepts/scopes#link-scopes-to-local-and-production-slots).

```bash
gina scope:link-local <scope> [@<project>]
```

Without `@<project>`, the project is the one whose directory you run the command from.

---

## `scope:link-production`

Make a scope the project's production slot (`production_scope`). If the project's
default scope (`def_scope`) was the previous production scope, it moves to the new one
too. Nothing is symlinked: the command updates the project's entry in
`~/.gina/projects.json`.

```bash
gina scope:link-production <scope> [@<project>]
```

Without `@<project>`, the project is the one whose directory you run the command from.
