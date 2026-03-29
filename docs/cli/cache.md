---
id: cli-cache
title: cache
sidebar_label: cache
sidebar_position: 9
description: CLI reference for gina cache commands — inspect in-memory cache statistics for running Gina bundles.
---

# `gina cache`

Inspect the in-memory cache state of running bundles.

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
