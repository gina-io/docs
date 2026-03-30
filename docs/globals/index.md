---
id: globals-overview
title: Globals
sidebar_label: Overview
slug: /globals
description: Reference for all globally injected functions and prototypes in the Gina framework, including path helpers, context registry, date formatting, and more.
level: beginner
---

# Globals

These modules are bootstrapped at framework startup and inject functions directly
into the global scope. No `require()` call is needed — they are available
everywhere in your bundle code. This is a core design principle of the Gina framework: common utilities like `_()`, `getContext()`, `requireJSON()`, and `dateFormat` are wired into the global scope by `gna.js` and the helpers bootstrap so that bundle code stays concise.

| Global | Injected names | Description |
|--------|---------------|-------------|
| [Path](./path.md) | `_()`, `setPath`, `getPath`, `setPaths`, `getPaths` | Path normalisation, file-system operations, named path registry |
| [Async](./async.md) | `onCompleteCall` | Promise adapter for `.onComplete(cb)` EventEmitters |
| [Context](./context.md) | `setContext`, `getContext`, `resetContext`, `getConfig`, `getLib`, `whisper`, `define`, `getDefined`, `isWin32` | Global key/value context registry and template variable substitution |
| [Date format](./date-format.md) | `dateFormat` | Date formatting, calendar arithmetic, fiscal helpers |
| [Prototypes](./prototypes.md) | Extensions on `Array`, `Object`, `JSON`, `Date`, `__stack` | Built-in prototype utilities |
| [Task](./task.md) | `run` | Execute shell commands from bundle code |
| [Data](./data.md) | `formatDataFromString`, `encodeRFC5987ValueChars` | HTTP request body parsing |
| [JSON](./json.md) | `requireJSON` | Load JSON files with comment stripping |
| [Text](./text.md) | `__`, String prototype extensions | i18n stub and string trimming |
| [ApiError](./api-error.md) | `ApiError` | Structured error constructor for API responses |

---

## `log()`

The console global provides a low-level `log()` function that writes directly to
`process.stdout`. It bypasses the logger hierarchy entirely.

```js
log('raw output');
log({ any: 'object' });   // serialised with JSON.stringify
```

For structured, levelled logging use `console.info()`, `console.err()`, etc.
from the [Logger](../api/logger.md).
