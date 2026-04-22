---
title: Add a Bundle and Go Live
sidebar_label: First Bundle
sidebar_position: 3
description: Add your first bundle to a Gina project, start it on its own port, and serve JSON or HTML responses — all managed by the Gina CLI.
level: beginner
prereqs:
  - '[Project created with gina project:add](/getting-started/first-project)'
---

# Add a bundle and go live

Once you have a registered project, the next step is to add a bundle. A bundle is Gina's unit of deployment — each one runs as its own Node.js process with a dedicated port and independent lifecycle, so you can start, stop, and restart services individually.

## What is a bundle?

A **bundle** is a single application or service inside a project. Gina supports several kinds of bundles:

- Frontend & backend web applications
- REST APIs and web services
- Command-line tools

The default bundle type is **API** (renders JSON).

---

## Create a bundle

```bash
gina bundle:add frontend @myproject
```

If you run the command from the project directory, you can omit `@myproject`:

```bash
cd ~/Sites/myproject
gina bundle:add frontend
```

Bundle source files are created under `myproject/src/frontend/`.

---

## Start the bundle

```bash
gina bundle:start frontend @myproject
```

By default, Gina allocates **4 GB** of memory per bundle. To increase it:

```bash
gina bundle:start frontend @myproject --max-old-space-size=8192
```

Visit **http://localhost:3100/** — your bundle is live.

---

## Stop and restart

```bash
gina bundle:stop frontend @myproject
gina bundle:restart frontend @myproject
```

---

## Add HTML views

The default bundle renders a JSON "Hello World" response. To add HTML template support:

```bash
gina view:add frontend @myproject
```

Then restart the bundle:

```bash
gina bundle:restart frontend @myproject
```

Now edit `src/frontend/controllers/controller.content.js` and change `self.renderJSON(...)` to `self.render(...)`. Refresh your browser — you will see the HTML view.

Gina uses [Swig](/views/swig) as its default template engine. You can use any other template engine if you prefer.

---

## Start all bundles in a project

```bash
gina bundle:start @myproject
```

Starts every bundle registered in the project.

---

## Restart all bundles in a project

```bash
gina bundle:restart @myproject
```

---

## What's next?

- [Environments →](../concepts/environments)
- [HTTPS & HTTP/2 →](../guides/https)
- [Logging →](../guides/logging)
