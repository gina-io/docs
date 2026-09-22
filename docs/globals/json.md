---
id: json
title: JSON Helper
sidebar_label: JSON
sidebar_position: 8
description: Global requireJSON() function for loading JSON files with comment stripping and detailed parse-error diagnostics in the Gina framework.
level: beginner
prereqs:
  - '[Controllers](/guides/controller)'
---

# JSON Helper

The JSON helper injects the global `requireJSON()` function for loading JSON
files with comment support and helpful parse-error messages. It is available everywhere in bundle code without a `require()` call, and it handles dev-mode cache busting so JSON file changes are picked up on the next request.

---

## `requireJSON(filename)`

Reads a JSON file from disk, strips comments, and returns a parsed JavaScript
object.

| Parameter | Type | Description |
|-----------|------|-------------|
| `filename` | `string` | Absolute path to the JSON file |

```js
var config = requireJSON(getPath('myapp.root') + '/config/settings.json');
```

### Comment stripping

Two comment styles are recognised and removed before parsing:

- Block comments: `/* ... */` — stripped only when the file carries at least one
  `/** ... */` docblock; a file with single-star blocks and no docblock is not
  block-stripped
- Line comments: `// ...`

URL strings are preserved — `://` sequences inside quoted values are not treated
as line comment markers.

Block stripping is a linear, string-aware scan: a `/*` inside a quoted value —
a glob such as `"./lib/**/*"` or a certificate path such as
`"…/ssl/*.example.pem"` — is data and survives intact. Previously the strip
was a regular expression that backtracked exponentially on such a value when
lines followed it (about 2× per line, 4× per CRLF line), so a config carrying a
glob path a few dozen lines from its bottom hung the bundle boot until the CLI's
start-wait killed it; it also removed `/**/` out of glob values. Both are fixed.

### Dev-mode cache busting

In development mode (`NODE_ENV_IS_DEV=true`), the module cache entry for
`filename` is evicted before each read. Changes to a JSON file are picked up
immediately on the next request without restarting the server.

### Error handling

When the file cannot be parsed, `requireJSON` logs a detailed error message that
includes the file path, the line and column of the offending character, and a
context excerpt. It then calls `console.emerg()` and exits the process with
`process.exit(1)`.

If the error occurs within the controller stack (i.e. during a request), the
process exit is suppressed and an exception is thrown instead so the error can
be returned as an HTTP response.

---

## See also

- [Context helper](./context.md) — `getPath` for resolving file paths
- [Logging guide](/guides/logging) — `console.emerg` behaviour
