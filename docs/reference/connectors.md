---
title: connectors.json
sidebar_label: connectors.json
sidebar_position: 7
---

# connectors.json

Declares the database connections available to the bundle's models.

```
src/<bundle>/config/connectors.json
```

---

## How it works

Each key in `connectors.json` is a **connector name** that the model layer uses
to acquire a database connection. The connector type is determined by the
`protocol` field. The framework ships with built-in connectors for Couchbase
(v2, v3, v4) and MongoDB.

---

## Couchbase

```json title="src/api/config/connectors.json"
{
  "couchbase": {
    "protocol" : "couchbase://",
    "host"     : "db1.example.com",
    "database" : "myapp",
    "username" : "appuser",
    "password"  : "secret",
    "ping"     : "2m",
    "scope"    : "production"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `protocol` | `"couchbase://"` \| `"couchbases://"` | `couchbase://` for unencrypted, `couchbases://` for TLS |
| `host` | string | Cluster node address(es). See [multi-host](#multi-host-clusters) |
| `database` | string | Couchbase bucket name |
| `username` | string | Couchbase RBAC username |
| `password` | string | RBAC password |
| `ping` | string | Interval to ping the cluster and verify connectivity (e.g. `"2m"`, `"30s"`) |
| `scope` | string | Data isolation scope stamped on every document at insert time and used to filter N1QL queries. Falls back to `process.env.NODE_SCOPE` when omitted. See [Scopes — data isolation](../concepts/scopes#scopes-and-data-isolation) |

### Multi-host clusters

Pass a comma-separated list of node addresses to connect to a Couchbase cluster.
The SDK will use all nodes for load balancing and failover.

```json
{
  "couchbase": {
    "protocol" : "couchbase://",
    "host"     : "db1.example.com,db2.example.com,db3.example.com",
    "database" : "myapp",
    "username" : "appuser",
    "password"  : "secret",
    "ping"     : "2m"
  }
}
```

---

## MongoDB

```json title="src/admin/config/connectors.json"
{
  "mongodb": {
    "protocol" : "mongodb://",
    "host"     : "127.0.0.1:27017",
    "database" : "myapp"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `protocol` | `"mongodb://"` \| `"mongodb+srv://"` | Connection protocol |
| `host` | string | Host and port |
| `database` | string | Database name |

---

## Multiple connectors

A bundle can declare more than one connector. Each key in `connectors.json`
is independently available to the model layer.

```json
{
  "couchbase": {
    "protocol" : "couchbase://",
    "host"     : "db1.example.com",
    "database" : "primary",
    "username" : "appuser",
    "password"  : "secret"
  },
  "mongodb": {
    "protocol" : "mongodb://",
    "host"     : "127.0.0.1:27017",
    "database" : "analytics"
  }
}
```

---

## Redis

Used as a **session store** for multi-pod and K8s deployments.
Requires `ioredis` installed in your project: `npm install ioredis`.

See [Sessions guide](../guides/sessions#redis-production--multi-pod) for wiring instructions.

### Standalone

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

### Redis Cluster

```json
{
  "myRedis": {
    "connector": "redis",
    "cluster"  : [
      { "host": "node1.redis.internal", "port": 6379 },
      { "host": "node2.redis.internal", "port": 6379 }
    ],
    "password" : "${REDIS_PASSWORD}",
    "tls"      : true,
    "ttl"      : 86400
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `connector` | `"redis"` | — | Selects the Redis connector |
| `host` | string | `"127.0.0.1"` | Redis host (standalone mode) |
| `port` | number | `6379` | Redis port |
| `db` | number | `0` | Redis DB index |
| `password` | string | — | `AUTH` password |
| `tls` | boolean | `false` | Enable TLS. Required for Upstash, ElastiCache, Cloud Memorystore. |
| `cluster` | array | — | Cluster nodes `[{ host, port }, ...]`. When present, standalone fields are ignored. |
| `ttl` | number | `86400` | Session TTL in seconds |
| `prefix` | string | `"sess:"` | Key prefix in Redis |

---

## SQLite

Used as a **session store** for development, staging, and single-pod production.
Uses the Node.js built-in `node:sqlite` module — **zero npm dependencies**.
Requires Node.js ≥ 22.5.0.

See [Sessions guide](../guides/sessions#sqlite-dev--staging--single-pod) for wiring instructions.

### In-memory (dev)

```json title="src/api/config/connectors.json"
{
  "myDb": {
    "connector": "sqlite",
    "database" : ":memory:",
    "ttl"      : 86400
  }
}
```

### File-based (staging / single-pod production)

```json
{
  "myDb": {
    "connector"      : "sqlite",
    "database"       : "/app/data/sessions.db",
    "ttl"            : 86400,
    "prefix"         : "sess:",
    "cleanupInterval": 900
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `connector` | `"sqlite"` | — | Selects the SQLite connector |
| `database` | string | `~/.gina/{v}/sessions-{bundle}.db` | Path to the SQLite file, or `":memory:"` for a volatile in-process store |
| `ttl` | number | `86400` | Session TTL in seconds |
| `prefix` | string | `"sess:"` | Key prefix stored in the sessions table |
| `cleanupInterval` | number | `900` | Seconds between background purges of expired sessions. Set `0` to disable. |

---

## Environment overlay

Use `connectors.dev.json` to point to a local database during development
without touching the production config.

```json title="src/api/config/connectors.dev.json"
{
  "couchbase": {
    "host"    : "127.0.0.1",
    "database": "myapp_dev",
    "ping"    : "5m"
  }
}
```

Only the declared keys are overridden — the base `connectors.json` supplies
`protocol`, `username`, and `password` unchanged.

:::caution
Never commit real credentials to version control. Use environment variables or
a secrets manager to inject passwords, and keep `connectors.json` in your
`.gitignore` if it contains sensitive data, or replace literal passwords with
references to environment variables in your connector setup code.
:::
