---
title: Views and Templates
sidebar_label: Views
sidebar_position: 3
description: Add HTML template support to a Gina bundle using the Swig template engine — layout inheritance, variable interpolation, and switching between JSON and HTML rendering.
level: beginner
prereqs:
  - '[Controllers](/guides/controller)'
  - '[Swig template syntax](/views/swig/syntax)'
---

# Views and templates

Gina bundles render JSON by default, but adding HTML template support takes a single CLI command. Templates are powered by the vendored Swig engine, which uses a Jinja2/Django-like syntax for variable interpolation, conditionals, loops, and layout inheritance.

---

## Adding views to a bundle

A new bundle renders JSON by default. To add HTML template support, run:

```bash
gina view:add frontend @myproject
```

Then restart the bundle:

```bash
gina bundle:restart frontend @myproject
```

## Switching from JSON to HTML rendering

Open `src/frontend/controllers/controller.content.js` and replace:

```js
self.renderJSON({ message: 'Hello, World!' });
```

with:

```js
self.render({ message: 'Hello, World!' });
```

Refresh your browser — the template is now rendered.

---

## Template engine — Swig

Gina ships with [Swig](/views/swig) as the default template engine — see the [Swig documentation](/views/swig) for the full syntax reference, built-in [tags](/views/swig/tags) and [filters](/views/swig/filters), and the [programmatic API](/views/swig/api). Swig uses a syntax similar to Jinja2/Django:

```html
<!DOCTYPE html>
<html>
  <head><title>{{ title }}</title></head>
  <body>
    <h1>{{ message }}</h1>

    {% if user %}
      <p>Welcome, {{ user.name }}!</p>
    {% endif %}

    {% for item in items %}
      <li>{{ item }}</li>
    {% endfor %}
  </body>
</html>
```

Templates live in `src/<bundle>/templates/`. The full path for a content template is:

```
src/<bundle>/templates/html/content/<namespace>/<route-name>.html
```

- `<namespace>` — the `namespace` field in `routing.json`
- `<route-name>` — the route **key** in `routing.json` (not the action method name)

This convention is controlled by `"routeNameAsFilenameEnabled": true` in `templates.json`. Override for a specific route with `"param": { "file": "custom-name" }` in `routing.json`.

Data passed to `self.render({ key: value })` is exposed as `page.data` in the template:

```html
{% extends 'layouts/main.html' %}
{% set data = page.data %}
{% block content %}
  <h1>{{ data.key }}</h1>
{% endblock %}
```

### Layout inheritance

Swig supports [layout inheritance](/views/swig/syntax#template-inheritance) with `{% extends %}` and `{% block %}`:

```html
{# base.html #}
<!DOCTYPE html>
<html>
  <body>
    {% block content %}{% endblock %}
  </body>
</html>
```

```html
{# page.html #}
{% extends "base.html" %}
{% block content %}
  <h1>{{ title }}</h1>
{% endblock %}
```

---

## Using a different template engine

Gina does not lock you into Swig. You can use any template engine by calling `res.render()` or writing the response directly in your controller action.
