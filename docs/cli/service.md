---
id: cli-service
title: service
sidebar_label: service
sidebar_position: 11
description: CLI reference for gina service commands — start and list framework-internal services (bundles registered under @gina) via the daemon-free gina-container launcher.
level: intermediate
prereqs:
  - '[Gina installed globally](/getting-started/installation)'
  - '[CLI bundle reference](/cli/cli-bundle)'
---

The `service` command group **starts and lists framework-internal services** — bundles that ship alongside gina and run as companion processes (currently `proxy` and `inspector`). These services are registered under the reserved `@gina` project.

:::info Gina-internal surface
`service:list` and `service:start` currently reject any project other than `@gina`. User-defined services are not a surface yet — use [`bundle:list`](/cli/cli-bundle#bundlelist) for bundles in user projects.
:::

---

## `service:list`

*New in 0.3.7-alpha.2*

List framework-internal services with src-existence, preferred-port summary, and host-side running state.

```bash
gina service:list
```

```bash
gina service:list @gina
```

**Flags**

| Flag | Description |
|------|-------------|
| `--format=json` | Emit a JSON payload instead of the human-readable text table |

### Output

```text
[ running ] inspector      http/2.0 dev https 4208  pid 27007
[ running ] proxy          http/2.0 dev https 4210  pid 15346
```

- **`[ running ]` / `[ stopped ]` / `[ ?! ]`** — running state (probed from `~/.gina/run/<service>@gina.pid` with `process.kill(pid, 0)`) or src-existence when the source directory is missing.
- **`http/2.0 dev https 4208`** — preferred port. Read from `~/.gina/ports.reverse.json`. Precedence: `http/2.0 https` → `http/1.1 https` → `http/1.1 http`; `dev` env is preferred when present, otherwise the first environment in the record. Services with no allocated port render as `(no port)`.
- **`pid 27007`** — process id when running.

With `--format=json`, each service object carries:

```json
{
  "service": "inspector",
  "path": "src/inspector",
  "status": "ok",
  "ports": {
    "dev":  { "http/1.1": { "http": 4200, "https": 4204 }, "http/2.0": { "https": 4208 } },
    "prod": { "http/1.1": { "http": 4201, "https": 4205 }, "http/2.0": { "https": 4209 } }
  },
  "running": true,
  "pid": 27007
}
```

A missing or malformed `ports.reverse.json` is tolerated — the command still renders with every service showing `(no port)` / `ports: null`. A stale pidfile (process exited) reports `(stopped)` without being deleted; pidfile clean-up stays with [`bundle:stop`](/cli/cli-bundle#bundlestop).

:::caution Docker bundles
Services running inside a Docker container write their pidfile inside the container, not on the host `~/.gina/run/` directory. Running `service:list` from a host shell will report them as `(stopped)` even when the container is up — use `docker ps` or `docker exec <container> gina service:list` for the container-side view.
:::

---

## `service:start`

*New in 0.4.3-alpha*

Start a framework-internal service — a bundle registered under the `@gina` project — using the daemon-free `gina-container` launcher (no `gina start` socket server required).

```bash
gina service:start inspector
```

The service runs in the `@gina` project's own `dev` / `local` defaults; the calling shell's `NODE_ENV` / `NODE_SCOPE` are not propagated. Use [`bundle:start`](/cli/cli-bundle#bundlestart) when you need explicit env/scope control, and [`bundle:stop`](/cli/cli-bundle#bundlestop) `inspector @gina` to stop a running service.

**Flags**

| Flag | Description |
|------|-------------|
| `--dry-run` | Print the launch command that would run, without spawning anything |
| `--format=json` | Emit a JSON result payload instead of text |

### Behaviour

- **Already running** → no-op (success). A live `~/.gina/run/<service>@gina.pid` short-circuits the spawn, so repeated calls never create duplicate processes.
- **Source missing** → error. `services/` ships in neither git nor npm, so in a fresh `npm install gina` the service source is absent and the command reports there is nothing to start.

With `--format=json`:

```json
{ "service": "inspector", "src": "src/inspector", "started": true, "running": false, "pid": 60517 }
```

:::info Dev auto-start
In **dev mode** the standalone Inspector auto-starts when one of your bundles boots — there is no need to run `service:start` by hand. The auto-start is a no-op unless the framework `services/` project is scaffolded locally (it ships in neither git nor npm), and it never fires from a `@gina` service itself. The embedded SPA at `/_gina/inspector/` is always available for quick dev access.
:::

---

## `service:man`

*New in 0.5.5-alpha.2*

Render the `service` command group's manual page inline in the terminal — no browser needed. Falls back to the group's help text when no rendered manual page is available.

```bash
gina service:man
```

---

## `service:help`

Print the usage summary for the `service` command group.

```bash
gina service:help
```

```bash
gina service
```
