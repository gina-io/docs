---
id: cli-audit
title: audit
sidebar_label: audit
sidebar_position: 19
description: CLI reference for gina audit commands — verify the tamper-evidence hash chain of a bundle's audit trail offline.
level: intermediate
prereqs:
  - '[Audit trail guide](/guides/audit-trail)'
  - '[Project](/cli/cli-project)'
---

# `gina audit`

Inspect a bundle's [audit trail](/guides/audit-trail) offline. The trail itself
is written by the running bundle (`settings.json > audit`); these commands read
it directly — no daemon and no running bundle needed.

---

## `audit:verify`

Verify the tamper-evidence hash chain of a bundle's audit trail. Every record's
`hash` is recomputed — `HMAC-SHA256` over the canonical record plus the previous
record's hash — and the **first** break is reported with its line and reason, or
the intact totals.

```bash
gina audit:verify <bundle> @<project>                             # default env's trail
gina audit:verify <bundle> @<project> --env=prod                  # a specific env
gina audit:verify <bundle> @<project> --file=/var/log/audit.jsonl # an exact file
gina audit:verify <bundle> @<project> --format=json               # machine-readable
```

```bash
gina audit:verify web @myproject
# [ audit:verify ] /srv/myproject/logs/audit-web-dev.jsonl
# OK — chain intact: 1042 chained record(s), 17 pre-chain record(s)
```

### Options

| Option | Effect |
|---|---|
| `--env=<env>` | Environment of the trail to verify (default: the project's default env). Selects the default filename `<project>/logs/audit-<bundle>-<env>.jsonl` |
| `--file=</abs/path>` | Verify this exact file instead of deriving the path from `settings.json` |
| `--format=json` | Emit a machine-readable report — `{ ok, records, unchained, breakAt, warnings, file }` |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Chain intact (any warnings are printed — read them) |
| `1` | Chain **broken** — the first break is reported with its line and reason |
| `2` | Usage or configuration error (no trail file, no signing key, bad `--env`) |

### Signing key

The key is resolved the same way as at boot, first match wins:

1. `settings.json > audit.chain.secret` — a literal, or a `${secret:VAR}`
   placeholder. `VAR` is read from the framework environment first, then from
   `process.env`, so a `GINA_`-prefixed name resolves here too. (Before `0.6.3`
   it did not: the CLI moves every `GINA_*` variable out of `process.env` before
   handlers run, and the resolver only read `process.env`.)
2. `GINA_AUDIT_SECRET`.

:::note What an intact chain proves — and what it does not
A pass means no record was edited, deleted, inserted, or reordered by anyone
**without the signing key**. It cannot see truncation at the exact tail (nothing
after it commits to it — read the record count), it verifies an empty trail
trivially, and the process that holds the key can forge a whole chain. For that
last adversary, stream the trail to write-once storage — see the
[compliance guide](/guides/compliance). A missing trail file is a configuration
error (exit `2`), never a pass.
:::

See [Audit trail → Tamper-evidence](/guides/audit-trail#tamper-evidence--the-hash-chain).
