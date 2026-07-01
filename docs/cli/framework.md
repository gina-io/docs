---
id: cli-framework
title: framework
sidebar_label: framework
sidebar_position: 4
description: CLI reference for gina framework commands — start, stop, and restart the socket server, tail live logs, set the log level, and manage the framework version.
level: intermediate
prereqs:
  - '[Gina installed globally](/getting-started/installation)'
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

Stop the framework socket server only. Running bundles are detached child processes and keep running — `framework:stop` does **not** stop them. Stop bundles with `gina bundle:stop <bundle> @<project>` or `gina project:stop @<project>`.

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

Print the active framework version, platform, architecture, bundled middleware, and — when the engine package is resolvable — the bundled template engine name and version.

```bash
gina version
# or the long form
gina framework:version
```

Example output:

```text
Gina I/O v0.4.6-alpha.2 darwin arm64 (MIT)
Middleware: isaac@0.4.6-alpha.1
Template engine: @rhinostone/swig@2.7.2
Copyright (c) 2009-2026 Rhinostone <contact@gina.io>
```

The `Template engine:` line reports the framework's bundled engine (swig by default) and is omitted when that engine package cannot be read. It reflects the framework default — an individual bundle may select a different engine via `render.engine` in its `settings.json`, which is not shown here.

Print only the version number, with no banner:

```bash
gina version --short=true
```

---

## `framework:add`

Install a published Gina version side-by-side with the active one, so a bundle can pin it via `--gina-version` (or its manifest `gina_version`). It downloads the version from npm (`npm pack gina@<version>`), archives it under `~/.gina/archives/framework`, installs that tree's own dependencies, symlinks it into the active install, and registers it in `~/.gina/main.json` under `frameworks`. It is **additive** — it never changes the default version, and the shipped active install is never clobbered.

```bash
gina framework:add 0.4.7                # install 0.4.7 alongside the active version
gina framework:add 0.4.7 --dry-run      # preview the plan; write nothing
gina framework:add 0.4.7 --format=json  # machine-readable result
```

### Options

| Flag | Description |
|------|-------------|
| `--force` | Overwrite an existing archived copy of that version. |
| `--dry-run` | Print the plan and exit without writing anything. |
| `--format=json` | Emit a JSON result instead of the human-readable summary. |

Once added, pin a bundle to it at start time:

```bash
gina bundle:start <bundle> @<project> --gina-version=0.4.7
```

:::note
If the requested version is already the real (shipped) install directory, the symlink step is skipped and the active install is left untouched. A published version whose tarball predates the side-by-side `framework/v<version>` layout cannot be added.
:::

---

## `framework:list`

List the framework versions known to this install: the active version, side-by-side versions added with [`framework:add`](#frameworkadd), and archived copies. The active version is marked with a leading `*`. This command is read-only — it never changes any state.

```bash
gina framework:list                # versions present on disk
gina framework:list --all          # also include versions registered but not on disk
gina framework:list --format=json  # machine-readable listing
```

### Options

| Flag | Description |
|------|-------------|
| `--all` | Also include versions registered in `main.json` but not present on disk. |
| `--format=json` | Emit a JSON listing instead of the table. |

Each row reports a `kind` — `real` (the shipped active version), `symlink` (a side-by-side add), `archived` (in the archive but not linked), or `registered` (recorded in `main.json` only, shown with `--all`) — alongside a status such as `active`, `broken link`, or `not installed`.

---

## `framework:remove`

Remove a side-by-side version added with [`framework:add`](#frameworkadd). It deregisters the version from `~/.gina/main.json`, unlinks its symlink, and deletes its archived copy — the inverse of `framework:add`.

```bash
gina framework:remove 0.4.7              # remove the side-by-side 0.4.7
gina framework:remove 0.4.7 --dry-run    # preview what would be removed
gina framework:remove 0.4.7 --force      # remove even if a bundle still pins it
```

### Options

| Flag | Description |
|------|-------------|
| `--force` | Remove the version even when a bundle still pins it. |
| `--dry-run` | Print the plan and exit without removing anything. |
| `--format=json` | Emit a JSON result instead of the human-readable summary. |

:::note
`framework:remove` refuses to remove the active default (`def_framework`) or the real framework directory shipped with the install — neither can be overridden with `--force`. Only side-by-side (added) versions can be removed. When a bundle still pins the version, the command refuses unless you pass `--force`.
:::

---

## `framework:update`

Reconcile the `~/.gina/` state stores to the installed framework version. It rewrites `def_framework` in `~/.gina/main.json` and the `version` / `def_framework` fields in `~/.gina/<version>/settings.json` to match the framework version on disk (or a version passed with `--to-version`), and registers that version in the `frameworks` map — automating the post-upgrade state check that otherwise has to be done by hand after a manual framework update.

It is **dry-run by default**: with no flags it reports what is out of sync and writes nothing. Pass `--fix` (or `--apply`) to apply the reconciliation.

```bash
gina framework:update                     # report what would change (no writes)
gina framework:update --fix               # reconcile state to the installed version
gina framework:update --to-version=0.5.4  # reconcile to a specific installed version
gina framework:update --format=json       # machine-readable report
```

### Options

| Flag | Description |
|------|-------------|
| `--fix` / `--apply` | Apply the reconciliation. Without it, the command only reports. |
| `--dry-run` | Force report-only mode (the default). |
| `--to-version=<v>` | Reconcile to a specific installed version instead of the current one. |
| `--format=json` | Emit a JSON report instead of human-readable text. |

:::note
This is a state-reconciliation command, not an installer — it does **not** download or switch framework versions over the network, and it never lowers the recorded version below what is installed. To install a different framework version, use npm (`npm install -g gina@<version>`); a future `--self-update` flag is planned to wrap that.
:::

---

## `framework:reset`

Factory reset — clears `~/.gina` (settings, project registry, env config, port allocations) so it is rebuilt from defaults on the next command. It is the runtime, package-manager-agnostic equivalent of `npm install -g gina@latest --reset`, and the only factory reset available on the [Bun](https://bun.sh) runtime — Bun skips the npm install lifecycle, so the `--reset` flag never runs. Your project source files are never touched.

The shorthand `gina reset` is equivalent to `gina framework:reset`.

```bash
gina reset                    # clear ~/.gina (rebuilt on the next command)
gina framework:reset          # same thing, long form
gina framework:reset --force  # reset even while the daemon/bundles are running
```

By default it **refuses while the framework daemon or any bundle is running** — wiping `~/.gina` would orphan them. Stop them first with `gina stop`, or pass `--force`.

### Options

| Flag | Description |
|------|-------------|
| `--force` | Reset even while the daemon or bundles are running. They keep running but become untracked. |

:::note
`~/.gina` is left removed when the command returns; the next `gina` command re-creates it from defaults. A reset cannot repair a broken **installation** (you can't run a broken program to fix itself) — for that, reinstall the package and clear preferences manually. See [Factory reset](/getting-started/installation#factory-reset) for the full recovery steps.
:::

---

## `framework:man`

Render the `framework` command group's manual page inline in the terminal — no browser needed. When a rendered manual page is not available for a group, it falls back to that group's help text.

```bash
gina framework:man
```

The same command exists for the other groups: `project:man`, `bundle:man`, and `service:man`.

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

## `framework:get`

Read one or more keys from `~/.gina/<version>/settings.json`.
Counterpart to [`framework:set`](#frameworkset).

```bash
gina get                        # print all settings
gina get all                    # same — explicit all
gina get --log-level            # print a single value (flag style)
gina get log_level              # same — bare key name
gina get --port --env           # print multiple values
```

Shorthand `gina get` is equivalent to `gina framework:get`.

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
