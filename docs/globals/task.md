---
id: task
title: Task Helper
sidebar_label: Task
sidebar_position: 6
description: Global run() function for executing shell commands from Gina bundle code, with EventEmitter-based streaming output and completion callbacks.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[async/await](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Promises)'
---

# Task Helper

The task helper injects the global `run()` function for executing shell commands
from within bundle code. It wraps `child_process.spawn` and provides an
EventEmitter-based interface for streaming output and completion callbacks. No `require()` call is needed — `run()` is available globally after framework startup.

---

## `run(cmdline, [options], [callback])`

Executes a shell command.

| Parameter | Type | Description |
|-----------|------|-------------|
| `cmdline` | `string\|Array` | Command and arguments. A string is split on spaces; pass an array when arguments contain spaces. |
| `options` | `object` | Options (see below) |
| `callback` | `function` | Optional `(err, result)` callback on process exit |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cwd` | `string` | A directory derived from the framework's install location — pass it explicitly | Working directory for the spawned process; the calling process itself `chdir`s to it |
| `tmp` | `string` | System temp dir | Base directory: each run creates a private `gina-run-*` directory (mode 0700) under it holding its `out.log` and `err.log`, removed with the directory when the process exits (since 0.7.1) |
| `outToProcessSTD` | `boolean` | `false` | When `true`, pipes the child process stdin/stdout/stderr directly to the parent process streams |

### Return value

Returns an EventEmitter with two methods:

| Method | Description |
|--------|-------------|
| `.onData(callback)` | Called each time data arrives on stdout. `callback(data)` |
| `.onComplete(callback)` | Called when the process exits. `callback(err, output)` where `output` is the full captured stdout string |

---

## Examples

### Simple command

```js
run('git status', { cwd: '/var/app' }, function(err, output) {
    if (err) return console.err(err);
    console.info(output);
});
```

### Streaming output

```js
var task = run(['npm', 'install', '--prefix', '/var/app']);

task.onData(function(chunk) {
    process.stdout.write(chunk);
});

task.onComplete(function(err, output) {
    if (err) console.err('npm install failed:', err);
});
```

### Forward to process streams

```js
run('sass --watch src/scss:public/css', {
    cwd             : getPath('myapp.root')
  , outToProcessSTD : true
});
```

---

## Notes

- Output is captured to two temporary files (`out.log`, `err.log`) in a private per-run
  directory under `tmp` during execution, read back as a single string on process exit
  and removed with the directory. Since 0.7.1 concurrent runs never share those files
  (they used to share one fixed pair in `tmp`), and a failure while reading them back
  is delivered as the run's error. Both `.onData()` and `.onComplete()` fire on process
  exit with the full captured output.
- The spawned process inherits the current `process.env`.

---

## See also

- [Context helper](./context.md) — `getPath` for resolving working directories
