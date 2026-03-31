---
title: routing.json
sidebar_label: routing.json
sidebar_position: 3
description: Reference for routing.json — maps URL patterns to controller actions in a Gina bundle, with support for parameters, regex requirements, middleware chains, scopes, and response caching.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[URL patterns](/reference/routing)'
---

# routing.json

Maps URLs to controller actions. Every HTTP request the bundle receives is matched against the rules declared here. Each rule defines a URL pattern, the HTTP method, an optional middleware chain, parameter requirements, and the controller method that handles the request.

```
src/<bundle>/config/routing.json
```

For a full explanation of how routing works — URL patterns, parameters, requirements,
namespaces, redirect routes, reverse routing — see the [Routing guide](../guides/routing).

---

## Minimal example

```json title="src/frontend/config/routing.json"
{
  "home": {
    "url": "/",
    "param": { "control": "home" }
  }
}
```

A `GET /` request calls `this.home(req, res, next)` in `controllers/controller.js`.

---

## Route object

Each key in `routing.json` is a **rule name**. The framework appends `@<bundle>`
internally, so `"home"` becomes `"home@frontend"` and is unique across the project.

```json
{
  "invoice-detail": {
    "url"         : "/invoice/:id",
    "method"      : "GET",
    "namespace"   : "invoice",
    "requirements": {
      "id": "/^[a-f0-9-]{36}$/i"
    },
    "param"       : {
      "control"   : "detail",
      "file"      : "detail/index",
      "title"     : "Invoice :id",
      "id"        : ":id"
    },
    "middleware"  : ["middlewares.passport.authentificate"],
    "scopes"      : ["production", "beta"],
    "queryTimeout": "30s",
    "cache"       : {
      "type"    : "memory",
      "ttl"     : 3600,
      "sliding" : true
    }
  }
}
```

| Field | Required | Default | Description |
|---|:---:|---|---|
| `url` | — | `/<rule-name>` | URL pattern. Supports `:param` placeholders and multiple comma-separated URLs |
| `method` | — | `"GET"` | HTTP method(s). Comma-separated for multiple: `"GET, POST"` |
| `namespace` | — | — | Routes to `controller.<namespace>.js` and sets the views subdirectory |
| `requirements` | — | — | Per-parameter validation. Regex string or `validator::{ ... }` |
| `param.control` | ✓ | — | Controller method to invoke |
| `param.file` | — | rule name | Template path relative to the views directory |
| `param.title` | — | — | Page title. Supports `:param` substitution |
| `middleware` | — | `[]` | Middleware chain to run before the controller action, in order |
| `scopes` | — | current scope | Scopes where this route is active |
| `queryTimeout` | — | `10s` | Timeout budget for outgoing sub-requests (`self.query()`) made within this route's controller action. Accepts a duration string (`"30s"`, `"500ms"`) or milliseconds as a number. Used as a fallback when no timeout is set explicitly in the `query()` call |
| `cache` | — | — | Response caching. See [Caching guide](../guides/caching) for the full field reference |
| `_comment` | — | — | Developer note, ignored by the framework |

:::note
Only `GET` requests are cached. `cache` has no effect on `POST`, `PUT`, or `DELETE` routes.
:::

---

## routing.global.json

Declares middlewares that run **before every route** in the bundle, without
having to repeat them on each route entry.

```
src/<bundle>/config/routing.global.json
```

```json title="src/dashboard/config/routing.global.json"
{
  "middleware": [
    "middlewares.passport.authentificate",
    "middlewares.global.getProjectVersion"
  ]
}
```

Global middlewares are **prepended** to each route's own `middleware` list. A route
that declares `"middlewares.account.checkPermissions"` will run in this order:

```
authentificate → getProjectVersion → checkPermissions → controller action
```

To apply a middleware to every route in the project (not just one bundle), place
`routing.global.json` in `shared/config/` instead:

```
myproject/
└── shared/
    └── config/
        └── routing.global.json
```

A bundle-level `routing.global.json` and the shared one are **merged**, with
the bundle-level middlewares appended after the shared ones.

---

## Environment overlay

Create `routing.dev.json` alongside `routing.json` to add or override routes
only in development.

```json title="src/admin/config/routing.dev.json"
{
  "home": {
    "url" : "/",
    "param": {
      "control"  : "redirect",
      "path"     : "http://127.0.0.1:3102/",
      "code"     : 302
    }
  }
}
```

When `NODE_ENV=dev`, this overrides the `home` route from `routing.json`.
On all other environments the base file is used as-is.

---

## See also

- [Routing guide](../guides/routing) — URL patterns, parameters, requirements, namespaces, reverse routing
- [Middleware guide](../guides/middleware) — Writing and registering middlewares
- [Caching guide](../guides/caching) — Full reference for the `cache` field
