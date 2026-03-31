---
title: Troubleshooting
sidebar_label: Troubleshooting
sidebar_position: 8
description: Solutions for common Gina issues — resetting settings, fixing bundle start failures, resolving port conflicts, and troubleshooting HTTPS certificate errors.
level: intermediate
prereqs:
  - Controllers
  - gina CLI
  - Framework logs
---

# Troubleshooting

This page covers the most common issues encountered when developing with Gina, including broken settings, bundles that will not start, port conflicts, and certificate errors. Each section includes the recommended fix so you can get back to working quickly.

---

## My settings are broken / I need a fresh start

Reset all Gina preferences to defaults without touching your project source files:

```bash
npm install -g gina@latest --reset
```

This recreates `~/.gina` with factory defaults (settings.json, projects.json, env.json, locals.json).

---

## I can't start my bundle

### First start

**Windows:** Make sure you are running your terminal with Administrator privileges.

**Cloned from GitHub:** Run the install scripts manually:

```bash
node node_modules/gina/script/pre_install.js -g
node node_modules/gina/script/post_install.js -g
```

### After a crash

A stale process may be left running. Find and kill it:

**macOS / Linux:**

```bash
ps aux | grep gina
kill <pid>
```

**Windows:** Look for `node.exe` or `Event I/O Handler` in Task Manager and end the process.

Then try starting the bundle again.

---

## Port conflict

If Gina reports a port already in use, reset port allocation for the project:

```bash
gina port:reset @myproject --start-from=3100
```

---

## Certificate errors on HTTPS

See [HTTPS and HTTP/2 → Local development](./https#local-development--fixing-certificate-errors) for step-by-step instructions on generating a chained certificate for local use.

---

## Need help?

Open an issue on GitHub: [github.com/Rhinostone/gina/issues](https://github.com/Rhinostone/gina/issues)
