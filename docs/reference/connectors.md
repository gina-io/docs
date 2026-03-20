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
    "ping"     : "2m"
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
