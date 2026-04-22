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

:::tip Explicit imports (expanded in 0.3.7-alpha.2)
Every injected helper is also a named property of both `require('gina')` and
`require('gina/gna')` for IDE navigation, static analysis, and the TypeScript
declaration generator:

```javascript
// Named imports work from either entry point
const { getContext, _, onCompleteCall, uuid }    = require('gina/gna');
const { setContext, requireJSON, merge, ApiError } = require('gina');
```

Every export carries JSDoc (description, `@param`, `@returns`, `@example`), so
editors can jump to definitions and AI assistants can generate accurate Gina
code. The globals continue to work exactly as before — this is an additive
surface, not a replacement.

One intentional asymmetry: `getConfig` is only surfaced on `require('gina/gna')`.
The primary `require('gina')` entry point later re-binds `gna.getConfig` as a
bundle-specific instance method, which would collide with the global.
:::

:::info `types/gna.d.ts` is auto-generated (0.3.7-alpha.2, #M9)
`types/gna.d.ts` is emitted by `script/generate_gna_types.js` directly from the
JSDoc on `framework/v*/core/gna.js`. The authoritative inventory is the
`GLOBAL_EXPORTS` array in `framework/v*/test/unit/gna-exports.test.js` — add a
global there, add JSDoc above the matching `gna.<name> =` assignment, then run:

```bash
npm run types:gen      # regenerate types/gna.d.ts
npm run types:check    # CI guard — exits 1 if the file drifted
```

A unit test (`gna-types-drift.test.js`) re-runs the generator in memory on
every test pass so stale declarations are caught before release. **Do not
hand-edit `types/gna.d.ts`** — your change will be overwritten on the next
generator run.
:::

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
