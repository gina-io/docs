---
sidebar_position: 5
---

# Architecture

This page describes how a Gina application is structured and how its parts
fit together at runtime.

---

## Projects and bundles

Gina organises code into **projects** and **bundles**.

- A **project** is a collection of bundles. It maps one-to-one to a domain or
  product (e.g. `myproject`).
- A **bundle** is a single application or service inside a project. Each bundle
  runs as an independent Node.js process with its own port, config, and lifecycle.

```mermaid
graph TD
    P["myproject"] --> B1["frontend bundle"]
    P --> B2["api bundle"]
    P --> B3["admin bundle"]
    B1 --> N1["Node.js process<br/>port 3100"]
    B2 --> N2["Node.js process<br/>port 3101"]
    B3 --> N3["Node.js process<br/>port 3102"]
```

See [Projects and bundles](./projects-and-bundles) for the full reference.

---

## The framework socket server

When you run `gina start`, Gina starts a background socket server on port `8124`.
All online CLI commands (like `bundle:start` and `bundle:stop`) communicate with
this server over a TCP socket rather than spawning a new process for each command.

An offline command like `env:list` runs directly, without connecting to the server.

```mermaid
flowchart TD
    A["gina bundle:start frontend @myproject"] --> B["bin/gina"]
    B --> C{"online command?"}
    C -->|"bundle:*, project:*, framework:*"| D["bin/cli<br/>detached daemon"]
    C -->|"env:list, project:list ..."| E["bin/cli<br/>direct execution"]
    D --> F["TCP socket<br/>port 8124"]
    F --> G["bin/cmd<br/>dispatcher"]
    G --> H["lib/cmd/ handler"]
    H --> OUT["result → stdout"]
    E --> OUT
```

---

## Bundle lifecycle

Each bundle starts as a child Node.js process. Its entry point is
`src/<bundle>/index.js`, which bootstraps the Gina core, loads configuration,
and starts listening on its assigned port.

In the development environment, changes to the following directories are applied
**without restarting the bundle**:

- `controllers/`
- `public/` (static assets)
- `templates/`

```mermaid
stateDiagram-v2
    [*] --> Stopped
    Stopped --> Running : bundle start
    Running --> Stopped : bundle stop / process exit
    Running --> Running : hot reload (controllers · templates · assets)
    Running --> Crashed : unhandled exception
    Crashed --> Stopped : process exit
```

---

## HTTP request lifecycle

Routes are declared in `src/<bundle>/config/routing.json` — they are not
registered in code.

```mermaid
flowchart TD
    REQ["HTTP request"] --> ROUTER["core/router.js<br/>match URL against routing.json"]
    ROUTER --> CTRL["core/controller.js<br/>session · auth · request data"]
    CTRL --> ACTION["Controller action<br/>this.home = function(req, res, next)"]
    ACTION --> HTML["self.render(data)<br/>HTML via Swig template"]
    ACTION --> JSON["self.renderJSON(data)<br/>JSON response"]
    ACTION --> REDIR["self.redirect(url)<br/>HTTP redirect"]
    ACTION --> ERR["self.throwError(...)<br/>4xx / 5xx error"]
```

---

## MVC structure

| Layer | Location | Role |
|-------|----------|------|
| Model | `src/<bundle>/models/` | Data access and business logic |
| View | `src/<bundle>/templates/` | HTML templates (Swig by default) |
| Controller | `src/<bundle>/controllers/` | Request handling and rendering |

```mermaid
flowchart LR
    REQ["HTTP request"] --> C["Controller<br/>controllers/"]
    C -->|"query data"| M["Model<br/>models/"]
    M -->|"read / write"| DB[("Data source")]
    DB --> M
    M -->|"result"| C
    C -->|"render"| V["View<br/>templates/"]
    V --> HTML["HTML response"]
    C --> JSONR["JSON response"]
```

---

## Configuration files

| File | Purpose |
|------|---------|
| `env.json` | Host and port configuration per environment |
| `manifest.json` | Bundle manifest — versions and build info |
| `config/app.json` | Application metadata (name, version) |
| `config/routing.json` | URL routing rules |
| `config/settings.json` | Bundle settings (region, timezone, locales) |
| `config/settings.server.json` | Server options (port, protocol, HTTP/2) |
| `config/statics.json` | Static file serving rules |

---

## Global context

Gina injects a set of helpers into every module at startup — no `require()` needed:

| Helper | Purpose |
|--------|---------|
| `_(path)` | Construct a path object |
| `requireJSON(path)` | Load and cache a JSON file |
| `getEnvVar(key)` | Read an environment variable |
| `setEnvVar(key, val)` | Write an environment variable |
| `getContext(key)` | Read a global context value |
| `setContext(key, value)` | Write a global context value |

---

## Ports

| Port | Role |
|------|------|
| 8124 | Framework socket server |
| 8125 | Message queue / log tail listener |
| 3100+ | Bundle HTTP ports (auto-assigned per project) |

See [Ports](./ports) for the full port management reference.
