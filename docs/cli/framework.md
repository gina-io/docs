---
id: cli-framework
title: framework
sidebar_label: framework
sidebar_position: 4
description: CLI reference for gina framework commands — start, stop, and restart the socket server, tail live logs, set the log level, and manage the framework version.
level: intermediate
prereqs:
  - Gina installed globally
---

# `gina framework`

Manage the Gina framework socket server and framework-level settings.

The framework server listens on port `8124` and acts as the dispatcher for all online commands (such as starting and stopping bundles). It must be running before you can issue any online command. Port `8125` serves the MQ listener used by `gina tail` to stream live log output.

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

Persist a framework-level setting to `~/.gina/main.json` and/or
`~/.gina/<version>/settings.json`.

```bash
gina framework:set --<flag>=<value>
```

| Flag | Description |
|------|-------------|
| `--log-level` | Default log level (`trace` `debug` `info` `warn` `error` `fatal`) |
| `--env` | Default environment |
| `--scope` | Default scope |
| `--port` | Framework socket port (default `8124`) |
| `--mq-port` | MQ listener port (default `8125`) |
| `--debug-port` | Node.js inspector port |
| `--host-v4` | IPv4 host address |
| `--hostname` | Hostname |
| `--culture` | Default culture (e.g. `en_US`) |
| `--timezone` | Default timezone (e.g. `America/New_York`) |
| `--prefix` | Framework install prefix path |
| `--global-mode` | Enable/disable global mode |

```bash
gina framework:set --log-level=debug
gina framework:set --culture=en_US --timezone=America/New_York
```

---

## `framework:link`

Symlink the globally installed `gina` package into a project's
`node_modules/gina`. Requires Gina to be installed globally.

```bash
gina framework:link @<project>
gina framework:link @<project> --prefix=<path>
```

```bash
gina framework:link @myproject
```

---

## `framework:link-node-modules`

Symlink a project's `node_modules` directory to `~/<project>/lib/node_modules`,
allowing node_modules to be shared across scopes (e.g. Docker and localhost).

```bash
gina framework:link-node-modules @<project>
```

---

## `gina .` — open a directory in Terminal (macOS)

Opens a Gina-related directory in a new `Terminal.app` window.

```bash
gina .                  # framework install dir (default)
gina . home             # ~/.gina/
gina . framework        # framework install dir
gina . services         # services/ dir
gina . lib              # framework lib/ dir
```

---

## `framework:init`

Initialise the `~/.gina/<version>/` config directory. Run automatically during
`npm install`, but can be re-run manually if config files are missing.

```bash
gina framework:init
```
