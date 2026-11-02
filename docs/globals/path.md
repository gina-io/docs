---
id: path
title: Path Helper
sidebar_label: Path
sidebar_position: 2
description: Global path constructor and named-path registry for the Gina framework, wrapping Node.js fs and path modules with cross-platform file-system operations.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
---

# Path Helper

The path helper injects the global `_()` constructor and the named-path registry
functions (`setPath`, `getPath`, `setPaths`, `getPaths`). It wraps Node's `path` and `fs` modules with a cross-platform, EventEmitter-based API for file-system operations, available everywhere in bundle code without a `require()` call.

---

## `_(path, force)`

Normalises a path string. Expands `~/` to the user's home directory.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `string` | — | The path to normalise |
| `force` | `boolean` | `false` | When `true`, returns a plain normalised string instead of a PathObject |

```js
// Returns a normalised string — use when you need a string (e.g. require())
var absPath = _(__dirname + '/lib/foo', true);
require(absPath);

// Returns a PathObject with file-system methods
var p = new _('~/projects/myapp');
```

---

## PathObject

`new _(path)` returns a **PathObject** — an object that holds the normalised path
and exposes file-system methods on it.

### Conversion

#### `.toString()`

Returns the path as a platform-appropriate string.

#### `.toArray()`

Splits the path into segments and returns an array with helper accessors:

```js
var parts = new _('/a/b/c').toArray();
parts.first();    // 'a'
parts.last();     // 'c'
parts.index(1);   // 'b'
```

#### `.toUnixStyle()`

Returns the path with forward slashes.

#### `.toWin32Style()`

Returns the path with backslashes.

---

### Checks

#### `.existsSync()`

Returns `true` if the path exists (follows symlinks).

#### `.exists(callback)`

Async existence check.

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `function` | Called with `(found)` where `found` is a boolean |

#### `.isDirectory()`

Returns `true` if the path is a directory (not a symlink).

#### `.isSymlinkSync()`

Returns `true` if the path is a symbolic link.

#### `.getSymlinkSourceSync()`

Returns the symlink target path. Throws if the path is not a symlink.

#### `.isWritableSync()`

Returns `true` if the current process has write permission for the path.

#### `.isWritable(callback)`

Async write-permission check.

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `function` | Called with `(writable)` where `writable` is a boolean |

#### `.isValidPath(callback)`

Validates path syntax for both Unix and Win32 formats.

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `function` | Called with `(valid)` where `valid` is a boolean |

#### `.hasFile(search, callback)`

Checks whether a file exists inside a directory.

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | `string` | Filename to look for |
| `callback` | `function` | Called with `(found)` |

---

### Directory creation

#### `.mkdirSync([permission])`

Creates the directory (and any missing parents) synchronously.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `permission` | `number` | `0775` | Octal permission mode |

**Returns** the PathObject on success, or an `Error` instance on failure.
This method **does not throw** — always check the return value:

```js
var result = new _('/var/app/cache').mkdirSync();
if (result instanceof Error) {
    console.err('Could not create cache dir:', result.message);
}
```

#### `.mkdir([permission], callback)`

Async version. Uses a per-operation EventEmitter internally.

| Parameter | Type | Description |
|-----------|------|-------------|
| `permission` | `number` | Octal permission mode (default `0775`) |
| `callback` | `function` | Called with `(err)` |

```js
new _('/var/app/cache').mkdir(function(err) {
    if (err) console.err(err);
});
```

*Changed in 0.7.8.* A folder that cannot be created now reaches the callback; before, the callback
never ran. Two concurrent calls for the same path both succeed.

---

### Removal

#### `.rmSync()`

Removes the file or directory (including all contents) synchronously.

#### `.rm(callback)`

Async removal. Uses a per-operation EventEmitter.

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `function` | Called with `(err)` |

*Changed in 0.7.8.* Every call calls back once. A path another remove takes meanwhile is not a
failure. Any other failure reaches the callback, including an `unlink` the system denies, which used
to read as a success with the file still there.

---

### Copy and move

#### `.cp(target, excluded, callback)`

Copies a file or directory to `target`. Supports exclusion lists.

| Parameter | Type | Description |
|-----------|------|-------------|
| `target` | `string` | Destination path |
| `excluded` | `Array<string\|RegExp>` | Files or patterns to skip |
| `callback` | `function` | Called with `(err)` |

What it does depends on the source:

- **A file** is written to `target`, created or replaced atomically. When `target` is an existing
  folder, the file goes inside it under its own name.
- **A folder** is copied to `target`. An existing `target` is **replaced**: what it held is removed
  first. A trailing slash on either path changes nothing.
- **A symlink** becomes a new symlink to the same real path. An existing `target` is a failure
  (`EEXIST`).

A target that already is the source, by another spelling, through a symlinked parent or as a hard
link, is a no-op that reports a success.

*Changed in 0.7.8.*

- A folder copy copies all it can and reports its first failure at the end. It used to leave out a
  file it could not read and report a success.
- A folder copied onto a folder that holds it, or into itself, is refused before anything is written,
  with an `Error` whose `code` is `EINVAL`. The first destroyed the whole of the folder that holds it,
  and the second recursed until the path was too long. With an `excluded` list that names the
  destination, a folder can still be copied into itself.

#### `.mv(target, callback)`

Moves (or renames) a file or directory. Implemented as `.cp()` followed by `.rm()`, so the rules of
`.cp()` apply, and the source is removed only once the copy has succeeded.

| Parameter | Type | Description |
|-----------|------|-------------|
| `target` | `string` | Destination path |
| `callback` | `function` | Called with `(err)` |

*Changed in 0.7.8.*

- Every call calls back once, whatever happens to its paths meanwhile. A source that another move or
  remove took during the move used to throw an uncaught exception or lose the callback. A failure now
  reaches the callback; with no callback it is logged, where it threw.
- A target that already is the source is a no-op, and so is a file moved to the folder it already sits
  in. Both used to destroy it and report a success.
- A rename that only changes the case renames, on a filesystem that ignores case. It used to destroy
  the path.
- A folder whose copy reported a failure keeps its source. It used to be removed, with the file that
  could not be read.
- A folder moved onto a folder that holds it, or into itself, is refused as in `.cp()` (`EINVAL`).

---

### Links and rename

#### `.symlinkSync(destination, [type])`

Creates a symbolic link at `destination` pointing to this path.

| Parameter | Type | Description |
|-----------|------|-------------|
| `destination` | `string` | Where the symlink is created |
| `type` | `string` | Windows only: `'dir'`, `'file'`, or `'junction'` |

#### `.renameSync(destination)`

Renames (moves) the file or directory synchronously.

| Parameter | Type | Description |
|-----------|------|-------------|
| `destination` | `string` | New path |

---

## Named path registry

The helper also injects four global functions for registering and retrieving
named paths across the framework.

### `setPath(name, path)`

Registers a named path in the context. Supports dot-notation for namespacing.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Registry key, e.g. `'gina.core'` or `'myapp.uploads'` |
| `path` | `string` | Absolute path to register |

```js
setPath('myapp.uploads', '/var/app/uploads');
```

### `getPath(name)`

Retrieves a previously registered path. Throws if the name is not found.

```js
var uploads = getPath('myapp.uploads');
```

### `setPaths(paths)`

Replaces the entire paths registry with the provided object.

### `getPaths()`

Returns the entire paths registry as an object.

---

## See also

- [Context helper](./context.md) — `setContext` / `getContext` where path registry data is stored
- [Prototypes](./prototypes.md) — `__stack` and other globals
- [Async Utilities](./async.md) — `onCompleteCall` for awaiting PathObject and Shell operations
