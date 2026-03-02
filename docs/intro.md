---
sidebar_position: 1
---

# What is Gina?

**Gina I/O** is a Node.js MVC and event-driven framework for building web applications and services.

## Philosophy

Gina was designed to be **accessible, flexible, scalable, and maintainable**. The goal is to let developers create web applications faster without sacrificing structure.

Unlike many Node.js frameworks, Gina does not rely on Connect or Express under the hood — yet it is compatible with plugins and middleware written for those frameworks.

## Key concepts

### Projects and bundles

Gina organises your code into **projects** and **bundles**.

- A **project** is a collection of bundles. Think of it as a representation of your domain (e.g. `myproject`).
- A **bundle** is a single application or service inside a project (e.g. `frontend`, `api`, `admin`).

Each bundle runs as an independent process with its own port, configuration, and lifecycle.

### Framework as a server

Gina is both a framework and a server. When you run `gina start`, you start the framework socket server that manages your bundles. Bundles are then started, stopped, and monitored via CLI commands that communicate with that server.

### Environments

Gina distinguishes between **framework environments** (`dev`, `prod`) and **project environments** (which you define per project). Each environment can have its own hostname, port range, and build output.

In the development environment, changes to controllers, templates, and public assets are picked up **without restarting the bundle**.

## Alpha status

> Gina is currently in preview/alpha. Some commands or features may not work as expected while the framework is still under active development and testing.

Windows support is in alpha — Windows users can use Docker or WSL in the meantime.

## Requirements

- Node.js **>= 16** (host tested up to Node 25)
- npm
- Unix-like OS (macOS, Linux) for full feature support

## Next steps

- [Install Gina](./getting-started/installation)
- [Create your first project](./getting-started/first-project)
- [Add a bundle and go live](./getting-started/first-bundle)
