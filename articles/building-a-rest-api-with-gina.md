---
title: Building a REST API with Gina in 10 Minutes
published: false
description: Build a working REST API with Node.js using Gina — an MVC framework with native HTTP/2, declarative routing, and zero Express dependency.
tags: node, javascript, webdev, api
cover_image:
canonical_url: https://gina.io/docs/tutorials/notes-api
---

Most Node.js API tutorials start with `npm install express`. But what if your framework gave you HTTP/2, declarative routing, and a structured MVC layout out of the box — without Express?

[Gina](https://github.com/gina-io/gina) is a Node.js MVC framework that takes a different approach. Instead of wiring middleware chains by hand, you declare routes in JSON and write controller actions as plain functions. The framework handles the rest: process management, hot-reload in dev mode, scope-based environment isolation, and a built-in HTTP/2 server.

Let's build a REST API in 10 minutes.

## What we're building

A simple Notes API with three endpoints:

| Method | URL | Action |
|---|---|---|
| `GET` | `/api/notes` | List all notes |
| `POST` | `/api/notes` | Create a note |
| `GET` | `/api/notes/:id` | Get one note |

No database — notes live in memory. The point is to see the Gina workflow, not to set up infrastructure.

## Prerequisites

- Node.js 18+
- Gina installed globally:

```bash
npm install -g gina
```

## Step 1 — Scaffold the project

```bash
mkdir notes && cd notes
gina project:add @notes
gina bundle:add api @notes
```

That's it. Gina creates a complete project structure:

```
notes/
└── src/
    └── api/
        ├── config/
        │   ├── routing.json
        │   ├── app.json
        │   └── settings.json
        ├── controllers/
        │   └── controller.content.js
        └── index.js
```

## Step 2 — Define routes

Open `src/api/config/routing.json` and replace its contents:

```json
{
  "list-notes": {
    "namespace": "content",
    "url": "/notes",
    "method": "GET",
    "param": { "control": "list" }
  },
  "create-note": {
    "namespace": "content",
    "url": "/notes",
    "method": "POST",
    "param": { "control": "create" }
  },
  "get-note": {
    "namespace": "content",
    "url": "/notes/:id",
    "method": "GET",
    "param": { "control": "getById" }
  }
}
```

Notice: routes are data, not code. Each route maps a URL pattern and HTTP method to a controller action. No `app.get()` chains, no middleware ordering to get wrong.

## Step 3 — Write the controller

Open `src/api/controllers/controller.content.js`:

```javascript
function NotesContentController() {
    var self = this;

    // In-memory store (resets on bundle restart)
    var notes = [];
    var nextId = 1;

    /**
     * GET /api/notes — list all notes
     */
    this.list = function(req, res) {
        self.renderJSON({ notes: notes });
    };

    /**
     * POST /api/notes — create a note
     */
    this.create = function(req, res) {
        var body = req.post;

        if (!body || !body.title) {
            return self.throwError(res, 400, 'title is required');
        }

        var note = {
            id: nextId++,
            title: body.title,
            body: body.body || '',
            createdAt: new Date().toISOString()
        };

        notes.push(note);
        self.renderJSON(note);
    };

    /**
     * GET /api/notes/:id — get one note
     */
    this.getById = function(req, res) {
        var id = parseInt(req.params.id);
        var note = notes.find(function(n) { return n.id === id; });

        if (!note) {
            return self.throwError(res, 404, 'Note not found');
        }

        self.renderJSON(note);
    };
}

module.exports = NotesContentController;
```

Key things to notice:

- **No imports.** `self.renderJSON()`, `self.throwError()`, `req.post`, `req.params` — these are provided by the framework. No `require('express')`, no `res.json()`.
- **No middleware.** Body parsing is built in. `req.post` is already parsed.
- **No routing code.** The controller just defines action methods. Routing is in `routing.json`.

## Step 4 — Start the server

```bash
gina bundle:start api @notes
```

Test it:

```bash
# Create a note
curl -X POST http://localhost:3100/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title": "First note", "body": "Hello from Gina!"}'

# List notes
curl http://localhost:3100/api/notes

# Get one note
curl http://localhost:3100/api/notes/1
```

Done. A working API in 4 steps.

## What you get for free

This minimal setup already includes things you'd normally have to configure manually:

- **Hot-reload in dev mode** — edit a controller, refresh the browser. No restart needed.
- **Dev Inspector** — open `http://localhost:3100/_gina/inspector/` to see request data, server logs, and routing info in real time.
- **HTTP/2 ready** — switch to HTTPS in `settings.json` and you get multiplexed connections automatically.
- **Process management** — `gina bundle:stop`, `gina bundle:restart`, `gina bundle:start` all work. The framework manages the process lifecycle.
- **Structured logging** — set `GINA_LOG_STDOUT=true` for JSON log output compatible with any log aggregator.

## Beyond the basics

Gina's architecture scales naturally:

- **Add a database:** drop a `connectors.json` with Couchbase, MySQL, PostgreSQL, or SQLite config. Create entity models under `models/`. The ORM uses SQL files — no query builder DSL to learn.
- **Add HTML views:** run `gina view:add api @notes` to scaffold a Swig template layer alongside JSON responses.
- **Add a second bundle:** `gina bundle:add frontend @notes` creates an independent process on its own port. Bundles communicate via `self.query()` — HTTP/2 inter-process calls with automatic retry.
- **Deploy to Docker/K8s:** `gina-container api @notes` is a foreground launcher that handles SIGTERM gracefully. Works with any container orchestrator.

## Compared to Express

| | Express | Gina |
|---|---|---|
| Routing | Code (`app.get()`, `app.post()`) | Declarative JSON (`routing.json`) |
| Body parsing | `npm install body-parser` | Built in |
| HTTP/2 | Manual wrapping or `http2-express-bridge` | Native (Isaac engine) |
| Process management | External (PM2, nodemon) | Built in (`bundle:start/stop/restart`) |
| Multi-service | Multiple Express apps, manual wiring | Multi-bundle with `self.query()` |
| Dev tools | External (morgan, debug) | Built-in Inspector SPA |

Express is a great minimal HTTP layer. Gina is a framework — it makes more decisions for you, so you write less glue code.

## Try it

```bash
npm install -g gina
mkdir hello && cd hello
gina project:add @hello
gina bundle:add api @hello
gina bundle:start api @hello
```

- GitHub: [gina-io/gina](https://github.com/gina-io/gina)
- Docs: [gina.io/docs](https://gina.io/docs)
- Starter repo: [gina-io/gina-starter](https://github.com/gina-io/gina-starter)
- Full tutorial: [Notes API (5 min)](https://gina.io/docs/tutorials/notes-api)
