---
title: What is Gina?
sidebar_label: What is Gina?
sidebar_position: 1
description: Gina is a Node.js MVC framework with built-in HTTP/2, multi-bundle architecture, and scope-based data isolation — no Express dependency required.
---

# What is Gina?

**Gina** is a Node.js MVC and event-driven framework for building web applications and services. It ships with its own HTTP/2 server, a multi-bundle process model, scope-based data isolation, and a CLI that manages the full lifecycle of your projects — from scaffolding to deployment.

## Why Gina?

Most Node.js frameworks give you request routing and leave the rest to you. Gina gives you the full picture from day one: project structure, multi-service lifecycle, HTTP/2, and scope-based data isolation — without pulling in Express.

**Multi-bundle architecture out of the box.** Running a frontend, an API, and an admin panel as separate services is a first-class concept in Gina, not an afterthought. Each bundle gets its own process, port, and lifecycle. `gina bundle:start api @myproject` is all it takes — no Docker Compose, no custom process manager.

**HTTP/2 without configuration.** Gina's built-in server negotiates HTTP/2 (with HTTP/1.1 fallback), handles session multiplexing, and manages connection errors transparently. You don't configure any of it — it just works.

**Structure without boilerplate overhead.** Gina enforces MVC conventions (controllers, entities, `routing.json`, templates) so every project looks the same and every developer on the team knows where to look. There is no "how should we structure this?" discussion.

**Scope-based data isolation.** `local`, `beta`, and `production` are first-class data scopes, not just environment variables. Your staging environment can share a database with production without contaminating data — the framework enforces the partition at query time.

**No Express dependency.** Gina is compatible with Express middleware but does not depend on it. You are not carrying the Express security surface, the callback-first API, or the middleware assembly overhead.

> **When Gina is not the right choice:** if you need a large plugin ecosystem, TypeScript out of the box, or a framework with a large community and Stack Overflow answers for every edge case — Express, Fastify, or NestJS are safer bets today. Gina is the right choice when you want a structured, opinionated foundation that handles the infrastructure decisions so you can focus on your application.

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
