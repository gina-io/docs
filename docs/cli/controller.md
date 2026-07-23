---
id: cli-controller
title: controller
sidebar_label: controller
sidebar_position: 18
description: CLI reference for gina controller commands — scaffold a namespace controller into a bundle and print its routing rules, and remove one safely after a reference-aware scan.
level: beginner
prereqs:
  - '[gina CLI](/cli/)'
  - '[bundle — scaffold and run bundles](/cli/cli-bundle)'
  - '[view — scaffold HTML templates](/cli/cli-view)'
  - '[Controllers guide](/guides/controller)'
---

# `gina controller`

Scaffold and manage **namespace controllers** inside a bundle. A controller is
referenced purely by its *namespace string* — the file
`controllers/controller.<name>.js`, a `namespace` value in `routing.json`, and a
`requireController('<name>')` literal all point at the same controller by name,
never by an imported identifier.

- **`controller:add`** — scaffold a namespace controller and print the routing rules to wire it.
- **`controller:remove`** (alias **`controller:rm`**) — remove a namespace controller, but only after a reference-aware scan refuses to leave a dangling routing rule behind.

```mermaid
flowchart LR
    A["gina controller:add<br/>&lt;name&gt; &lt;bundle&gt;"] --> B["controllers/<br/>controller.&lt;name&gt;.js"]
    A --> C["templates/html/&lt;name&gt;/<br/>(view bundle)"]
    A --> D["printed routing.json rules<br/>(paste + restart)"]
```

All `controller` verbs are **bundle-scoped, same-project** — they take a bundle
name and a `@<project>` suffix — and are **offline** (they read and write local
files; the framework server does not need to be running).

---

## `controller:add` {#controlleradd}

*New in 0.5.25*

Scaffold a namespace controller into an existing bundle and **print** the
paste-ready `routing.json` rules for it. gina creates
`controllers/controller.<name>.js` with one JSDoc'd action stub per `--controls`
entry (or a single `default` action when `--controls` is omitted), and prints the
routing rules for you to paste — **it never edits `routing.json`**. Restart the
bundle after pasting the rules.

```bash
gina controller:add <name> <bundle> @<project>
gina controller:add <name> <bundle> @<project> --controls=<a,b,c>
gina controller:add <name> <bundle> @<project> --api
gina controller:add <name> <bundle> @<project> --views
```

### Example — a view bundle

`demo` is a view bundle (it has views), so gina generates `self.render()` stubs
and one template per action:

```bash
gina controller:add checkout demo @myproject --controls=start,confirm,cancel
```

```text
Creating controllers/controller.checkout.js
  + action start()      + templates/html/checkout/start.html
  + action confirm()    + templates/html/checkout/confirm.html
  + action cancel()     + templates/html/checkout/cancel.html

Add these rules to src/demo/config/routing.json:

  "checkout-start": {
    "url": "/checkout/start",
    "method": "GET",
    "namespace": "checkout",
    "param": { "control": "start", "file": "start" }
  },
  "checkout-confirm": {
    "url": "/checkout/confirm",
    "method": "GET",
    "namespace": "checkout",
    "param": { "control": "confirm", "file": "confirm" }
  },
  "checkout-cancel": {
    "url": "/checkout/cancel",
    "method": "GET",
    "namespace": "checkout",
    "param": { "control": "cancel", "file": "cancel" }
  }

Then restart the bundle.
```

The printed block drops cleanly between existing rules — the entries are
comma-separated with no trailing comma on the last one. Each view rule carries an
explicit `param.file` (equal to the action) so gina resolves
`templates/html/<name>/<action>.html` without the naming-convention warning a
defaulted `file` would trigger.

### Example — an API-only bundle

`api` is an API-only bundle (no views), so the flavor auto-detects to `api` —
`self.renderJSON()` stubs, and **no templates**. API rules omit `param.file`:

```bash
gina controller:add webhooks api @myproject --controls=ping
```

```text
Creating controllers/controller.webhooks.js
  + action ping()

Add these rules to src/api/config/routing.json:

  "webhooks-ping": {
    "url": "/webhooks/ping",
    "method": "GET",
    "namespace": "webhooks",
    "param": { "control": "ping" }
  }

Then restart the bundle.
```

### Example — the default action

Omit `--controls` and gina scaffolds a single `default` action, whose rule routes
to the namespace **root** (`/<name>`) rather than `/<name>/<action>`:

```bash
gina controller:add account api @myproject
```

```text
Creating controllers/controller.account.js
  + action default()

Add these rules to src/api/config/routing.json:

  "account-default": {
    "url": "/account",
    "method": "GET",
    "namespace": "account",
    "param": { "control": "default" }
  }

Then restart the bundle.
```

### The bundle flavor {#flavor}

The flavor is **auto-detected** from whether the bundle has views (a
`config/templates.json`, which [`view:add`](./view.md) creates):

| Flavor | Detected when | Stubs | Templates |
|--------|---------------|-------|-----------|
| `view` | the bundle has `config/templates.json` | `self.render(data)` | one per action at `templates/html/<name>/<action>.html` |
| `api` | no `config/templates.json` | `self.renderJSON(...)` | none |

Force it with `--views` or `--api` when the auto-detect is not what you want (for
example, to scaffold render stubs into a bundle you have not run
[`view:add`](./view.md) on yet).

### Flags

| Flag | Effect |
|------|--------|
| `--controls=<a,b,c>` | One JSDoc'd action stub (and, for a view bundle, one template) per entry. Omitted → a single `default` action. |
| `--views` | Force the view flavor — `render()` stubs + templates. |
| `--api` | Force the API flavor — `renderJSON()` stubs, no templates. |

### The print-only contract {#print-only}

`controller:add` **never edits `routing.json`.** It prints the rules and leaves
the wiring to you — paste the printed block into your bundle's `routing.json` and
restart the bundle. This keeps the command safe to re-run for its scaffolding
alone, and keeps your routing file (with its comments and ordering) yours to edit.

:::note Why a namespace needs a rule
A routing rule dispatches to a controller by its `namespace` value. If a rule
names a namespace whose `controller.<name>.js` does not exist, gina **warns and
silently falls back to the default `controller.js`** rather than erroring — so a
scaffolded-but-unwired controller is simply never reached. Paste the printed
rules (and restart) to wire it up.
:::

### Naming

Controller and action names are **a lowercase letter followed by letters, digits
or underscores** (for example `checkout`, `user_profile`, `ping`). No hyphens,
dots or slashes — the namespace becomes a file-name segment, a routing value and a
`${Bundle}${Namespace}Controller` class name, so it has to be a safe identifier.
The name `controller` is **reserved** (it is the default controller every
namespace controller inherits).

`controller:add` refuses, with a non-zero exit, when:

- the name fails the charset guard or is the reserved `controller`;
- a `controller.<name>.js` already exists in the bundle (remove it with
  `controller:remove`, or edit it in place — `add` never overwrites);
- an action name in `--controls` fails the charset guard;
- both `--api` and `--views` are passed.

### Exit codes

| Exit | When |
|------|------|
| `0` | The controller file (and, for a view bundle, its templates) was created and the rules printed. |
| `1` | Invalid / reserved name, an invalid `--controls` action, the bundle is not registered, the controller already exists, or both flavor flags were passed. |

---

## `controller:remove` {#controllerremove}

*New in 0.5.25*

Remove a namespace controller from a bundle — safely. A controller is referenced
only by its namespace string, and a routing rule that names a namespace with no
matching `controller.<name>.js` does **not** error: it silently falls back to the
default `controller.js` (a misdispatch). So `controller:remove` first **scans**
every reference site and **refuses** the removal while any still point at the
controller, listing each one. It **never edits `routing.json`** — repointing the
rules is left to you. When nothing references it, it confirms interactively, then
deletes the controller file and its `templates/html/<name>/` tree.

`controller:rm` is a thin alias. The default `controller.js` (namespace
`controller`) can never be removed.

```bash
gina controller:remove <name> <bundle> @<project>
gina controller:rm checkout demo @myproject
gina controller:remove <name> <bundle> @<project> --dry-run
gina controller:remove <name> <bundle> @<project> --force
```

### It refuses while references remain {#refuse-unless-clean}

```bash
gina controller:remove checkout demo @myproject
```

```text
Cannot remove controller "checkout" from demo@myproject — 2 blocking references:

  config/routing.json
    - rule "checkout-start"  ("namespace": "checkout")
    - rule "checkout-confirm"  ("namespace": "checkout")

Remove or repoint these first (a stale namespace silently falls back to
controller.js — see the docs), or re-run with --force to delete the
controller file only, leaving the references for you to clean.
```

The scan covers the four sites a controller is named at:

- the routing rule-level `"namespace": "<name>"` (which loads the controller file);
- a `"param": { "namespace": "<name>" }` (which overrides the view/template namespace);
- every `requireController('<name>')` call across the bundle's `.js` files;
- the controller file and its `templates/html/<name>/` tree (deleted with it, not a blocker).

A reference whose value cannot be resolved by a static scan — a `param.namespace`
set to a `:variable` (resolved from the URL at request time), or a
`requireController(<expression>)` with a non-literal argument — is surfaced as an
advisory note rather than silently cleared.

### When it is clean

With no blocking references, `controller:remove` prints the deletion plan and
asks for confirmation before deleting anything:

```text
Remove controller "account" from demo@myproject?
  - delete controllers/controller.account.js
Proceed? (yes|no) >
```

Answer `yes` to delete, `no` to abort. A non-interactive stdin (a pipe, no TTY)
aborts with a message pointing at `--force` (delete without a prompt) or
`--dry-run` (preview).

### Flags

| Flag | Effect |
|------|--------|
| `--dry-run` | Print the plan and any blockers; change nothing. |
| `--force` | Delete the controller file and its templates **even with blockers**, skipping the confirmation. `routing.json` is still never edited — the references left behind are listed for you to clean up. |
| `--format=json` | Machine-readable envelope instead of text. Deletes only when combined with `--force`. |

### `--dry-run`

```bash
gina controller:remove checkout demo @myproject --dry-run
```

```text
[ dry-run ] would remove controller "checkout" from demo@myproject (no changes written).
  - delete controllers/controller.checkout.js
  - delete templates/html/checkout/ (2 files)

Blocked — 2 references still point at "checkout":
  config/routing.json
    - rule "checkout-start"  ("namespace": "checkout")
    - rule "checkout-confirm"  ("namespace": "checkout")

routing.json is never edited by this command — repoint these first, or pass --force.
```

### `--force`

```bash
gina controller:remove checkout demo @myproject --force
```

```text
Force-removed controller "checkout" from demo@myproject (--force):
  - deleted controllers/controller.checkout.js
  - deleted templates/html/checkout/ (2 files)

2 references NOT touched (routing.json is never edited) — clean up manually:
  config/routing.json
    - rule "checkout-start"  ("namespace": "checkout")
    - rule "checkout-confirm"  ("namespace": "checkout")
```

### `--format=json`

```bash
gina controller:remove checkout demo @myproject --format=json
```

```json
{
  "name": "checkout",
  "bundle": "demo",
  "project": "myproject",
  "controllerFile": "controllers/controller.checkout.js",
  "templateDir": "templates/html/checkout",
  "routingRefs": [
    { "file": "config/routing.json", "rule": "checkout-start", "site": "namespace" },
    { "file": "config/routing.json", "rule": "checkout-confirm", "site": "namespace" }
  ],
  "requireRefs": [],
  "dynamicRefs": [],
  "blocking": 2,
  "removable": false,
  "dryRun": false,
  "force": false,
  "removed": false
}
```

`removable` is `true` when nothing blocks the removal; `removed` is `true` only
when the deletion actually happened (`--force`, since JSON mode is
non-interactive). Piping is safe — the payload is written synchronously.

### Exit codes

| Exit | When |
|------|------|
| `0` | The controller was removed, a dry-run / JSON report was printed, or a `--force` removal completed. |
| `1` | Invalid / reserved name, the bundle is not registered, the controller does not exist, blocking references remain (without `--force`), or a non-interactive stdin could not confirm. |

---

## `controller:help` / `controller:man`

Print the usage summary, or the group manual, for the `controller` command group:

```bash
gina controller:help
gina help controller
gina controller:man
```
