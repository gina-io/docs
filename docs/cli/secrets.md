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

Introspect the `${secret:KEY}` placeholders your bundle configs require. These commands are **read-only**: they enumerate which secrets a bundle needs and whether they are present in the sources a bundle would resolve from, but they never resolve a placeholder, never print a secret's value, and never write anything. See [Secrets in bundle config](/guides/secrets) for the resolver itself.

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

Run the same enumeration, then cross-reference the same sources a bundle would resolve from — the environment first, then any file declared in [`settings.secrets.file`](/guides/secrets#file-backed-secrets-settingssecretsfile) — marking each required key `SET` or `UNSET`. **Exits non-zero when any required key is unset**, so it can gate a CI / pre-deploy step.

The declaration is read the same way the loader reads it: the project's `shared/config/settings.json` first, with the bundle's own `settings.json` on top, so a project-wide chain is picked up for every bundle and a bundle-level one replaces it.

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

When a bundle declares `settings.secrets.file`, the report lists the resolved chain, marks each layer `loaded` or `ABSENT`, and names the tier each key was satisfied from — so a `SET` coming from a plaintext file on the local disk is never mistaken for one your deployment injects:

```
@myproject (scope: production):
  demo:
    settings.secrets.file (assuming scope=production, env=prod):
      [1] /home/deploy/.myproject/secrets.env              loaded (2 keys)
      [2] /home/deploy/.myproject/production/secrets.env   ABSENT
      API_KEY          SET     env
      DB_PASSWORD      SET     file[1]
      STRIPE_API_KEY   UNSET
    (3 required: 2 set, 1 unset)
```

`${scope}` and `${env}` inside a declared path are set by whatever **launches** the bundle, so this process cannot read them. Both fall back to the project's defaults, and the report **names the values it assumed** — pass `--scope` / `--env` to override. `${projectVersion}` and `${projectVersionMajor}` come from the project manifest, as they do at runtime. A path whose tokens cannot be resolved is reported and its tier skipped rather than opened blindly — that can only make the gate stricter than the runtime, never laxer.

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
| `--env=<env>` | `check` | Which env's block `homedir` is read from when resolving a `settings.secrets.file` path. Defaults to the project's default env. |
| `--env-file=<path>` | `check` | Stand in for the live `process.env` with a `.env`-style file's vars — e.g. a decrypted SOPS export or a CI-exported env. It occupies the **environment tier**, which outranks the file tier, so it still wins over a declared `settings.secrets.file`. |

---

## Per-scope introspection

If your project keeps per-scope config in sibling `config_<scope>/` directories (e.g. `shared/config_production/` overriding `shared/config/`) that your deploy merges per scope, `--scope=<scope>` makes the CLI mirror that overlay **read-only** so you can audit a scope from a laptop or CI:

```bash
# which keys does the production deploy of this project require?
$ gina secrets:scan @myproject --scope=production

# decrypt the one secrets store, then verify production's
# required keys are all present in it
$ sops -d secrets.sops.env > /run/secrets.env
$ gina secrets:check @myproject --scope=production --env-file=/run/secrets.env
$ echo $?   # 0 if every required key is set, non-zero otherwise
```

`--scope` deep-merges each `config_<scope>/<name>.json` over the base `config/<name>.json` (scope wins on conflicting keys; base values the scope doesn't redefine are preserved) and reports the keys of the *effective* result. The two flags work on **separate axes**: `--scope` selects which config to inspect (and therefore which keys are required), while `--env-file` supplies the environment-tier values to check them against — a single encrypted secrets store is fine here, because scope drives config selection, not which secrets file you decrypt. The framework's runtime config loader stays scope-agnostic **about config directories** — it never reads a `config_<scope>/` sibling, so per-scope config selection remains your deploy's responsibility and this command only inspects it. (`--scope` does one further thing since the file tier shipped: it supplies the `${scope}` token when resolving a declared `settings.secrets.file` path, which the runtime takes from `NODE_SCOPE`. That token alone falls back to the project's default scope, so a scope-templated chain resolves without the flag — the `config_<scope>/` overlay above still requires it explicitly and is never applied by default.)

---

## See also

- [Secrets in bundle config](/guides/secrets) — the `${secret:KEY}` resolver, adoption steps, rotation, and at-rest encryption notes.
- [Bundle CLI](/cli/cli-bundle) — building and running the bundles whose configs these commands scan.
