---
title: templates.json
sidebar_label: templates.json
sidebar_position: 6
description: Reference for templates.json — declares the layout, stylesheets, and scripts for each page in a Gina bundle, with a shared _common baseline inherited by all pages.
level: intermediate
prereqs:
  - '[Views guide](/guides/views)'
  - '[Swig syntax](/views/swig/syntax)'
---

# templates.json

Defines the stylesheets, scripts, and layout used by each page in the bundle. Every bundle that renders HTML should have a `templates.json` in its `config/` directory. The special `_common` key provides a baseline inherited by all pages, and per-page entries can override the layout or append additional assets.

```
src/<bundle>/config/templates.json
```

---

## How it works

`templates.json` is a map from **template name** to a block of assets. The special
key `_common` is inherited by every page in the bundle. Individual page templates
extend `_common` — their stylesheets and scripts are appended after the common ones.

When a controller calls `self.render(data)`, the framework looks up the template
matching the current route's `param.control` (or `param.file`), merges it with
`_common`, and injects the combined asset list into the layout.

---

## Minimal example

```json title="src/frontend/config/templates.json"
{
  "_common": {
    "layout"   : "${templatesPath}/html/layout.html",
    "handlers" : "${templatesPath}/handlers",
    "stylesheets": [
      { "name": "main", "url": "/css/main.css" }
    ],
    "javascripts": [
      { "name": "app", "url": "/js/app.js" }
    ]
  }
}
```

All pages in this bundle load `main.css` and `app.js`. No per-page template is
required unless a page needs its own additional assets or a different layout.

---

## `_common` fields

`_common` is the baseline inherited by all pages. The framework also provides a
framework-level baseline (gina's own CSS/JS) merged below your `_common` — your
values always win.

| Field | Type | Default | Description |
|---|---|---|---|
| `layout` | string | framework default | Path to the main HTML layout file. Supports [path template variables](./index.md#path-template-variables) |
| `noLayout` | string | framework default | Layout used when `layout` is `""` or `false` |
| `html` | string | `${templatesPath}/html` | Directory containing template HTML files |
| `handlers` | string | `${templatesPath}/handlers` | Directory containing client-side JS handler files |
| `routeNameAsFilenameEnabled` | boolean | `true` | When `true`, the route name is used as the default template filename if `param.file` is not set |
| `ginaEnabled` | boolean | `true` | Include gina's built-in CSS and JS in every page. Set to `false` to exclude them entirely |
| `javascriptsDeferEnabled` | boolean | `true` | Place `<script>` tags in `<head defer>` when `true`, or in the `<body>` footer when `false` |
| `stylesheets` | array | gina default | List of stylesheet objects loaded on every page |
| `javascripts` | array | gina default | List of script objects loaded on every page |

### Stylesheet object

```json
{
  "name"           : "main",
  "url"            : "/css/main.css",
  "media"          : "all",
  "rel"            : "stylesheet",
  "type"           : "text/css",
  "isCommon"       : true,
  "isExternalPlugin": false
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | — | Identifier. Used by the framework to deduplicate entries |
| `url` | string | — | URL path to the CSS file |
| `media` | string | `"all"` | CSS media attribute |
| `rel` | string | `"stylesheet"` | Link relation |
| `type` | string | `"text/css"` | MIME type |
| `isCommon` | boolean | `false` | When `true`, this stylesheet is shared across pages and loaded before page-specific ones |
| `isExternalPlugin` | boolean | `false` | When `true`, loads before gina's own CSS (useful for third-party CSS frameworks) |

### Script object

```json
{
  "name"           : "app",
  "url"            : "/js/app.js",
  "type"           : "text/javascript",
  "isCommon"       : true,
  "isExternalPlugin": false
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | — | Identifier. Used by the framework to deduplicate entries |
| `url` | string | — | URL path to the JS file |
| `type` | string | `"text/javascript"` | MIME type |
| `isCommon` | boolean | `false` | When `true`, this script is shared and loaded before page-specific ones |
| `isExternalPlugin` | boolean | `false` | When `true`, loads before gina's own JS (useful for libraries that must precede gina) |

---

## Per-page templates

Add a key for each page that needs its own assets or layout. The key matches
either the route's `param.control` value or the route's `param.file` path.

```json title="src/frontend/config/templates.json"
{
  "_common": {
    "layout"     : "${templatesPath}/html/layout.html",
    "stylesheets": [
      { "name": "main", "url": "/css/main.css", "isCommon": true }
    ],
    "javascripts": [
      { "name": "app",  "url": "/js/app.js",    "isCommon": true }
    ]
  },

  "home": {
    "stylesheets": [
      { "name": "home", "url": "/css/home.css" }
    ],
    "javascripts": [
      { "name": "home", "url": "/js/home.js" }
    ]
  },

  "invoice-detail": {
    "layout": "${templatesPath}/html/print-layout.html",
    "stylesheets": [
      { "name": "invoice", "url": "/css/invoice.css" }
    ]
  }
}
```

- The `home` page loads `main.css` + `app.js` from `_common`, then appends `home.css` and `home.js`.
- The `invoice-detail` page uses a different layout and gets `invoice.css` appended.

---

## Disabling the gina toolbar

The gina dev toolbar is injected automatically in `dev` mode. To disable it for
a specific page, set `ginaEnabled: false` on that template:

```json
{
  "pdf-preview": {
    "ginaEnabled": false,
    "stylesheets": [
      { "name": "pdf", "url": "/css/pdf.css" }
    ]
  }
}
```

To disable the toolbar for the entire bundle, set `ginaEnabled: false` in `_common`.

---

## Extended example

```json title="src/dashboard/config/templates.json"
{
  "_common": {
    "layout"                 : "${templatesPath}/html/layout.html",
    "handlers"               : "${templatesPath}/handlers",
    "routeNameAsFilenameEnabled": true,
    "ginaEnabled"            : true,
    "javascriptsDeferEnabled": true,
    "stylesheets": [
      { "name": "main",    "url": "/css/main.css",    "isCommon": true },
      { "name": "icons",   "url": "/css/icons.css",   "isCommon": true }
    ],
    "javascripts": [
      { "name": "jquery",  "url": "/js/vendor/jquery.min.js", "isCommon": true, "isExternalPlugin": true },
      { "name": "app",     "url": "/js/app.min.js",   "isCommon": true }
    ]
  },

  "home": {
    "stylesheets": [
      { "name": "home", "url": "/css/home.css" }
    ]
  },

  "account-settings": {
    "stylesheets": [
      { "name": "settings", "url": "/css/settings.css" }
    ],
    "javascripts": [
      { "name": "settings", "url": "/js/settings.js" }
    ]
  }
}
```

:::note
jQuery is marked `isExternalPlugin: true` so it is injected before gina's own JS,
which depends on jQuery being available first.
:::

---

## See also

- [Views and templates guide](../guides/views) — Writing layout files and controller actions
- [Routing reference](./routing) — The `param.control` and `param.file` fields that link routes to templates
