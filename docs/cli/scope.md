---
id: cli-scope
title: scope
sidebar_label: scope
sidebar_position: 7
description: CLI reference for gina scope commands — list, add, remove, switch scopes, and create local or production symlinks for Gina bundles.
level: intermediate
prereqs:
  - Scopes concept
  - Environments
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

Create a symlink for a bundle targeting local development.

```bash
gina scope:link-local <bundle> @<project>
```

---

## `scope:link-production`

Create a symlink for a bundle targeting production.

```bash
gina scope:link-production <bundle> @<project>
```
