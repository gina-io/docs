---
sidebar_position: 3
---

# Scopes

A **scope** is a named deployment target within a project. Scopes let you maintain
separate configurations, certificate paths, and build outputs for different
deployment destinations — for example `local`, `production`, or `staging`.

Every project starts with two default scopes: `local` and `production`.

---

## List scopes

```bash
gina scope:list @myproject
```

List scopes across all registered projects:

```bash
gina scope:list
```

The currently active (default) scope is marked with `[ * ]`.

---

## Add a scope

Add a scope to all bundles in a project:

```bash
gina scope:add staging @myproject
```

Add a scope to a specific bundle only:

```bash
gina scope:add frontend/staging @myproject
```

---

## Set the default scope

```bash
gina scope:use staging @myproject
```

This makes `staging` the default scope. Commands that accept a scope argument will
fall back to this value when `--scope` is omitted.

---

## Remove a scope

```bash
gina scope:remove staging @myproject
```

---

## Link scopes to local and production slots

Gina reserves two special slots for every project: `local_scope` and
`production_scope`. These slots are used internally for certificate resolution and
build output — for example, certificates under
`~/.gina/certificates/scopes/local/` are picked up when the active scope maps to
the `local` slot.

By default `local` maps to `local_scope` and `production` maps to `production_scope`.
If you rename your scopes or add custom ones, you can remap the slots:

```bash
gina scope:link-local dev @myproject
gina scope:link-production prod @myproject
```

After this, the `dev` scope is treated as the local slot and `prod` as the
production slot everywhere the framework resolves scope-dependent paths.

---

## Scopes and certificates

Certificate paths include the scope name:

```
~/.gina/certificates/scopes/<scope>/<hostname>/
```

See [HTTPS and HTTP/2](../guides/https) for the full certificate setup guide.
