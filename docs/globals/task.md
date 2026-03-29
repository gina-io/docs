---
id: task
title: Task Helper
sidebar_label: Task
sidebar_position: 6
description: Global run() function for executing shell commands from Gina bundle code, with EventEmitter-based streaming output and completion callbacks.
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
| `cwd` | `string` | `process.cwd()` | Working directory for the spawned process |
| `tmp` | `string` | System temp dir | Directory where `out.log` and `err.log` are written during execution |
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
    cwd: getPath('myapp.root'),
    outToProcessSTD: true
});
```

---

## Notes

- Output is captured to temporary files (`out.log`, `err.log`) during execution and
  read back as a single string on process exit. For long-running commands, prefer
  `.onData()` for real-time feedback.
- The spawned process inherits the current `process.env`.

---

## See also

- [Context helper](./context.md) — `getPath` for resolving working directories
