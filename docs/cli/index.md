---
id: cli-overview
title: CLI Reference
sidebar_label: Overview
sidebar_position: 1
slug: /cli
description: Complete CLI reference for the gina command — manage projects, bundles, the framework socket server, environments, ports, and scopes from the terminal.
---

# CLI Reference

The `gina` CLI is the primary interface for managing projects, bundles, the framework server, environments, ports, and scopes. Commands are organised into namespaces (e.g. `bundle`, `project`, `framework`) and follow a consistent `gina <namespace>:<action>` syntax.

## Syntax

```bash
gina <namespace>:<action> [arguments] [@<project>]
```

Most commands that act on a bundle or project require the `@<project>` suffix
to identify which project the command targets.

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
| [`cache`](./cache.md) | Inspect in-memory cache stats for running bundles |
| [`protocol`](./protocol.md) | HTTP protocol and scheme configuration |

## Online vs offline commands

Commands that operate on running bundles (e.g. `bundle:start`, `bundle:stop`)
are **online** — they connect to the framework socket server on port `8124`.
The server must be running.

Commands that only read local config (e.g. `env:list`, `project:list`) are
**offline** — they execute directly without a server connection.

```bash
gina start          # start the framework socket server (required for online commands)
gina stop           # stop the framework socket server
gina tail           # stream live log output from all running bundles
```
