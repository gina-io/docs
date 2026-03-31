---
title: security.json
sidebar_label: security.json
sidebar_position: 8
description: Reference for security.json — configures per-bundle session expiry and remember-me duration in a Gina application without storing secrets.
level: intermediate
prereqs:
  - '[settings.json](/reference/settings)'
  - '[HTTPS guide](/guides/https)'
---

# security.json

Overrides session expiry settings on a per-bundle basis. This file holds only **non-secret** values — durations and policy flags, not keys or passwords. Use it to give different bundles different session lifetimes (for example, a short idle timeout on a dashboard and a longer-lived session on an API).

```
src/<bundle>/config/security.json
```

---

## What belongs here

`security.json` is the right place for session lifecycle settings that differ
between bundles — for example, a dashboard with a short idle timeout and an
API bundle with longer-lived tokens.

```json title="src/dashboard/config/security.json"
{
  "session": {
    "expires"  : "3h",
    "remember" : "15d"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `session.expires` | string | Session lifetime when the user does not check "remember me". Duration format: `"3h"`, `"30m"`, `"1d"` |
| `session.remember` | string | Session lifetime when "remember me" is active |

---

## What does NOT belong here

The following items are **application secrets**. They must never be committed
to version control and are not loaded by the gina framework from `security.json`.
Your application code is responsible for loading them — typically from environment
variables or a secrets manager.

| Secret | Where to keep it |
|---|---|
| JWT signing secret | Environment variable or secrets vault |
| Session signing secret | Environment variable or secrets vault |
| scrypt / bcrypt key | Environment variable or secrets vault |
| API keys (Stripe, SMTP, etc.) | Environment variable or secrets vault |
| Database passwords | `connectors.json` loaded from env vars, or a secrets vault |

:::caution
If you need a local development file that holds secrets, keep it as a dotfile
(e.g. `.secrets.json`) and add it to `.gitignore`. The gina framework skips all
dotfiles — your application code loads it explicitly and only in the right environment.
:::

---

## Environment overlay

Use `security.dev.json` to apply shorter session lifetimes during development so
stale test sessions do not stay alive overnight.

```json title="src/dashboard/config/security.dev.json"
{
  "session": {
    "expires": "15m"
  }
}
```

The base `security.json` keeps the production expiry (`"3h"`). In dev, the
overlay reduces it to 15 minutes — less waiting when testing session expiry paths.
