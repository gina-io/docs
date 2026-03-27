---
id: context
title: Context Helper
sidebar_label: Context
sidebar_position: 3
---

# Context Helper

The context helper is the framework's global key/value registry. It stores named
paths, environment variables, bundle references, and arbitrary data that needs to
be shared across modules without explicit `require()` chains.

All functions are injected globally at startup. They are available everywhere in
your bundle code.

---

## `setContext(name, obj, [force])`

Stores a value in the context.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | Key name. Dot-notation creates nested keys: `'gina.config'` stores under `context.gina.config`. |
| `obj` | `any` | — | Value to store |
| `force` | `boolean` | `false` | When `true`, merges `obj` into the existing value using deep merge with override semantics |

```js
setContext('myapp.config', { theme: 'dark' });

// Update a nested key without replacing the entire object
setContext('myapp.config', { lang: 'fr' }, true);
```

Calling `setContext` with a single argument replaces the entire context map.

---

## `getContext([name])`

Retrieves a value from the context.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Key name. Dot-notation is supported. Omit to return the entire context map. |

```js
var config = getContext('myapp.config');
var lang   = getContext('myapp.config.lang');
var all    = getContext();
```

---

## `resetContext()`

Rebuilds the full context from `projects.json`, environment variables, and the
path registry. Used internally by logger containers and out-of-context threads
(workers). Rarely needed in application code.

---

## `getConfig([bundle, [confName]])`

Loads a bundle's JSON configuration from the framework's `bundlesConfiguration`
store.

| Parameter | Type | Description |
|-----------|------|-------------|
| `bundle` | `string` | Bundle name. When omitted, the calling bundle is detected from the call stack automatically. |
| `confName` | `string` | Configuration block name (e.g. `'app'`, `'routing'`). When omitted, returns the full config object. |

```js
// From within a bundle — bundle name is inferred
var appConf = getConfig();

// Explicit bundle and config block
var routing = getConfig('frontend', 'routing');
```

---

## `getLib(bundle, lib)`

Loads and instantiates a library module from another bundle.

| Parameter | Type | Description |
|-----------|------|-------------|
| `bundle` | `string` | Bundle name. When omitted, auto-detected from the call stack. |
| `lib` | `string` | Library name (filename without `.js`) |

Returns a new instance of the library class with `getConfig()` attached to its
prototype.

```js
var mailer = getLib('notifications', 'mailer');
```

---

## `whisper(dictionary, replaceable, [rule])`

Resolves `${variable}` placeholders in strings or objects by substituting values
from `dictionary`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `dictionary` | `object` | Map of variable names to replacement values |
| `replaceable` | `string\|object` | The string or object containing placeholders |
| `rule` | `RegExp` | Optional override regex for matching placeholders |

```js
var template = 'Hello ${name}, welcome to ${app}!';
var result   = whisper({ name: 'Alice', app: 'MyApp' }, template);
// → 'Hello Alice, welcome to MyApp!'
```

`whisper` also resolves OS environment variables using `$VAR` or `~/` syntax
within string values:

```js
whisper({}, '~/config/app.json');
// → '/Users/alice/config/app.json'
```

When `replaceable` is an object, all string values in the object are resolved
recursively.

:::note Breaking change in 0.1.8
`whisper` requires `${variable}` syntax. The bare `{variable}` form used in
earlier versions is no longer supported.
:::

---

## `define(name, value)`

Defines a non-writable constant on `global`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Constant name. Must start with `GINA_` or `USER_`. Names not matching either prefix are automatically prefixed with `USER_`. |
| `value` | `any` | Constant value |

```js
define('USER_MAX_UPLOAD_SIZE', 10 * 1024 * 1024);
// Available globally as USER_MAX_UPLOAD_SIZE
```

---

## `getDefined()`

Returns an array of all global constant names that contain `GINA_` or `USER_`.

```js
var constants = getDefined();
// → ['GINA_VERSION', 'USER_MAX_UPLOAD_SIZE', ...]
```

---

## `isWin32()`

Returns `true` when the current platform is Windows.

```js
if (!isWin32()) {
    new _('~/app').symlinkSync('/usr/local/share/app');
}
```

---

## See also

- [Path helper](./path.md) — `setPath` / `getPath` store their data through `setContext`
- [whisper migration note](/migration) — `${variable}` vs `{variable}` syntax change
