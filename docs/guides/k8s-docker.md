---
sidebar_position: 7
---

# K8s and Docker

Running a Gina bundle inside a Docker container or a Kubernetes pod requires a
different launch strategy than a typical workstation setup. Two dedicated
binaries replace the usual `gina bundle:start` + `gina tail` pair:

| Binary | Role |
|---|---|
| `gina-init` | Generates the `~/.gina/` state the framework needs, from env vars or a config file. Run once before the bundle starts. |
| `gina-container` | Starts one bundle as a foreground process, forwards signals, exits with the bundle's exit code. |

---

## Why `gina bundle:start` does not work in containers

On a workstation, the normal launch sequence is:

```bash
gina start
gina bundle:start api @myproject
gina tail
```

`gina bundle:start` spawns the bundle as a **detached** background process.
`gina tail` then keeps the terminal busy.

In a container this creates a signal propagation gap:

- Docker and K8s send `SIGTERM` to the **foreground process** (`gina tail`).
- The bundle is detached — it never receives `SIGTERM`.
- K8s waits for `terminationGracePeriodSeconds`, then sends `SIGKILL`.
- The bundle is killed abruptly, dropping in-flight requests.

---

## `gina-init` — bootstrap `~/.gina/` without the CLI ceremony

On a workstation, `~/.gina/` is populated by running a sequence of gina CLI
commands (`project:add`, `port:reset`, etc.) that require the framework socket
server to be running. This ceremony is impractical in containers.

`gina-init` replaces it with a single command that writes the 4 files the
framework boot sequence requires:

| File | Purpose |
|---|---|
| `~/.gina/projects.json` | Project metadata (paths, envs, scopes, protocols) |
| `~/.gina/ports.json` | Port → `bundle@project/env` mapping |
| `~/.gina/ports.reverse.json` | `bundle@project` → env → protocol → scheme → port |
| `~/.gina/${version}/settings.json` | Framework runtime settings (dirs, log level, …) |

No framework socket server is needed. `gina-init` is idempotent — safe to run
on every container start.

### Input

`gina-init` reads env vars. A JSON config file can be provided via
`--config=<path>` or `GINA_INIT_CONFIG`. **Env vars always take priority over
the config file.**

#### Required

| Variable | Description |
|---|---|
| `GINA_PROJECT_NAME` | Project name (must match what `gina-container` uses) |
| `GINA_BUNDLES` | Comma-separated list of bundle names |

#### Optional

| Variable | Default | Description |
|---|---|---|
| `GINA_PROJECT_PATH` | `/app` | Project source root inside the container |
| `GINA_PROJECT_HOME` | `HOME/.<project>` | Project homedir (for bundles, releases, logs) |
| `GINA_ENVS` | `dev,prod` | All supported environments |
| `GINA_DEF_ENV` | `dev` | Default environment |
| `GINA_DEV_ENV` | same as `GINA_DEF_ENV` | Alias used to detect dev mode |
| `GINA_SCOPES` | `local,production` | All supported scopes |
| `GINA_DEF_SCOPE` | `local` | Default scope |
| `GINA_PROTOCOLS` | `http/1.1,http/2.0` | Supported protocols |
| `GINA_DEF_PROTOCOL` | `http/2.0` | Default protocol |
| `GINA_SCHEMES` | `http,https` | Supported schemes |
| `GINA_DEF_SCHEME` | `https` | Default scheme |
| `GINA_PORT_START` | `3100` | First port to allocate |
| `GINA_RUNDIR` | `~/.gina/run` | PID/lock file directory |
| `GINA_LOGDIR` | `~/.gina/log` | Log directory |
| `GINA_TMPDIR` | system tmpdir | Temporary file directory |
| `GINA_LOG_LEVEL` | `info` | Log level (`trace` `debug` `info` `warn` `error` `fatal`) |
| `GINA_TIMEZONE` | `TZ` env or `UTC` | Timezone |
| `GINA_HOMEDIR` | `HOME/.gina` | Overrides the `~/.gina/` root directory |
| `GINA_INIT_CONFIG` | — | Path to a JSON config file (env vars override) |

#### JSON config file

Instead of individual env vars, you can mount a JSON config file:

```json
{
    "project_name": "myproject",
    "bundles": ["api", "web"],
    "path": "/app",
    "envs": ["dev", "prod"],
    "def_env": "prod",
    "def_protocol": "http/2.0",
    "def_scheme": "https",
    "port_start": 3100,
    "log_level": "info",
    "timezone": "UTC"
}
```

```bash
gina-init --config=/etc/gina/init.json
# or
GINA_INIT_CONFIG=/etc/gina/init.json gina-init
```

### Port allocation

`gina-init` allocates one port per `(bundle, env)` pair for each active
`(protocol, scheme)` combination, starting from `GINA_PORT_START`.
`http/2.0 + http` (h2c) is always skipped — it is not used in practice.

With 3 bundles, 2 envs, and the default protocols/schemes this allocates
**18 ports**: 6 for `http/1.1+http`, 6 for `http/1.1+https`, 6 for `http/2.0+https`.

---

## `gina-container` — foreground bundle launcher

`gina-container` starts a single bundle as a **non-detached foreground child
process** and owns the full shutdown lifecycle:

1. K8s sends `SIGTERM` to the launcher (PID 1 or a direct init child).
2. The launcher forwards `SIGTERM` to the bundle.
3. The bundle drains in-flight requests (`GINA_SHUTDOWN_TIMEOUT`), then exits
   with code 143.
4. The launcher exits with the same code.

```bash
gina-container <bundle> @<project>
```

| Variable | Default | Description |
|---|---|---|
| `GINA_SHUTDOWN_TIMEOUT` | `10000` | Graceful drain window in ms. Keep below `terminationGracePeriodSeconds`. |
| `NODE_ENV` | project `def_env` | Overrides the runtime environment. |
| `NODE_SCOPE` | project `def_scope` | Overrides the runtime scope. |

---

## Dockerfile — bootstrap at build time

The simplest pattern bakes `~/.gina/` into the image during `docker build`.
This works well when the bundle, env, and port config are fixed per image.

```dockerfile
FROM node:22-slim

# Install gina globally
RUN npm install -g gina

# Copy project sources
COPY . /app
WORKDIR /app

# Bootstrap ~/.gina/ — runs once at build time, no socket server required.
# Port 3100 maps to api@myproject/dev (GINA_DEF_ENV=dev).
# Pass GINA_DEF_ENV=prod here if you build a separate production image.
ENV GINA_PROJECT_NAME=myproject \
    GINA_BUNDLES=api \
    GINA_PROJECT_PATH=/app \
    GINA_DEF_PROTOCOL=http/2.0 \
    GINA_DEF_SCHEME=https \
    GINA_PORT_START=3100

RUN gina-init

EXPOSE 3100

CMD ["gina-container", "api", "@myproject"]
```

---

## Dockerfile — bootstrap at runtime

If the port or env must be determined at container start (e.g. a single image
used for both `dev` and `prod` with different K8s env vars), run `gina-init`
in the entrypoint instead:

```dockerfile
FROM node:22-slim

RUN npm install -g gina

COPY . /app
WORKDIR /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["api", "@myproject"]
```

`entrypoint.sh`:

```bash
#!/bin/sh
set -e

BUNDLE="$1"
PROJECT="$2"

# Bootstrap ~/.gina/ from env vars set by the K8s Pod spec or docker run.
# GINA_PROJECT_NAME, GINA_BUNDLES, GINA_DEF_ENV, etc. must be in the environment.
gina-init

exec gina-container "$BUNDLE" "$PROJECT"
```

---

## Kubernetes

### Pod spec

```yaml
apiVersion: v1
kind: Pod
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: api
      image: myregistry/myproject-api:latest
      ports:
        - containerPort: 3100
      env:
        # gina-init — bootstrap
        - name: GINA_PROJECT_NAME
          value: myproject
        - name: GINA_BUNDLES
          value: api,web
        - name: GINA_PROJECT_PATH
          value: /app
        - name: GINA_DEF_PROTOCOL
          value: http/2.0
        - name: GINA_DEF_SCHEME
          value: https
        - name: GINA_PORT_START
          value: "3100"
        - name: GINA_LOG_LEVEL
          value: info
        # gina-container — runtime
        - name: NODE_ENV
          value: prod
        - name: NODE_SCOPE
          value: production
        # Keep below terminationGracePeriodSeconds to leave time for the
        # launcher to exit cleanly after the bundle finishes draining.
        - name: GINA_SHUTDOWN_TIMEOUT
          value: "25000"
      lifecycle:
        preStop:
          exec:
            # Give the load balancer time to stop routing before SIGTERM.
            command: ["/bin/sh", "-c", "sleep 3"]
```

### Deployment with ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myproject-gina-config
data:
  GINA_PROJECT_NAME: myproject
  GINA_BUNDLES: api
  GINA_PROJECT_PATH: /app
  GINA_DEF_PROTOCOL: http/2.0
  GINA_DEF_SCHEME: https
  GINA_PORT_START: "3100"
  GINA_LOG_LEVEL: info
  NODE_ENV: prod
  NODE_SCOPE: production
  GINA_SHUTDOWN_TIMEOUT: "25000"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myproject-api
spec:
  replicas: 3
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: myregistry/myproject-api:latest
          envFrom:
            - configMapRef:
                name: myproject-gina-config
          ports:
            - containerPort: 3100
```

---

## Stdout logging

In containers, coloured multi-line log output is not useful — log collectors
expect one JSON line per event. Set `GINA_LOG_STDOUT=true` to activate
stdout-only mode:

```yaml
env:
  - name: GINA_LOG_STDOUT
    value: "true"
```

Each log line is emitted as:

```json
{"ts":"2026-03-21T14:23:01.123Z","level":"info","group":"coreapi","msg":"Server started on port 3128"}
```

Compatible with `kubectl logs`, Fluentd, Datadog, and any other log collector
that reads container stdout.

---

## SSL certificates

SSL certificates are project-level state, not `~/.gina/` state. They are
referenced in each bundle's `settings.server.json` via `${GINA_HOMEDIR}` paths:

```json
{
  "credentials": {
    "privateKey":  "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/private.key",
    "certificate": "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/certificate.crt",
    "ca":          "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/ca_bundle.crt"
  }
}
```

`GINA_HOMEDIR` expands from `HOME` at runtime. Mount your certificates as a
K8s Secret into the container at the expected path:

```yaml
volumeMounts:
  - name: tls
    mountPath: /home/node/.myproject/certificates/scopes/production/api.myproject.app
    readOnly: true
volumes:
  - name: tls
    secret:
      secretName: myproject-api-tls
```
