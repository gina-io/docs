---
id: cli-secrets
title: secrets
sidebar_label: secrets
sidebar_position: 13
description: CLI reference for gina secrets commands — scan a bundle's required ${secret:KEY} placeholders and check whether they are set in the environment. Read-only introspection; the commands never resolve or expose a secret value.
level: intermediate
prereqs:
  - '[Secrets in bundle config](/guides/secrets)'
  - '[Projects and bundles](/concepts/projects-and-bundles)'
---

# `gina secrets`

Introspect the `${secret:KEY}` placeholders your bundle configs require. These commands are **read-only**: they enumerate which secrets a bundle needs and whether they are present in the environment, but they never resolve a placeholder, never read a secret's value, and never write anything. See [Secrets in bundle config](/guides/secrets) for the resolver itself.

Both commands walk each bundle's `<src>/config/*.json` plus the project's `shared/config/*.json` — the same files the framework merges at bundle start — and report only **bare** placeholders (a mixed-content string like `"https://${secret:HOST}/v1"` is not a placeholder and is not reported, mirroring what the resolver substitutes).

---

## `secrets:scan`

Report the `${secret:KEY}` placeholders each bundle requires, grouped by the config file that declares each key.

```bash
gina secrets:scan                      # every registered project
gina secrets:scan @<project>           # all bundles in a project
gina secrets:scan <bundle> @<project>  # one bundle
gina secrets:scan @<project> --format=json
```

This is an **offline** command — it does not require the framework server.

Example:

```bash
$ gina secrets:scan @myproject

@myproject:
  demo:
    Required secrets (3):
      API_KEY          <-  src/demo/config/settings.json
      DB_PASSWORD      <-  src/demo/config/connectors.json
      STRIPE_API_KEY   <-  shared/config/app.json
```

---

## `secrets:check`

Run the same enumeration, then cross-reference the current environment, marking each required key `SET` or `UNSET`. **Exits non-zero when any required key is unset**, so it can gate a CI / pre-deploy step.

```bash
gina secrets:check                      # every registered project
gina secrets:check @<project>           # all bundles in a project
gina secrets:check <bundle> @<project>  # one bundle
gina secrets:check @<project> --format=json
```

This is an **offline** command — it does not require the framework server.

Example:

```bash
$ export DB_PASSWORD=... API_KEY=...   # STRIPE_API_KEY left unset on purpose
$ gina secrets:check @myproject

@myproject:
  demo:
      API_KEY          SET
      DB_PASSWORD      SET
      STRIPE_API_KEY   UNSET
    (3 required: 2 set, 1 unset)

$ echo $?
1
```

A key counts as `SET` only when it is a **non-empty string** — the same condition under which the resolver succeeds. So an `UNSET` is precisely a key that would throw `Secret resolution failed` at bundle start.

`check` validates the environment of the **CLI process you run it in** (a CI runner that exported the secrets, or a shell that sourced the same env file). It cannot introspect the environment of an already-running, detached bundle.

---

## `secrets:help`

Print the secrets command group help.

```bash
gina secrets:help
```

---

## Options

| Option | Commands | Description |
| ------ | -------- | ----------- |
| `--format=<text\|json>` | `scan`, `check` | Output format. Default `text`. JSON is machine-readable for tooling; `check`'s exit code still reflects unset keys. |
| `--scope=<scope>` | `scan`, `check` | Report the *effective* secrets for a deployment scope: the sibling `config_<scope>/` dirs are read-only overlaid on the base config (deep-merge, scope wins). The scope must be registered (`gina scope:list`). The runtime config loader is unaffected — this is introspection only. |
| `--env-file=<path>` | `check` | Validate required keys against a `.env`-style file's vars instead of the live `process.env` — e.g. a decrypted SOPS export or a CI-exported env. |

---

## Per-scope introspection

If your project keeps per-scope config in sibling `config_<scope>/` directories (e.g. `shared/config_production/` overriding `shared/config/`) that your deploy merges per scope, `--scope=<scope>` makes the CLI mirror that overlay **read-only** so you can audit a scope from a laptop or CI:

```bash
# what secrets will the production deploy of this project need?
$ gina secrets:scan @myproject --scope=production

# are they all present in the decrypted production env?
$ sops -d secrets.prod.env > /run/secrets.env
$ gina secrets:check @myproject --scope=production --env-file=/run/secrets.env
$ echo $?   # 0 if every required key is set, non-zero otherwise
```

`--scope` deep-merges each `config_<scope>/<name>.json` over the base `config/<name>.json` (scope wins on conflicting keys; base values the scope doesn't redefine are preserved) and reports the keys of the *effective* result. The framework's runtime config loader stays scope-agnostic — per-scope config selection remains your deploy's responsibility; this command only inspects it.

---

## See also

- [Secrets in bundle config](/guides/secrets) — the `${secret:KEY}` resolver, adoption steps, rotation, and at-rest encryption notes.
- [Bundle CLI](/cli/cli-bundle) — building and running the bundles whose configs these commands scan.
