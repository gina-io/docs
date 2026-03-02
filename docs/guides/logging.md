---
sidebar_position: 2
---

# Logging

## Following logs in real time

The easiest way to see what is happening across all bundles and the framework:

```bash
gina tail
```

`gina tail` is an alias for `gina framework:tail`.

> **Note:** When a bundle exits, the tail process closes. Use `--follow` to keep it running:
> ```bash
> gina tail --follow
> ```

---

## Log storage

By default, Gina does **not** store logs to disk. Logs are event-driven and printed to `process.stdout`. You can capture them at the OS level when writing your daemon/startup scripts for production.

Gina offers three approaches for log storage:

### Method 1 — `gina tail` (development)

Best for development. Gives you a live view of all bundles and the framework in one terminal window.

### Method 2 — Redirect stdout (production, manual)

```bash
gina bundle:start frontend @myproject --log > /usr/local/var/log/gina/frontend.myproject.app.log 2>&1
```

Then follow with:

```bash
tail -f /usr/local/var/log/gina/frontend.myproject.app.log
```

You are responsible for [log rotation](https://linux.die.net/man/8/logrotate) with this method.

### Method 3 — File transport (experimental)

Gina includes a file container/transport that you can enable in the logger config:

```
~/.gina/user/extensions/logger/default/config.json
```

Add `"file"` to the `flows` array. Then restart Gina:

```bash
gina restart
```

---

## Log levels

The default log level is `info`.

| Level | Messages included |
|-------|-------------------|
| `trace` | Emergency, Alert, Critical, Error, Warning, Notice, Info, Debug |
| `debug` | Emergency, Alert, Critical, Error, Warning, Notice, Info, Debug |
| `info` | Emergency, Alert, Critical, Error, Warning, Notice, Info |
| `warn` | Emergency, Alert, Critical, Error, Warning, Notice |
| `error` | Emergency, Alert, Critical, Error, Notice |
| `fatal` | Emergency, Alert, Critical, Notice |

### Change the log level

```bash
gina framework:set --log-level=debug
```

Set this while developing to see all debug output from the framework and your bundles.
