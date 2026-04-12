---
id: cli-view
title: view
sidebar_label: view
sidebar_position: 8
description: CLI reference for gina view commands — scaffold HTML view templates into a Gina bundle.
level: beginner
prereqs:
  - '[gina CLI](/cli/)'
  - '[Running bundle](/cli/cli-bundle)'
---

# `gina view`

Scaffold view template files into an existing bundle.

---

## `view:add`

Copy the HTML boilerplate templates into a bundle's `src/<bundle>/templates/`
directory and write the corresponding `templates.json` config.

```bash
gina view:add <bundle> @<project>
```

```bash
gina view:add frontend @myproject
```

This is an **offline** command — it does not require the framework server.

### What it copies

| Source (boilerplate) | Destination |
|----------------------|-------------|
| `bundle_templates/` | `src/<bundle>/templates/` |
| `bundle_public/` | `src/<bundle>/public/` |
| `bundle/config/templates.json` | `src/<bundle>/config/templates.json` |

The scaffolded templates include a `layouts/main.html` layout, a
`content/homepage.html` content block, and shared includes for browser
compatibility messages.

### Template file resolution

`self.render(data)` looks up the [Swig](/swig) template at:

```
src/<bundle>/templates/html/content/<namespace>/<route-name>.html
```

- `<namespace>` — the `namespace` field in `routing.json`
- `<route-name>` — the route **key** in `routing.json` (not the action method name)

This is controlled by `"routeNameAsFilenameEnabled": true` in `templates.json`.
Override for a specific route with `"param": { "file": "custom-name" }` in
`routing.json`.

Data passed to `self.render({ key: value })` is exposed as `page.data` in the
template. Use `{% set data = page.data %}` at the top of the template (as shown
in the scaffolded `homepage.html`), then reference `{{ data.key }}`.

### Switching from JSON to HTML rendering

The default scaffolded controller (`controller.content.js`) calls
`self.renderJSON(data)`. To serve HTML instead, change that call to
`self.render(data)` after running `view:add`.
