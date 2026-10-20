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
files with comment support and helpful parse-error messages. It is available everywhere in bundle code without a `require()` call. It never caches, so a JSON file change is picked up by the next call that reads the file — and for the same reason it belongs at module load, not inside a request handler.

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

### No cache — every call reads the file

`requireJSON` never caches: every call reads the file from disk, strips the
comments and parses it, in every mode. A change to a JSON file is therefore
picked up by the next call that reads it — and the same property makes it the
wrong tool inside a request handler, where each call is a synchronous disk read
and a parse per request. Read a configuration file once, at module load or in
`onReady`, and keep the result.

The helper still evicts `filename` from `require.cache` in development mode; that
eviction touches a cache it never fills and has no effect.

### Error handling

When the file cannot be parsed, `requireJSON` logs a detailed error message that
includes the file path, the line and column of the offending character, and a
context excerpt running from 200 characters before the error to 300 after it, with
`--(ERROR !)--` marking the error. It then calls `console.emerg()` and exits the process with
`process.exit(1)`.

If the error occurs within the controller stack (i.e. during a request), the
process exit is suppressed and an exception is thrown instead so the error can
be returned as an HTTP response.

---

## `parseJSONWithComments(text, filename)`

Parses JSON-with-comments **text** the way `requireJSON()` parses a file — the
same comment stripping, and a trailing comma before `}` or `]` accepted with a
warning — but never exits the process. Text that is still not JSON throws an
`Error` whose message names `filename`, with the `SyntaxError` from
`JSON.parse` as its `cause`. Since 0.7.5.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | The JSON-with-comments source |
| `filename` | `string` | Optional. The file the text came from, named in the error |

```js
var file = getPath('project') + '/manifest.json';
try {
    var manifest = parseJSONWithComments(fs.readFileSync(file, 'utf8'), file);
} catch (err) {
    // err.message: could not parse `/path/to/manifest.json`: Expected ',' or '}' …
    console.error(err.message);
}
```

Use it where a failure must stay in your own error handling: a command-line
tool, a long-running process, a launcher. Since 0.7.5 gina reads a project's
`manifest.json` and `env.json` with it when a CLI command that names a project
loads its configuration, the `manifest.json` also in `bundle:list`,
`bundle:status`, `bundle:restart`, `project:status`, `project:rename`,
`project:restore`, `gina-container` and at boot, and the project's
`package.json` in `bundle:start`. Gina also parses its own `ports.json` and
`ports.reverse.json` in `~/.gina` this way when a CLI command loads its
configuration, and `main.json` and `projects.json` in `bundle:start`. A file a
command cannot use stops that command with `<file> cannot be used: <reason>`,
and the framework that runs `bundle:start` keeps running.

---

## See also

- [Context helper](./context.md) — `getPath` for resolving file paths
- [Logging guide](/guides/logging) — `console.emerg` behaviour
