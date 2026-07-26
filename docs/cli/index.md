---
id: cli-overview
title: CLI Reference
sidebar_label: Overview
sidebar_position: 1
slug: /cli
description: Complete CLI reference for the gina command — manage projects, bundles, the framework socket server, environments, ports, and scopes from the terminal.
level: beginner
---

# CLI Reference

The `gina` CLI is the primary interface for managing projects, bundles, the framework server, environments, ports, and scopes. Commands are organised into namespaces (e.g. `bundle`, `project`, `framework`) and follow a consistent `gina <namespace>:<action>` syntax.

## Syntax

```bash
gina <namespace>:<action> [arguments] [@<project>]
```

Most commands that act on a bundle or project require the `@<project>` suffix
to identify which project the command targets.

Run `gina --help` (or `gina -h`) for the top-level command reference, and
`gina help <namespace>` for a single namespace's commands — for example
`gina help bundle`.

## Namespaces

| Namespace | What it controls |
|-----------|-----------------|
| [`bundle`](./bundle.md) | Start, stop, build, and scaffold bundles |
| [`project`](./project.md) | Register and manage projects |
| [`framework`](./framework.md) | Framework socket server, log tail, version |
| [`env`](./env.md) | Environments and environment variables |
| [`port`](./port.md) | Port assignment and reallocation |
| [`scope`](./scope.md) | Build scopes and bundle symlinks |
| [`view`](./view.md) | Scaffold HTML view templates into a bundle |
| [`controller`](./controller.md) | Scaffold a namespace controller into a bundle and print its routing rules (`controller:add`) |
| [`cache`](./cache.md) | Inspect in-memory cache stats for running bundles |
| [`protocol`](./protocol.md) | HTTP protocol and scheme configuration |
| [`service`](./service.md) | List framework-internal services (@gina-only) |
| [`connector`](./connector.md) | List, add, remove, and lint `connectors.json`; run a one-off AI inference (`connector:infer`) or probe connector readiness (`connector:test`) |
| [`image`](./image.md) | Package a bundle as a standard OCI container image (`image:build`); list, remove and run the images on the container host |
| [`container`](./container.md) | List the containers on the container host and stop them (`container:ps`, `container:stop`) |
| [`minion`](./minion.md) | List and reap a project's running bundle child-processes |
| [`secrets`](./secrets.md) | Scan required `${secret:KEY}` placeholders and check they are set — read-only, never resolves a value |
| [`i18n`](./i18n.md) | Translation-catalog coverage, seeding, and translator round-trip (PO / CSV / JSON) |
| [`audit`](./audit.md) | Verify the tamper-evidence hash chain of a bundle's audit trail (`audit:verify`) |

## Online vs offline commands

`bundle:start` is **online** — it connects to the framework socket server on
port `8124`, so the server must be running (`gina start`).

Every other command is **offline** — it executes directly in the CLI process
without a server connection. That includes commands which act on running
bundles, such as `bundle:stop` and `bundle:restart` (they signal the bundle's
own process), as well as read-only commands like `env:list` and `project:list`.

The framework socket listens on `127.0.0.1` by default — see
[Ports](../concepts/ports.md) for exposing it deliberately.

```bash
gina start          # start the framework socket server (required for online commands)
gina stop           # stop the framework socket server
gina tail           # stream live log output from all running bundles
```
