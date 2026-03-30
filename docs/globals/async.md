---
id: async
title: Async Utilities
sidebar_label: Async
sidebar_position: 11
description: Global async utility functions injected by the Gina framework — Promise adapters and helpers for bridging older callback-based APIs into async/await controller actions.
level: intermediate
prereqs:
  - Controllers
  - async/await
---

# Async Utilities

Global helpers that bridge older callback-based APIs into the `async/await` world.
No `require()` needed — these are injected into the global scope at framework startup.

---

## `onCompleteCall(emitter)`

Wraps any EventEmitter that exposes `.onComplete(cb)` into a native Promise.
Use this in `async` controller actions to `await` operations that fire
`.onComplete(err, result)` rather than returning a Promise — such as PathObject
file operations (`mkdir`, `cp`, `mv`, `rm`) and `Shell` commands.

| Parameter | Type | Description |
|-----------|------|-------------|
| `emitter` | `EventEmitter` | Any object with an `.onComplete(cb)` method |

**Returns** `Promise<*>` — resolves with the operation result, rejects on error.

```js
// Await a PathObject mkdir() from an async controller action
var Controller = function() {
    var self = this;

    this.upload = async function(req, res, next) {
        // mkdir() returns an EventEmitter; onCompleteCall wraps it in a Promise
        await onCompleteCall( _(self.uploadDir).mkdir() );
        self.renderJSON({ ok: true });
    };
};
module.exports = Controller;
```

```js
// Await a file copy
await onCompleteCall( _(srcPath).cp(destPath) );

// Await a file remove
await onCompleteCall( _(tmpFile).rm() );
```

Not limited to PathObject — any object that follows the `.onComplete(cb)` convention works:

```js
// Custom EventEmitter that uses .onComplete(cb)
await onCompleteCall( myService.processJob(payload) );
```

No `require()` needed — `onCompleteCall` is injected globally by the path helper
alongside `_()`.

:::note Entities do not need onCompleteCall
Entity methods already return a native Promise (with an `.onComplete(cb)` shim
for backwards compatibility). Use `await entity.method()` directly.
:::

---

## See also

- [Path Helper](./path.md) — PathObject file operations that return an EventEmitter
- [Controllers](../guides/controller.md#async-actions) — async controller actions and the `await` patterns
