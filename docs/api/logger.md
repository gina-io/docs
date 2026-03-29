---
id: logger
title: Logger
sidebar_label: Logger
description: Multi-stream structured logging API for the Gina framework with syslog severity levels, runtime hierarchy control, and pluggable transport containers.
---

# Logger API reference

The Gina logger replaces the global `console` object at startup, routing every call through a severity filter and a pluggable transport pipeline. Your bundle code calls `console.info(...)`, `console.err(...)`, etc. as normal — the logger handles level filtering, formatting, and delivery to stdout, the MQ tail stream, and optional file containers.

For conceptual background, usage examples, and `gina tail` workflow guidance,
see the [Logging guide](/guides/logging).

---

## Logging methods

All methods accept any number of arguments. Objects are serialised with a
custom recursive formatter; functions are stringified; primitives are
space-separated.

```js
console.emerg(msg, ...args)    // code 0 — also exits the process
console.alert(msg, ...args)    // code 1
console.crit(msg, ...args)     // code 2
console.err(msg, ...args)      // code 3  (preferred over console.error)
console.warning(msg, ...args)  // code 4  (preferred over console.warn)
console.notice(msg, ...args)   // code 5  — always visible at every log level
console.info(msg, ...args)     // code 6
console.debug(msg, ...args)    // code 7
```

See [Log levels](/guides/logging#log-levels) for the full severity table with
colors and descriptions, and [Hierarchy](/guides/logging#hierarchy--the-cascade-design)
for which methods are visible at each setting.

---

## `console.setLevel(level, group)`

Changes the active hierarchy for a specific logger group at runtime. Also
updates `process.env.LOG_LEVEL` so any code reading the env directly stays
consistent.

| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | `string` | One of: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `group` | `string` | Logger group name. Usually your bundle name (e.g. `frontend@myproject`). Defaults to `gina`. |

```js
// In your bundle bootstrap (index.js):
var lib     = require('gina').lib;
var console = lib.logger;
console.setLevel('debug', 'frontend@myproject');
```

If `level` is not a valid hierarchy, the logger falls back to `info` and logs
a warning. See [Configuring the log level](/guides/logging#configuring-the-log-level)
for CLI and environment alternatives.

---

## `console.pauseReporting()` / `console.resumeReporting()`

Temporarily suppresses all output for the default group. Used internally by
`gina tail` to prevent duplicate output during log stream handoff.

```js
console.pauseReporting();
// ... do something that would generate noise ...
console.resumeReporting();
```

---

## `console.log(msg)`

Writes directly to `process.stdout` — bypasses the hierarchy filter and the
container pipeline entirely. Use only for raw / already-formatted output that
must never be suppressed.

---

## Containers {#containers}

Gina calls transports **containers**. Each container listens on a named flow
(`process.emit('logger#<name>', ...)`) and handles delivery independently.

| Container | Flow name | Destination | Always active |
|-----------|-----------|-------------|:---:|
| `default` | `logger#default` | `process.stdout` | ✓ |
| `mq` | `logger#mq` | MQSpeaker → port 8125 → MQListener | ✓ |
| `file` | `logger#file` | Rotating log files on disk | opt-in |

The `mq` container powers [`gina tail`](/guides/logging#following-logs-in-real-time).
Every formatted log line is broadcast to the MQ listener, which forwards it to
any connected tail clients.

### Adding a custom container

Create a config file at:

```
~/.gina/user/extensions/logger/<container-name>/config.json
```

Then add the container name to the `flows` array in:

```
~/.gina/user/extensions/logger/default/config.json
```

Restart Gina for the change to take effect.
