---
title: Installation
sidebar_label: Installation
sidebar_position: 1
description: Install the Gina Node.js MVC framework globally via npm — with a custom prefix, a classical global install, or a local per-project setup.
level: beginner
prereqs:
  - '[Node.js 18 or later](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs)'
  - '[npm or yarn](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)'
---

# Installation

Gina is distributed via npm. Because it acts as both a framework and a deployment environment, it is recommended to install it **globally**. A global install gives you the `gina` CLI, which manages projects, bundles, ports, and the framework socket server from any directory on your machine.

## Method 1 — Custom prefix (recommended)

This installs Gina in your home directory, avoiding the need for `sudo` or root access.

```bash
npm install -g gina@latest --prefix=~/.npm-global
```

Add `~/.npm-global/bin` to your `PATH` if it is not already there:

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
```

Add that line to your shell profile (`.zshrc`, `.bashrc`, etc.) to make it permanent.

### Verify the installation

```bash
gina version
```

`gina version` is a shortcut for `gina framework:version`.

---

## Method 2 — Classical global install

```bash
npm install -g gina@latest
```

If you encounter a permission error like `EACCES: permission denied, mkdir '/usr/local/lib/node_modules/gina'`, fix permissions first:

```bash
sudo chown -R $USER $(npm config get prefix --quiet)/lib/node_modules
```

Or install with `--unsafe-perm` (not recommended for production):

```bash
npm install -g --unsafe-perm gina@latest
```

> **Linux & macOS**: the use of `sudo npm install` is discouraged. Prefer Method 1 or fix permissions as shown above.

---

## Method 3 — Local install (single-project use)

If you only need Gina for a single project and do not want a global install:

```bash
npm install gina@latest
```

With this method, run the CLI using `./gina` from your project root instead of `gina`.

---

## npm tags

| Tag | Description |
|-----|-------------|
| `alpha` | Preview release — not recommended for production |
| `latest` | Latest stable release |

---

## Factory reset

If your preferences are broken or you want a clean slate:

```bash
npm install -g gina@latest --reset
```

This resets `~/.gina` preferences (settings, project registry, env config). Your project source files are not touched.

---

## Uninstalling

**Without prefix:**

```bash
npm uninstall -g gina
```

**With prefix (if installed with `--prefix=~/.npm-global`):**

```bash
npm uninstall -g gina --prefix=~/.npm-global
```
