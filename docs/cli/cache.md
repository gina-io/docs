---
id: cli-cache
title: cache
sidebar_label: cache
sidebar_position: 9
description: CLI reference for gina cache commands — inspect in-memory cache statistics and flush the render/output cache of running Gina bundles.
level: intermediate
prereqs:
  - '[Caching guide](/guides/caching)'
  - '[Running bundle](/cli/cli-bundle)'
---

# `gina cache`

Inspect the in-memory cache state of running bundles, and flush a bundle's
render/output cache.

---

## `cache:stats`

Print a table of in-memory cache entries for a running bundle, grouped by
key prefix (`static:`, `data:`, `swig:`, `http2session:`).

```bash
gina cache:stats <bundle> @<project>   # stats for a specific bundle
gina cache:stats @<project>            # stats for all bundles in the project
```

```bash
gina cache:stats api @myproject
```

The bundle must be running. The command fetches data from the bundle's
internal `/_gina/cache/stats` endpoint.

---

## `cache:clear`

Flush a bundle's **render/output cache** — the `static:` (HTML) and `data:`
(JSON) namespaces. Compiled templates (`swig:`) and HTTP/2 sessions
(`http2session:`) are never touched.

```bash
gina cache:clear <bundle> @<project>              # flush one bundle
gina cache:clear @<project>                       # flush every bundle in the project
gina cache:clear <bundle> @<project> --dry-run    # preview — removes nothing
gina cache:clear <bundle> @<project> --format=json
```

The command runs two passes per bundle:

1. an **offline** reclaim of the bundle's on-disk cache directories — including
   orphaned prior-release
   [namespace](/guides/caching#release-namespacing) directories a redeploy left
   behind (the `config` and `swig` infra caches are preserved). This runs even
   when the bundle is not running.
2. an **in-heap** flush of the running bundle via its admin-gated
   `POST /_gina/cache/clear` endpoint.

`--dry-run` reports what the offline pass *would* remove and whether the live
bundle is reachable, without removing anything or mutating the live cache.
`--format=json` emits a machine-readable envelope
(`{ project, bundle, fsRemoved, inHeapCleared, reachable }`, or a `bundles`
array for the all-bundles form).

:::note
The offline reclaim assumes the default cache root (`<project_path>/cache`, the
resolved default `server.cache.path`). A bundle that overrides
`server.cache.path` to a custom absolute path is still flushed in-heap, but its
on-disk orphans are not auto-reclaimed.
:::

See [Caching → Flushing the cache](/guides/caching#flushing-the-cache).
