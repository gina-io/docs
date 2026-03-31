---
title: Sessions
sidebar_label: Sessions
sidebar_position: 4.5
description: Configure session management in Gina with express-session — in-memory, SQLite, and Redis stores, cookie options, secrets, and Kubernetes deployment.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[settings.json](/reference/settings)'
---

# Sessions

Gina uses [`express-session`](https://github.com/expressjs/session) for session
management. Sessions are opt-in — you wire the middleware yourself in
`bundle/index.js` so you control exactly how they behave.
Three store backends are supported out of the box: in-memory for local development, SQLite for single-process deployments, and Redis for horizontally scaled production clusters.

---

## How it works

1. The session middleware assigns every browser a signed cookie (`connect.sid`
   by default).
2. On each request the middleware looks up the session data by cookie value from
   the configured store.
3. Your controller reads and writes `req.session.*`.
4. When the response ends the middleware saves any changes back to the store.

Session data is **never stored in the cookie itself** — only the session ID is.

---

## Quick start

Install `express-session` in your project:

```bash
npm install express-session
```

Wire it in `bundle/index.js`:

```js title="src/api/index.js"
var myapp        = require('gina');
var lib          = myapp.lib;
var session      = require('express-session');

myapp.onInitialize(function(event, app) {
    app.use(session({
        secret           : process.env.SESSION_SECRET || 'changeme',
        resave           : false,
        saveUninitialized: false,
        cookie           : { secure: false, maxAge: 86400000 }  // 1 day
    }));

    event.emit('complete', app);
});

myapp.onError(function(err, req, res, next) { next(err); });
myapp.start();
```

This uses the **in-memory store** (default). It is fine for development but
loses all sessions on restart and does not scale across multiple processes.

:::caution In-memory store — development only
The default in-memory store leaks memory over time and resets on every restart.
For staging and production use [SQLite](#sqlite-dev--staging--single-pod) or
[Redis](#redis-production--multi-pod) instead.
:::

---

## Choosing a store

| Store | When to use |
|---|---|
| In-memory (default) | Local development only |
| [SQLite](#sqlite-dev--staging--single-pod) | Dev, staging, single-pod production |
| [Redis](#redis-production--multi-pod) | Multi-pod / K8s horizontal scaling |

---

## SQLite — dev / staging / single-pod

Uses the Node.js built-in `node:sqlite` module. **Zero npm dependencies.**
Requires Node.js ≥ 22.5.0.

### 1. Configure `connectors.json`

```json title="src/api/config/connectors.json"
{
  "myDb": {
    "connector"      : "sqlite",
    "database"       : ":memory:",
    "ttl"            : 86400,
    "prefix"         : "sess:",
    "cleanupInterval": 900
  }
}
```

For a persistent file store (survives restarts):

```json
{
  "myDb": {
    "connector": "sqlite",
    "database" : "/app/data/sessions.db",
    "ttl"      : 86400
  }
}
```

| Field | Default | Description |
|---|---|---|
| `connector` | — | Must be `"sqlite"` |
| `database` | `~/.gina/{version}/sessions-{bundle}.db` | Path to the SQLite file, or `":memory:"` |
| `ttl` | `86400` | Session TTL in seconds |
| `prefix` | `"sess:"` | Key prefix stored in the DB |
| `cleanupInterval` | `900` | Seconds between expired-session purges. Set `0` to disable. |

### 2. Wire the store in `bundle/index.js`

```js title="src/api/index.js"
var myapp        = require('gina');
var lib          = myapp.lib;
var session      = require('express-session');
var SessionStore = lib.SessionStore;

myapp.onInitialize(function(event, app) {
    session.name = 'myDb';                      // key in connectors.json
    var SqliteStore = new SessionStore(session); // returns the SqliteStore class

    app.use(session({
        secret           : process.env.SESSION_SECRET || 'changeme',
        resave           : false,
        saveUninitialized: false,
        store            : new SqliteStore(),
        cookie           : { secure: false, maxAge: 86400000 }
    }));

    event.emit('complete', app);
});

myapp.onError(function(err, req, res, next) { next(err); });
myapp.start();
```

### 3. Environment override

Point dev at an in-memory store without touching `connectors.json`:

```json title="src/api/config/connectors.dev.json"
{
  "myDb": {
    "database": ":memory:"
  }
}
```

---

## Redis — production / multi-pod

Uses [`ioredis`](https://github.com/redis/ioredis). Required for horizontal
scaling — SQLite is per-process and cannot be shared across pods.

```bash
npm install ioredis
```

### 1. Configure `connectors.json`

**Standalone Redis:**

```json title="src/api/config/connectors.json"
{
  "myRedis": {
    "connector": "redis",
    "host"     : "127.0.0.1",
    "port"     : 6379,
    "password" : "",
    "ttl"      : 86400,
    "prefix"   : "sess:"
  }
}
```

**Redis Cluster:**

```json
{
  "myRedis": {
    "connector": "redis",
    "cluster"  : [
      { "host": "node1.redis.internal", "port": 6379 },
      { "host": "node2.redis.internal", "port": 6379 },
      { "host": "node3.redis.internal", "port": 6379 }
    ],
    "ttl"      : 86400,
    "prefix"   : "sess:"
  }
}
```

**Managed Redis with TLS** (Upstash, ElastiCache, Cloud Memorystore):

```json
{
  "myRedis": {
    "connector": "redis",
    "host"     : "my-instance.upstash.io",
    "port"     : 6379,
    "password" : "${REDIS_PASSWORD}",
    "tls"      : true,
    "ttl"      : 86400
  }
}
```

| Field | Default | Description |
|---|---|---|
| `connector` | — | Must be `"redis"` |
| `host` | `"127.0.0.1"` | Redis host (standalone mode) |
| `port` | `6379` | Redis port |
| `db` | `0` | Redis DB index |
| `password` | — | Redis `AUTH` password |
| `tls` | `false` | Enable TLS. Required for most managed providers. |
| `cluster` | — | Array of `{ host, port }` nodes for Redis Cluster mode |
| `ttl` | `86400` | Session TTL in seconds |
| `prefix` | `"sess:"` | Key prefix in Redis |

### 2. Wire the store in `bundle/index.js`

```js title="src/api/index.js"
var myapp        = require('gina');
var lib          = myapp.lib;
var session      = require('express-session');
var SessionStore = lib.SessionStore;

myapp.onInitialize(function(event, app) {
    session.name = 'myRedis';                    // key in connectors.json
    var RedisStore = new SessionStore(session);   // returns the RedisStore class

    app.use(session({
        secret           : process.env.SESSION_SECRET,
        resave           : false,
        saveUninitialized: false,
        store            : new RedisStore(),
        cookie           : {
            secure  : true,      // HTTPS only in production
            maxAge  : 86400000   // 1 day in ms
        }
    }));

    event.emit('complete', app);
});

myapp.onError(function(err, req, res, next) { next(err); });
myapp.start();
```

### 3. Environment overlay

Point dev at a local Redis without changing `connectors.json`:

```json title="src/api/config/connectors.dev.json"
{
  "myRedis": {
    "host"    : "127.0.0.1",
    "port"    : 6379,
    "password": "",
    "tls"     : false
  }
}
```

---

## Using sessions in controllers

```js title="src/api/controllers/controller.auth.js"
this.login = function(req, res, next) {
    var self = this;

    // Validate credentials ...
    var user = { id: 42, name: 'Martin', role: 'admin' };

    req.session.user = user;
    req.session.save(function(err) {
        if (err) return self.throwError(res, 500, err);
        self.renderJSON({ ok: true });
    });
};

this.logout = function(req, res, next) {
    var self = this;

    req.session.destroy(function(err) {
        if (err) return self.throwError(res, 500, err);
        self.renderJSON({ ok: true });
    });
};

this.profile = function(req, res, next) {
    if (!req.session.user) {
        return this.throwError(res, 401, new Error('Not authenticated'));
    }
    this.renderJSON({ user: req.session.user });
};
```

:::tip Session user vs req.user
Gina stores the authenticated user at `req.session.user`, not `req.user`.
Middleware that references `req.user` (Passport.js, etc.) will need a small
adapter if used alongside gina's session pattern.
:::

---

## Cookie options

| Option | Recommended (prod) | Notes |
|---|---|---|
| `secure` | `true` | Only sends cookie over HTTPS. Set `false` behind an HTTP reverse proxy if TLS terminates there. |
| `httpOnly` | `true` (default) | Blocks client-side JS from reading the cookie. |
| `sameSite` | `'lax'` | Protects against CSRF on same-origin requests. Use `'none'` only for cross-origin with `secure: true`. |
| `maxAge` | `86400000` | Expiry in milliseconds. Must match the store TTL in seconds (`maxAge / 1000`). |

```js
cookie: {
    secure  : /^production$/i.test(process.env.NODE_ENV),
    httpOnly: true,
    sameSite: 'lax',
    maxAge  : 86400000
}
```

---

## Secrets

Never hardcode `SECRET` in source. Inject it at runtime:

```bash
# Docker / K8s
SESSION_SECRET=<random-64-char-string>
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

For K8s, store the secret in a Secret object and mount it as an env var:

```yaml
env:
  - name: SESSION_SECRET
    valueFrom:
      secretKeyRef:
        name: myproject-secrets
        key: session-secret
  - name: REDIS_PASSWORD
    valueFrom:
      secretKeyRef:
        name: myproject-secrets
        key: redis-password
```

---

## See also

- [K8s and Docker — session storage](./k8s-docker#session-storage) — multi-pod Redis setup and K8s Secrets
- [connectors.json reference](../reference/connectors) — full field reference for Redis and SQLite
