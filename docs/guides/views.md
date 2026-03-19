---
sidebar_position: 3
---

# Views and templates

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

Gina ships with [Swig](https://node-swig.github.io/swig-templates/) as the default template engine. Swig uses a syntax similar to Jinja2/Django:

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

Templates live in `src/<bundle>/templates/`.

### Layout inheritance

Swig supports layout inheritance with `{% extends %}` and `{% block %}`:

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
