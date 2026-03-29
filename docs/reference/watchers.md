---
title: watchers.json
sidebar_label: watchers.json
sidebar_position: 9
description: Reference for watchers.json — declare file watchers for a Gina bundle. Native fs.watch integration with no polling. Foundation for dev-mode hot-reload.
---

# watchers.json

Declares file watchers for a bundle. When the server starts, the framework reads
`watchers.json`, opens a native `fs.watch` handle for each declared file, and fires
an event whenever that file changes. No polling — changes are detected instantly.

```
src/<bundle>/config/watchers.json
```

`watchers.json` is optional. Omitting it (or leaving it empty) simply means no
framework-managed watchers are active for that bundle.

---

## Minimal example

Watch `app.json` for content changes:

```json title="src/frontend/config/watchers.json"
{
  "$schema": "https://gina.io/schema/watchers.json",
  "app.json": {
    "event": "change"
  }
}
```

---

## Format

Each top-level key is a **filename relative to the bundle's `config/` directory**.
The value is a watcher descriptor object.

```json
{
  "<filename>": {
    "event":      "change" | "rename",
    "persistent": true | false
  }
}
```

### `event`

**Type:** `"change"` | `"rename"` · **Default:** `"change"`

The `fs.watch` event type to listen for.

| Value | Fires when |
|---|---|
| `"change"` | The file's content is modified (most common) |
| `"rename"` | The file is moved or deleted |

### `persistent`

**Type:** `boolean` · **Default:** `false`

When `true`, the `fs.watch` handle keeps the Node.js event loop alive even if no other
work is pending. Leave this `false` unless you explicitly need the bundle process to
stay alive solely because of watchers.

---

## Listening to events

The framework exposes the running `WatcherService` instance as `gna.watcher` once the
server has started. Attach listeners in your bundle's `onStarted` callback:

```js title="src/frontend/index.js"
var frontend = require('gina');

frontend.onStarted(function() {
    if (gna.watcher) {
        gna.watcher.on('app.json', function(event, filePath) {
            console.info('[watcher] ' + filePath + ' changed — reload config here');
        });
    }
});

frontend.start();
```

`gna.watcher` is `undefined` when `watchers.json` has no entries (or is absent).
Always guard with `if (gna.watcher)` before calling `.on()`.

---

## Programmatic registration

To watch files that are not in the bundle's `config/` directory, or to register
watchers without a `watchers.json`, use `lib.Watcher` directly:

```js title="src/frontend/index.js"
var frontend = require('gina');
var lib      = frontend.lib;

frontend.onStarted(function() {
    var WatcherService = lib.Watcher;
    var w = new WatcherService();

    w.register('translations', '/abs/path/to/i18n/en.json', { event: 'change' });
    w.on('translations', function(event, filePath) {
        console.info('Translations changed — invalidate cache here');
    });
    w.start();
});

frontend.start();
```

---

## Multiple watchers

Watch several config files in one declaration:

```json title="src/backend/config/watchers.json"
{
  "$schema": "https://gina.io/schema/watchers.json",
  "app.json": {
    "event": "change"
  },
  "connectors.json": {
    "event": "change"
  },
  "routing.json": {
    "event": "change"
  }
}
```

---

## Environment overlay

Create `watchers.dev.json` alongside `watchers.json` to add or override entries only
in dev. Values in the dev file win on conflict.

```json title="src/frontend/config/watchers.dev.json"
{
  "templates.json": {
    "event": "change"
  }
}
```

The base `watchers.json` entries are preserved unchanged. The dev overlay simply
adds the `templates.json` watcher when `NODE_ENV=dev`.

---

## WatcherService API

`gna.watcher` (and any manually created instance) exposes:

| Method | Signature | Description |
|---|---|---|
| `register` | `(name, filePath, options?)` | Register a watcher entry. Silently ignored if `name` already exists. |
| `on` | `(name, listener)` | Attach a `function(event, filePath)` listener. Silently ignored if `name` is not registered. |
| `load` | `(basePath, conf)` | Populate entries from a parsed `watchers.json` object. Called internally by the framework. |
| `start` | `()` | Open `fs.watch` handles for all registered entries. Skips files that do not exist. |
| `stop` | `()` | Close all active `fs.watch` handles. Registered entries and listeners are preserved. |
| `active` | `() → string[]` | Names of entries with an open handle. |
| `registered` | `() → string[]` | Names of all registered entries (started or not). |

---

## Notes

- File paths in `watchers.json` are resolved relative to the bundle's `config/` directory.
  Use absolute paths when calling `register()` programmatically.
- `fs.watch` reliability varies by OS and filesystem. On Linux with network
  filesystems (NFS, CIFS) or inside Docker on macOS, some change events may be
  missed. In those environments, consider polling as a fallback.
- `watchers.json` is the foundation for the upcoming dev-mode hot-reload feature
  (#M6, `0.3.0`), which will register watchers for controllers and SQL files against
  the same service.
