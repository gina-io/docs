---
title: Ports
sidebar_label: Ports
sidebar_position: 4
description: How Gina allocates and manages ports for bundles — automatic assignment from port 3100, manual overrides, and the reserved framework infrastructure range 4100–4199.
level: intermediate
prereqs:
  - '[Projects and bundles](/concepts/projects-and-bundles)'
  - '[gina CLI](/cli/)'
---

# Ports

Gina assigns ports to bundles automatically. Each bundle in a project gets a
distinct port per environment, tracked in the project registry.

The default starting port for bundles is `3100`. Additional bundles in the same
project receive the next available ports above that.

---

## List ports

```bash
gina port:list frontend @myproject
```

List ports for a specific environment:

```bash
gina port:list frontend @myproject/prod
```

---

## Set a port manually

Set or update the port for a bundle interactively (you will be prompted for
port number, protocol, and environment):

```bash
gina port:set frontend @myproject
```

Set a specific port non-interactively:

```bash
gina port:set http:3200 frontend @myproject/dev
```

The `<protocol>:<port>` prefix accepts `http` or `https`.

The `<protocol>:<port>` prefix uses full protocol names like `http/1.1` or `http/2.0`.
You can also use flag syntax: `--protocol=http/1.1 --scheme=http --port=3200 --env=dev`.

---

## Scan window and exhaustion

The port scanner searches a window of **900 ports** starting from `opt.start`
(default `3100`), giving a default working range of **3100–3999**. If every port
in that window is in use the scanner stops with:

```
[SCAN] Maximum port number reached: 3999
```

When this happens, reset the project's port allocation from a higher base:

```bash
gina port:reset @myproject --start-port-from=4200
```

Use `4200` or higher — ports `4100–4199` are reserved and the scanner skips
them automatically (see [Reserved ports](#reserved-ports) below).

---

## Reset port allocation

Clears all port assignments for a project and re-scans to allocate fresh ports:

```bash
gina port:reset @myproject
```

Start allocation from a specific port number:

```bash
gina port:reset @myproject --start-port-from=3200
```

This is useful when you have a port conflict or want to shift a project's
port range without restarting the framework.

---

## Reserved ports

Two categories of ports are reserved and cannot be assigned to bundles.

### Framework socket ports

| Port | Role |
|------|------|
| 8124 | Framework socket server (online CLI commands) |
| 8125 | Message queue listener / log tail |

### Gina infrastructure range — 4100–4199

Ports `4100–4199` are reserved for Gina internal services. The port scanner
skips this range automatically when allocating bundle ports.

| Port | Role |
|------|------|
| 4100 | Socket server (gina daemon) |
| 4101 | Beemaster dev inspector |
| 4102 | engine.io internal transport |
| 4103–4199 | Reserved for future Gina services |
