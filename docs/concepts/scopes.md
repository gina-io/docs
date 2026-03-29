---
title: Scopes
sidebar_label: Scopes
sidebar_position: 3
description: Scopes in Gina isolate configuration, certificates, and data across deployment targets like local, staging, and production — enabling safe multi-environment operation on a single cluster.
---

# Scopes

A **scope** is a named deployment target within a project. Scopes let you maintain
separate configurations, certificate paths, and build outputs for different
deployment destinations — for example `local`, `production`, or `staging`. Unlike plain environment variables, scopes are enforced at the data layer: every document written through a Gina connector is stamped with the active scope, preventing cross-environment data leaks even when environments share the same database cluster.

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

---

## Scopes and data isolation

Scopes extend to the data layer. When a bundle uses a Couchbase connector, every
document written to the database is stamped with a `_scope` field that matches the
active scope. This lets multiple environments share the same Couchbase cluster and
bucket without data leaking between them.

### How it works

The connector reads the `scope` field from `connectors.json` (or falls back to
`process.env.NODE_SCOPE`) and stamps it on every document at insert time. N1QL
queries filter on it automatically via the `$scope` placeholder:

```sql
SELECT c.*
FROM myapp AS c USE KEYS [$1]
WHERE c._collection = 'invoice'
AND   c._scope      = $scope
```

`$scope` is replaced with the connector's resolved scope value before the query is
dispatched — the same SQL file works unchanged across all environments.

### Adding `scope` to a connector

```json title="src/api/config/connectors.json"
{
  "couchbase": {
    "protocol": "couchbase://",
    "host":     "127.0.0.1",
    "database": "myapp",
    "username": "appuser",
    "password": "secret",
    "scope":    "local"
  }
}
```

When `scope` is omitted the connector falls back to `process.env.NODE_SCOPE`, so
development environments usually work without setting it explicitly.

### Scope values

| Value | Environment |
|---|---|
| `local` | Local development |
| `beta` | Staging / beta |
| `production` | Production |
| `testing` | Automated test runs — wiped before each suite |

### Backfilling existing documents

Documents created before `_scope` was introduced will have the field missing. Run
the backfill script once per environment to stamp them:

```bash
node script/backfill-scope.js --scope=local --host=localhost:8093
```

The script updates all documents where `_scope IS MISSING` and is safe to run
multiple times — subsequent runs are no-ops.

### Why not separate buckets?

Couchbase Community Edition is capped at five buckets. `_scope` achieves the same
isolation without consuming a bucket slot, following the same pattern as
`_collection` (the document type discriminator already used throughout Gina's
entity system).
