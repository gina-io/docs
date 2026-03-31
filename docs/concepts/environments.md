---
title: Environments
sidebar_label: Environments
sidebar_position: 2
description: Gina separates framework environments from project environments, giving you independent control over dev/prod modes, hot-reload, and per-bundle build output.
level: intermediate
prereqs:
  - '[Projects and bundles](/concepts/projects-and-bundles)'
  - '[settings.json](/reference/settings)'
---

# Environments

Gina has two independent concepts of "environment": one for the **framework itself**, and one for your **project and bundles**. Understanding the distinction is important because the framework environment controls hot-reload and logging behaviour, while project environments control hostnames, ports, and build output for each bundle.

---

## Framework environment

The framework ships with two environments: `dev` and `prod`. The default is `prod`.

Switch the framework to `dev` mode when contributing to Gina or prototyping:

```bash
gina framework:set --env=dev
```

Set the framework log level:

```bash
gina framework:set --log-level=debug
```

---

## Project environments

A project can have multiple environments — `dev`, `prod`, `staging`, or any name you choose. Environments are defined per project and control hostname, ports, and build output.

### List environments

```bash
gina env:list
gina env:list @myproject
```

### Add or remove an environment

```bash
gina env:add staging @myproject
gina env:rm staging @myproject
```

### Set the default environment for a project

```bash
gina env:use prod @myproject
```

This sets `prod` as the default for all bundles in the project. You can still override it at runtime with `--env=<env>`.

### Start a bundle in a specific environment

```bash
gina bundle:start frontend @myproject --env=prod
```

Omitting `--env` falls back to the project's default environment.

---

## Development environment benefits

Gina treats one environment as the **development environment**. In dev mode, changes to the following directories are picked up **without restarting the bundle**:

- `/controllers`
- `/public`
- `/templates`

To designate an environment as the development environment:

```bash
gina env:link-dev <your-env-name>
```

You can only have one development environment per project.

---

## Building for non-development environments

Before starting a bundle in any non-development environment (e.g. `prod`, `staging`), you must build it first:

```bash
gina project:build prod @myproject
```

This compiles assets and prepares the release output.

---

## Region and timezone

The default timezone is `Africa/Douala`. To change it:

```bash
gina set --timezone=Africa/Johannesburg --date=yyyy/mm/dd
```

To configure region settings per bundle, edit:

```
myproject/src/<bundle>/config/settings.json
```
