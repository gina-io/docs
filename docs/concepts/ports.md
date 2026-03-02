---
sidebar_position: 4
---

# Ports

Gina assigns ports to bundles automatically. Each bundle in a project gets a
distinct port per environment, tracked in the project registry.

The default starting port is `3100`. Additional bundles in the same project
receive the next available ports above that.

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

---

## Reset port allocation

Clears all port assignments for a project and re-scans to allocate fresh ports:

```bash
gina port:reset @myproject
```

Start allocation from a specific port number:

```bash
gina port:reset @myproject --start-port-from=4100
```

This is useful when you have a port conflict or want to shift a project's
port range without restarting the framework.

---

## Framework ports

The framework itself reserves two ports that cannot be used by bundles:

| Port | Role |
|------|------|
| 8124 | Framework socket server (online CLI commands) |
| 8125 | Message queue listener / log tail |
