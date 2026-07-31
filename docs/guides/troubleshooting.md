---
title: Troubleshooting
sidebar_label: Troubleshooting
sidebar_position: 99
description: Solutions for common Gina issues — resetting settings, fixing bundle start failures, resolving port conflicts, and troubleshooting HTTPS certificate errors.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[gina CLI](/cli/)'
  - '[Framework logs](/guides/logging)'
---

# Troubleshooting

This page covers the most common issues encountered when developing with Gina, including broken settings, bundles that will not start, port conflicts, and certificate errors. Each section includes the recommended fix so you can get back to working quickly.

---

## My settings are broken / I need a fresh start

Reset all Gina preferences to defaults without touching your project source files:

```bash
gina reset
```

This clears `~/.gina`; the next Gina command recreates it with factory defaults (settings.json, projects.json, env.json, locals.json).

On npm ≤ 11 you can also reset as part of a reinstall with `npm install -g gina@latest --reset`. npm 12 rejects the `--reset` flag outright — use `gina reset`, and add `--allow-scripts=gina` to any npm 12 reinstall so the post-install can bootstrap.

---

## I can't start my bundle

### First start

**Windows:** Make sure you are running your terminal with Administrator privileges.

**Cloned from GitHub:** Run the install scripts manually:

```bash
node node_modules/gina/script/pre_install.js -g
node node_modules/gina/script/post_install.js -g
```

### The bundle refuses to start and names `env.json`

```
[ myBundle ][ prod ] no configuration block for this bundle/env in
/path/to/project/env.json (file NOT FOUND) — every bundle must be declared
there for the env it starts in; refusing to start
```

Every bundle needs a block in the project's `env.json` for the environment it
starts in. Gina refuses to boot without one rather than starting on guessed
host and port values. The parenthesis tells you which of the two cases you are
in:

| Message | Cause | Fix |
|---|---|---|
| `file NOT FOUND` | The project has no `env.json` at all | Restore it, or scaffold a fresh project and copy its `env.json` shape |
| ``the file declares no `<bundle>.<env>` block`` | `env.json` exists but has no entry for this bundle and environment | Add the missing `"<bundle>": { "<env>": { … } }` block |

The second case also covers an `env.json` that only declares *other* bundles —
the message always names the bundle that was being **started**, not the ones it
found. The process exits `1`, so a container restart policy or orchestrator
liveness check retries automatically while a release tree finishes deploying.

*(A clearer refusal since `0.6.2`. Earlier versions crashed here with an opaque
`Cannot read properties of undefined` error that named neither the file nor the
bundle.)*

:::note
Deleting `env.json` does not make it stay deleted — the next `gina` command of
any kind recreates it as an empty `{}` and warns `Project env.json not found.
Trying to fix it ...`. A boot then reports the *second* case above (the file
declares no block), not `file NOT FOUND`. Nothing about `env.json` is copied
into the built release tree, so the project file is read fresh on every boot.
:::

One shape is still opaque: a bundle declared in `env.json` but **not for the
environment you are starting** fails earlier, with `Cannot set properties of
undefined (setting 'bundlesPath')`, rather than the refusal above. The remedy is
the same — add the missing `"<env>"` block for that bundle.

### The certificate path contains a literal `${host}`

```
ENOENT: no such file or directory, open
'/home/you/.gina/certificates/scopes/local/${host}/private.key'
```

An https or HTTP/2 bundle stops with a "secured server without sufficient
credentials" error, and the path it names still contains `${host}` verbatim. The
unsubstituted token is the tell: the bundle's block in the project `env.json`
does not declare `host`, and that block is the only place a project supplies it.
The error points at your server settings, but the credentials are fine — the
host is what is missing.

Add it to the block for the environment you are starting:

```json
{
  "myBundle": {
    "prod": {
      "host": "localhost"
    }
  }
}
```

Since `0.6.2` the framework carries `localhost` as a default, so a block that
sets only a subset of keys — say just `server.cache` — resolves on its own, and
an omitted declaration is reported instead of applied silently:

```
[CONFIG][myBundle][prod] no `host` declared in the project env.json — defaulting to `localhost`
```

Declare `host` explicitly for any bundle not reached on `localhost`: it is the
value substituted into every `${host}` token, including the TLS credentials
paths above.

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
gina port:reset @myproject --start-port-from=3100
```

---

## Certificate errors on HTTPS

See [HTTPS and HTTP/2 → Local development](./https#local-development--fixing-certificate-errors) for step-by-step instructions on generating a chained certificate for local use.

---

## Need help?

Open an issue on GitHub: [github.com/gina-io/gina/issues](https://github.com/gina-io/gina/issues)
