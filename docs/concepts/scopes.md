---
title: Scopes
sidebar_label: Scopes
sidebar_position: 3
description: Scopes in Gina isolate configuration, certificates, and data across deployment targets like local, staging, and production — enabling safe multi-environment operation on a single cluster.
level: intermediate
prereqs:
  - '[Environments](/concepts/environments)'
  - '[Projects and bundles](/concepts/projects-and-bundles)'
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

## Restrict a bundle to certain scopes

By default every bundle registered in `manifest.json` is deployed in **every**
scope. When you are building a new bundle and do not want it going out with the
others yet, give its manifest entry a `scopes` allow-list:

```json
{
  "bundles": {
    "newthing": {
      "version": "0.0.1",
      "src": "src/newthing",
      "link": "bundles/newthing",
      "scopes": ["local"]
    }
  }
}
```

`newthing` is now built and started in `local`, and every other scope behaves as
though it does not exist. When it is ready to ship, add the other scopes to the
list — or delete the key.

:::caution `scopes` does not survive `project:add` / `project:import` yet
If the number of bundles declared in `manifest.json` differs from the number
found in the directory those two commands read, the whole `bundles` block is
rebuilt from what is on disk and the rebuilt entries carry no `scopes` key. The
declaration is dropped without a message.

Either direction of mismatch triggers it — declaring *fewer* bundles than are
present counts too, so a deployment shipping a reduced manifest alongside a full
tree is affected on every registration. **Re-apply your `scopes` keys after
running either command and check the file**, rather than assuming it survived.
:::

| Value | Meaning |
| --- | --- |
| key absent (or `null`) | Deployed in **every** scope. This is the default, and what every existing manifest does. |
| `["local"]` | Deployed in `local` only. |
| `["local", "staging"]` | Deployed in those two scopes. |
| `[]` | Parked — deployed in no scope at all. |

### What happens to an excluded bundle

It depends on whether you asked for that bundle **by name**. A bulk operation
skips it and says so; an explicit, single-bundle request refuses — because
quietly producing nothing would look like success in a deploy script.

```mermaid
flowchart TD
  A[operation runs in scope S] --> B{bundle declares scopes?}
  B -->|no key| C[deployed<br/>every scope, as always]
  B -->|yes| D{is S in the list?}
  D -->|yes| C
  D -->|no| E{did you name<br/>this bundle?}
  E -->|"no — booting a project,<br/>gina project:build"| F[SKIP<br/>notice names the scope<br/>and the remedy]
  E -->|"yes — gina bundle:start,<br/>gina bundle:build &lt;name&gt;"| G[REFUSE<br/>error names bundle,<br/>scope and remedy]
```

| Operation | Excluded bundle |
| --- | --- |
| Booting a project | **Skipped**, with a notice |
| `gina project:build` | **Skipped**, with a notice — one parked bundle never blocks a project build |
| `gina bundle:start <name>` | **Refused** by name |
| `gina bundle:build <name> --scope=<scope>` | **Refused** by name |

The one exception worth knowing: if the bundle you are *starting* is excluded
from the scope you start it in, that is refused rather than skipped — a boot with
nothing to serve is never what you meant.

:::warning Deleting `releases.<scope>` is not a substitute
It may look equivalent to remove the bundle's `releases.<scope>` entry by hand.
It is not: both build commands walk every scope in the project and re-create any
missing release entry, so the deletion reappears on the next build. Use `scopes`
— it is the only declaration the tooling preserves.
:::

A value that is not an array (for example `"scopes": "local"`) is reported as a
manifest error naming the bundle, rather than being read as "no scopes at all".

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
