---
sidebar_position: 4
---

# K8s and Docker

Running a Gina bundle inside a Docker container or a Kubernetes pod requires a
different launch strategy than a typical workstation setup.

---

## The problem with `gina bundle:start` in containers

On a workstation, the normal launch sequence is:

```bash
gina start
gina bundle:start api @myproject
gina tail
```

`gina bundle:start` spawns the bundle as a **detached** background process.
`gina tail` then becomes the foreground process that keeps the terminal busy.

In a container this creates a signal propagation gap:

- Docker and K8s send `SIGTERM` to the **foreground process** (`gina tail`).
- The bundle process is detached — it never receives `SIGTERM`.
- K8s waits for `terminationGracePeriodSeconds`, then sends `SIGKILL`.
- The bundle is killed abruptly, dropping in-flight requests.

---

## `gina-container` — foreground launcher

`gina-container` is a single-purpose launcher that starts one bundle as a
**non-detached foreground child process**. The launcher stays alive as the
container's foreground process and owns the full shutdown lifecycle:

1. K8s sends `SIGTERM` to the launcher (PID 1 or a direct init child).
2. The launcher forwards `SIGTERM` to the bundle.
3. The bundle drains in-flight requests (controlled by `GINA_SHUTDOWN_TIMEOUT`),
   then exits with code 143.
4. The launcher exits with the same code.

No framework socket server (port 8124) is needed — `gina-container` reads
project configuration directly from `~/.gina/`.

---

## Prerequisites

`gina-container` relies on the same `~/.gina/` state that the CLI uses.
This setup must be completed before the launcher runs — typically in the
container entrypoint script, with results cached in flag files so it only
runs on first start.

Minimum required commands (adjust ports and names to your project):

```bash
gina project:add @myproject --path /app
gina scope:use production @myproject
gina env:use production @myproject
gina port:reset @myproject --start-from=3000
```

> For an example of a complete first-run ceremony with caching, see the
> `events/docker/on-container-init.sh` pattern in your project's event hooks.

---

## Usage

Once `~/.gina/` is configured, replace the `gina bundle:start` + `gina tail`
block at the end of your entrypoint script with:

```bash
exec gina-container api @myproject
```

`exec` replaces the shell with the launcher so it becomes PID 1 (or hands off
cleanly to the init process).

---

## Dockerfile example

```dockerfile
FROM node:22-slim

# Install gina globally
RUN npm install -g gina

# Copy your project
COPY . /app
WORKDIR /app

# Copy and make the entrypoint executable
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["api", "@myproject"]
```

`entrypoint.sh`:

```bash
#!/bin/sh
set -e

BUNDLE="$1"
PROJECT="$2"

# First-run setup (cache with a flag file)
if [ ! -f "$HOME/.gina_configured" ]; then
    gina project:add "$PROJECT" --path /app
    gina scope:use production "$PROJECT"
    gina env:use  production "$PROJECT"
    gina port:reset "$PROJECT" --start-from=3000
    touch "$HOME/.gina_configured"
fi

exec gina-container "$BUNDLE" "$PROJECT"
```

---

## Kubernetes Pod spec example

```yaml
apiVersion: v1
kind: Pod
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: api
      image: myregistry/myproject-api:latest
      ports:
        - containerPort: 3000
      env:
        - name: NODE_ENV
          value: production
        - name: NODE_SCOPE
          value: production
        # Keep below terminationGracePeriodSeconds to leave time for
        # the launcher to exit cleanly after the bundle drains.
        - name: GINA_SHUTDOWN_TIMEOUT
          value: "25000"
      lifecycle:
        preStop:
          exec:
            # Give the load balancer time to stop routing before SIGTERM.
            command: ["/bin/sh", "-c", "sleep 3"]
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GINA_SHUTDOWN_TIMEOUT` | `10000` | Graceful drain window in ms. Set lower than `terminationGracePeriodSeconds`. |
| `NODE_ENV` | project `def_env` | Overrides the environment used to resolve the bundle entry point and app config. |
| `NODE_SCOPE` | project `def_scope` | Overrides the scope used to resolve the bundle release path. |
