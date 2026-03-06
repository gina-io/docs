---
id: cli-framework
title: framework
sidebar_label: framework
sidebar_position: 4
---

# `gina framework`

Manage the Gina framework socket server and framework-level settings.

The framework server listens on port `8124` and acts as the dispatcher for all
online commands. It must be running before you can start or stop bundles.

---

## `gina start` / `gina stop`

Shorthand for `framework:start` and `framework:stop`.

```bash
gina start    # start the framework socket server
gina stop     # stop the framework socket server
```

---

## `framework:start`

Start the framework socket server in the background.

```bash
gina framework:start
```

---

## `framework:stop`

Stop the framework socket server and all running bundles.

```bash
gina framework:stop
```

---

## `framework:restart`

Restart the framework socket server.

```bash
gina framework:restart
```

---

## `framework:status`

Check whether the framework server is running.

```bash
gina framework:status
```

---

## `framework:version`

Print the currently active framework version.

```bash
gina framework:version
```

---

## `framework:update`

Switch to the latest installed framework version.

```bash
gina framework:update
```

---

## `framework:tail`

Stream live log output from all running bundles via the MQ listener on port `8125`.
Alias: `gina tail`.

```bash
gina framework:tail
gina tail               # shorthand
gina tail --follow      # reconnect automatically after bundle restarts
```

See [Following logs in real time](/guides/logging#following-logs-in-real-time) for
filtering and workflow tips.

---

## `framework:set`

Persist a framework-level setting to `~/.gina/<version>/settings.json`.

```bash
gina framework:set --log-level=<level>
```

| Flag | Values | Description |
|------|--------|-------------|
| `--log-level` | `trace` `debug` `info` `warn` `error` `fatal` | Default log level for all bundles |

```bash
gina framework:set --log-level=debug
gina framework:set --log-level=info
```

---

## `framework:init`

Initialise the `~/.gina/<version>/` config directory. Run automatically during
`npm install`, but can be re-run manually if config files are missing.

```bash
gina framework:init
```
