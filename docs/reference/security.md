---
title: security.json
sidebar_label: security.json
sidebar_position: 8
description: Reference for security.json — declares per-bundle login session and remember-me cookie lifetimes in a Gina application, without storing secrets.
level: intermediate
prereqs:
  - '[settings.json](/reference/settings)'
  - '[Sessions guide](/guides/sessions)'
  - '[HTTPS guide](/guides/https)'
---

# security.json

Declares how long a login lasts, per bundle. This file holds only **non-secret**
values — durations and policy flags, never keys or passwords. Use it to give
different bundles different session lifetimes: a short one on a dashboard, a
longer one on an API.

```
src/<bundle>/config/security.json
```

The file belongs to your application. Gina reads the two keys documented below
and carries everything else through untouched, so you are free to keep your own
conventions alongside them.

:::info New in 0.6.32
`session.expires` and `session.remember` were documented before 0.6.32 but
interpreted by nothing — applications applied them themselves. From 0.6.32 the
framework applies them at `req.login()`. If one of those keys already holds a
value in some other shape, read [Values that are not
durations](#values-that-are-not-durations) before upgrading.
:::

---

## Session lifetimes

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
| `session.expires` | duration string | Cookie lifetime applied at `req.login()` for an ordinary login. Omit it to leave the cookie exactly as your session factory made it. |
| `session.remember` | duration string | Cookie lifetime applied at `req.login()` when the login is remembered. Falls back to `expires` when omitted. |

Both keys are optional. A bundle that declares neither behaves exactly as it did
before — the framework does no work for it at all.

### Duration format

A duration is a number with a **required** unit: `ms`, `s`, `m`, `h` or `d`
(case-insensitive). `"15m"`, `"3h"`, `"15d"`, `"500ms"`. Parsed by the
framework's one duration parser, `lib.duration.parse()`, which is the same
dialect the storage interval keys use.

The unit is required on purpose. A bare `"15"` is refused rather than guessed,
because fifteen seconds and fifteen days are both plausible readings of the
same number and a silently-assumed unit is exactly the misconfiguration a
duration format exists to prevent.

:::caution Not the same parser as `queryTimeout`
The global `gina.parseTimeout()` helper — used by routing's `queryTimeout` — is
deliberately more permissive: it also accepts a bare number of milliseconds, and
it does **not** accept `d`. It is not the parser behind these two keys. Write
`"15d"` here and it works; passing `"15d"` to `parseTimeout()` returns `null`.
:::

---

## Which lifetime applies

A login is **remembered** when either of these is true:

1. The caller says so explicitly:

   ```js
   req.login(user, { remember: true }, function (err) { /* … */ });
   ```

2. The login request carries a truthy `remember` field — `on`, `1`, `true` or
   `yes`, trimmed and case-insensitive. `on` is what an ordinary HTML checkbox
   sends:

   ```html
   <input type="checkbox" name="remember"> Remember me
   ```

   The field is read from the framework's normalised payload, so a urlencoded
   form, a JSON body and a multipart form all work the same way.

An explicit option **always wins over the request field**, in both directions.
A server that decides for itself cannot be overridden by the client.

| Declared | Ordinary login | Remembered login |
|---|---|---|
| `expires` + `remember` | `expires` | `remember` |
| `expires` only | `expires` | `expires` |
| `remember` only | *cookie untouched* | `remember` |
| neither | *cookie untouched* | *cookie untouched* |

An ordinary login never borrows the longer remembered lifetime.

---

## What still wins over it

The framework sets one field — the cookie's `maxAge` — and nothing else. Three
things continue to govern a session independently:

- **Your own assignment.** `req.session.cookie.maxAge` set inside your login
  callback runs *after* the framework's and overrides it. See
  ["Remember me"](/guides/sessions#remember-me).
- **`absoluteTimeout`.** A thirty-day remembered cookie under an eight-hour
  absolute cap is still an eight-hour session.
- **The store's `ttl`.** The server-side record's lifetime is the
  `connectors.json` `ttl` when one is set, and follows the cookie only when it
  is not. Pairing a one-day `ttl` with a fifteen-day cookie leaves the browser
  presenting a valid id to a record that died two weeks earlier.

---

## Values that are not durations {#values-that-are-not-durations}

A value that cannot be parsed, or that is not positive, is **reported at boot
and then ignored**. The message names the bundle, the environment and the key.
The bundle keeps the cookie lifetime it already had, and the boot is never
refused.

```
[ dashboard ][ prod ] security.json > session.expires is not a positive duration
string ("30m", "3h", "15d" — the unit is required) — ignoring it, this bundle
keeps its existing cookie lifetime. Got: "60000*15"
```

This is deliberate rather than strict. Both keys were documented for years while
nothing read them, so a value already sitting in one was never a statement about
this contract — applications commonly kept an expression, a number of
milliseconds, or anything else their own code evaluated. Refusing to boot on
such a value would turn an upgrade into an outage for a key that did nothing the
day before.

One unusable key does not discard its sibling: if `expires` is unparseable and
`remember` is a valid duration, remembered logins still get their lifetime.

:::caution Migrating a value your own code parses
The framework's tolerance protects the *boot*; it does not protect *your* code. If your
application reads these keys itself — an arithmetic expression it evaluates, a number of
milliseconds it parses — then rewriting the value into duration form hands that code something it
cannot read, and it will typically throw at bundle initialisation rather than degrade.

Retire or update your own handling **first**, rewrite the values **second**. And audit every call
site before scoping the change: a shared `security.json` is read by every bundle that does not
override it, so one rewrite can reach bundles you were not thinking about, and a per-request
session refresh lives away from the login path. The [migration
note](/migration#added--per-bundle-login-session-cookie-lifetimes-from-securityjson-restart-additive)
has the full sequence.
:::

---

## What does NOT belong here

The following are **application secrets**. They must never be committed to
version control and gina does not load them from `security.json`. Your
application code is responsible for them — typically from environment variables
or a secrets manager. See [`${secret:KEY}` placeholders](/guides/secrets) for the
supported way to reference them from config.

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
dotfiles — your application code loads it explicitly and only in the right
environment.
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

The base `security.json` keeps the production expiry (`"3h"`); in `dev` the
overlay reduces it to 15 minutes. The overlay wins on every key it declares and
leaves the rest of the base file in place.

:::caution Overlay precedence changed in 0.6.32
Before 0.6.32 an environment overlay lost to its base file on any key both
declared — env-only keys were added, but an actual override was dropped. The
example above did not work. If you have been compensating for that, re-read
your `*.<env>.json` files before upgrading: they now do what they say. Note too
that an overlay array **replaces** the base array rather than being merged into
it.
:::
