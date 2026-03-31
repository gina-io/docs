---
title: Create Your First Project
sidebar_label: First Project
sidebar_position: 2
description: Create and register your first Gina project — start the framework socket server, scaffold a project directory, and configure the development hostname.
level: beginner
prereqs:
  - Gina installed globally (npm install -g gina)
---

# Create your first project

This page walks you through starting the Gina framework server, registering a new project, and setting up hostname configuration for local development. By the end you will have a project directory ready for adding bundles.

## Start the framework

Gina is both a framework and a server. Before doing anything, start it:

```bash
gina start
```

`gina start` is an alias for `gina framework:start`. This starts the background socket server that manages your bundles.

---

## What is a project?

A **project** is a collection of bundles (applications or services). Think of it as a representation of your domain.

For example, the project `myproject` might contain a `frontend` bundle, an `api` bundle, and an `admin` bundle — each running on its own port.

---

## Create a project

```bash
gina project:add @myproject --path=~/Sites/myproject
```

This registers the project with Gina and creates the project directory at `~/Sites/myproject`.

> On Windows, run your terminal with Administrator privileges.

### Remove a project

```bash
gina project:rm @myproject
```

This removes the project from Gina's registry. It does not delete your source files.

---

## Project directory layout

After `project:add`, your project directory looks like this:

```
myproject/
├── env.json          ← Host/port configuration per environment
├── manifest.json     ← Bundle manifest (versions, build info)
├── package.json
└── src/              ← Bundle source code lives here
```

### env.json and hostnames

Because Gina does not include a local DNS server yet, you need to update the hostname in `env.json` for your development environment.

Open `myproject/env.json` and change the `dev` hostname from the generated value (e.g. `frontend-dev-local-v1.myproject.app`) to `localhost`:

```json
{
  "dev": {
    "frontend": {
      "hostname": "localhost"
    }
  }
}
```

This is a temporary workaround until Gina ships its own local DNS server.

---

## Next step

[Add a bundle and go live →](./first-bundle)
