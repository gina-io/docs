---
title: Couchbase ORM for Node.js
sidebar_label: Couchbase ORM
sidebar_position: 23
description: Gina provides a Couchbase Node.js ORM with an EventEmitter-based entity system, N1QL query files, $scope multi-tenant isolation, auto-stamping, and dev-mode query instrumentation.
level: intermediate
prereqs:
  - '[Models](/guides/models)'
  - '[Connectors reference](/reference/connectors)'
  - '[Scopes](/concepts/scopes)'
keywords:
  - couchbase node.js orm
  - couchbase orm
  - node.js couchbase entity
  - n1ql node.js
  - couchbase query node.js
  - couchbase multi-tenant node.js
  - node.js database orm
  - couchbase sdk node.js
---

# Couchbase ORM for Node.js

Couchbase is a document database with a SQL-like query language (N1QL) and
key-value access. Most Node.js projects interact with it through the raw SDK,
writing ad-hoc queries in string concatenations and managing connections manually.

Gina's Couchbase connector provides a structured ORM layer:

- **Entities** -- JavaScript classes that map to document types, with generated
  CRUD methods and EventEmitter-based lifecycle hooks
- **SQL files** -- N1QL queries stored as `.sql` files alongside entity code,
  version-controlled and reusable
- **`$scope` isolation** -- automatic multi-tenant data partitioning at the query
  level
- **Auto-stamping** -- `_createdAt`, `_updatedAt`, `_scope` fields injected on
  every insert
- **Query instrumentation** -- every query captured in dev mode for the Inspector

---

## Architecture

```mermaid
flowchart TD
    subgraph Bundle["Bundle Process"]
        C[Controller] -->|"entity.find()"| E[Entity<br/>EventEmitter]
        E -->|"emit trigger"| CN[Couchbase Connector]
        CN -->|"N1QL via SDK"| CB[(Couchbase Server)]
    end

    subgraph DevMode["Dev Mode"]
        CN -->|"push to _devQueryLog"| QI[Query Instrumentation<br/>AsyncLocalStorage]
        QI --> INS[Inspector<br/>Query Tab]
    end

    style Bundle fill:#1a1a2e,stroke:#f2af0d
    style DevMode fill:#2a2a3e,stroke:#4caf50
```

The entity layer sits between your controller and the Couchbase SDK. You interact
with entity methods (`.find()`, `.save()`, `.remove()`). The connector translates
those into N1QL queries, manages the connection, and handles result mapping.

---

## Defining an entity

Entities are defined as JavaScript classes in the `models/` directory of a bundle.
The naming convention is `{entityName}.js`:

```javascript
// models/invoice.js
var EntitySuper = require('gina').entities;

function Invoice(conn, caller) {
    // Call parent constructor
    EntitySuper.call(this, conn, caller);

    var self = this;

    /**
     * Custom method: find invoices by customer
     * @param {string} customerId
     * @fires Invoice#event:invoicesByCustomer
     */
    this.findByCustomer = function(customerId) {
        self.emit('invoice#findByCustomer', customerId);
    };
}

// Inherit from EntitySuper (EventEmitter-based)
Invoice.prototype = Object.create(EntitySuper.prototype);
Invoice.prototype.constructor = Invoice;

module.exports = Invoice;
```

The connector automatically generates standard CRUD methods based on the entity
name and the N1QL queries defined in `.sql` files.

---

## N1QL query files

Queries are stored as `.sql` files alongside the entity definition:

```
models/
  invoice.js
  invoice/
    find.sql
    findByCustomer.sql
    save.sql
    remove.sql
```

Each file contains a single N1QL statement:

```sql
-- models/invoice/findByCustomer.sql
SELECT i.*
FROM `myBucket` i
WHERE i.type = 'invoice'
  AND i._scope = $scope
  AND i.customerId = $1
ORDER BY i._createdAt DESC
```

**Key features of SQL files:**

| Feature | Syntax | Purpose |
|---|---|---|
| Scope filter | `$scope` | Replaced with the current scope string at execution time |
| Positional params | `$1`, `$2`, ... | Bound to method arguments -- parameterized, injection-safe |
| Type filter | `i.type = 'invoice'` | Convention: one document type per entity |
| Annotations | `@options` | Control query execution settings (see below) |

:::info
`$scope` is a **string substitution**, not a query parameter. It is replaced with
a quoted literal (`'local'`, `'production'`, etc.) before the query is sent to
Couchbase. This ensures scope isolation is enforced at the data layer, not in
application code.
:::

---

## `@options` annotations

Control query behavior directly in the SQL file using annotations:

```sql
-- @options scanConsistency=request_plus
SELECT u.*
FROM `myBucket` u
WHERE u.type = 'user'
  AND u._scope = $scope
  AND u.email = $1
```

| Annotation | Values | Default | Purpose |
|---|---|---|---|
| `scanConsistency` | `not_bounded`, `request_plus` | `not_bounded` | Index consistency level |
| `adhoc` | `true`, `false` | `true` | Whether to use prepared statements |
| `profile` | `off`, `phases`, `timings` | `off` (dev: `timings`) | Query execution profiling |

`request_plus` ensures the query sees all mutations up to the current moment --
useful for read-after-write patterns. `not_bounded` (the default) is faster but
may return stale data.

---

## EventEmitter-based lifecycle

Entities extend `EventEmitter`. Method calls emit trigger events, and results are
delivered through callbacks:

```javascript
// In a controller action (var self = this; declared at constructor top)
this.showInvoice = function(req, res, next) {
    var Invoice = self.getModel('invoice');

    Invoice.find(req.routing.param.id).onComplete(function(err, invoice) {
        if (err) return self.throwError(err);

        self.render({ invoice: invoice });
    });
};
```

The flow:

```mermaid
sequenceDiagram
    participant Ctrl as Controller
    participant Entity as Invoice Entity
    participant Conn as Couchbase Connector
    participant CB as Couchbase Server

    Ctrl->>Entity: Invoice.find(id)
    Entity->>Entity: emit('invoice#find', id)
    Entity->>Conn: Execute find.sql with [$1=id]
    Conn->>CB: N1QL query
    CB-->>Conn: Result rows
    Conn-->>Entity: emit('invoice#find', null, data)
    Entity-->>Ctrl: .onComplete(cb) fires
```

**Why EventEmitter instead of Promises?**

The entity system predates native Promises in Node.js. The `.onComplete(cb)` pattern
provides a consistent callback interface. For modern code that needs `async/await`,
use the `onCompleteCall()` global helper:

```javascript
// var self = this; declared at constructor top
this.showInvoice = async function(req, res, next) {
    var Invoice = self.getModel('invoice');

    try {
        var invoice = await onCompleteCall(Invoice.find(req.routing.param.id));
        self.render({ invoice: invoice });
    } catch (err) {
        self.throwError(err);
    }
};
```

See [Async helpers](/globals/async) for details on `onCompleteCall()`.

---

## Auto-stamping on insert

When a new document is inserted, the connector automatically adds metadata fields:

| Field | Type | Value |
|---|---|---|
| `_createdAt` | string (ISO 8601) | Timestamp of insertion |
| `_updatedAt` | string (ISO 8601) | Same as `_createdAt` on insert, updated on save |
| `_scope` | string | Current scope (`local`, `beta`, `production`) |

These fields are set by the connector, not by application code. You do not need to
include them in your entity or save logic:

```javascript
// This is all you need — _createdAt, _updatedAt, _scope are injected
Invoice.save({
    type       : 'invoice'
  , customerId : 'cust-123'
  , amount     : 250.00
  , currency   : 'USD'
}).onComplete(function(err, result) {
    // Saved document now has _createdAt, _updatedAt, _scope
});
```

---

## Multi-tenant isolation with `$scope`

Every N1QL query that includes `$scope` is automatically partitioned by the
current environment's scope. This means:

- A developer running in `local` scope sees only `local` documents
- A staging environment in `beta` scope sees only `beta` documents
- Production sees only `production` documents

**All from the same Couchbase bucket.** No separate databases, no separate clusters,
no manual filtering in application code.

```mermaid
flowchart LR
    subgraph App["Same Application Code"]
        Q["SELECT * FROM bucket<br/>WHERE _scope = $scope"]
    end

    subgraph Envs["Environments"]
        L["local<br/>$scope = 'local'"]
        B["beta<br/>$scope = 'beta'"]
        P["production<br/>$scope = 'production'"]
    end

    App --> L
    App --> B
    App --> P

    style App fill:#1a1a2e,stroke:#f2af0d
    style Envs fill:#2a2a3e,stroke:#666
```

:::tip
Always include `AND _scope = $scope` in your N1QL queries. Omitting it causes the
query to return documents from all scopes -- a data isolation breach. The
[Inspector](/guides/inspector) Query tab highlights queries that are missing scope
filters.
:::

---

## SDK compatibility

The Couchbase connector supports both SDK v3 and SDK v4:

| Feature | SDK v3 | SDK v4 |
|---|---|---|
| N1QL queries | Supported | Supported |
| Query profiling (`meta.profile`) | Works | C++ binding does not surface `profile` field |
| Index reporting | Via `meta.profile` | EXPLAIN fallback (async, cached) |
| Scan consistency | Supported | Supported |
| Prepared statements | Supported | Supported |

The connector detects the SDK version and adjusts its behavior automatically. The
only user-visible difference is in dev-mode query instrumentation: SDK v4 uses an
`EXPLAIN` fallback for index reporting, which may show "N/A" on the first request
for a new query (the EXPLAIN runs asynchronously and caches the result for
subsequent requests).

---

## Dev-mode query instrumentation

In dev mode, every Couchbase query is captured and surfaced in the Inspector:

| Inspector feature | What it shows |
|---|---|
| Query tab | Every N1QL query with statement, params, timing, result count, indexes |
| Flow tab | Database queries as waterfall bars alongside HTTP phases |
| Cross-bundle tracing | Queries from upstream bundles (via `self.query()`) are merged |

Each query entry includes:

```javascript
{
    type        : 'N1QL'
  , trigger     : 'invoice#findByCustomer'
  , statement   : 'SELECT i.* FROM `myBucket` i WHERE ...'
  , params      : ['cust-123']
  , durationMs  : 12
  , resultCount : 5
  , resultSize  : 2048
  , indexes     : [{ name: 'idx_invoice_customer', primary: false }]
  , connector   : 'couchbase'
  , origin      : 'api'
}
```

**Index badges** in the Inspector show which indexes each query used:

| Badge | Meaning |
|---|---|
| Green | Secondary index (efficient) |
| Amber | Primary index scan (full bucket scan -- slow) |
| Red | No index used |
| Grey (N/A) | Index information not available (SDK v4 first request) |

This is powered by `extractIndexes()`, which walks the N1QL execution plan tree
to find `IndexScan3`, `PrimaryScan3`, and `ExpressionScan` operators.

See the [Inspector guide](/guides/inspector) for the full Query tab documentation.

---

## Connector configuration

The Couchbase connector is configured in `connectors.json`:

```json
{
  "couchbase": {
    "type": "couchbase",
    "host": "couchbase://localhost",
    "bucket": "myBucket",
    "username": "admin",
    "password": "password",
    "scope": "local"
  }
}
```

The `scope` field sets the default `$scope` value for all queries through this
connector. It can be overridden per environment in `env.json`.

---

## Further reading

- [Models guide](/guides/models) -- entity definitions, relationships, validation
- [Connectors reference](/reference/connectors) -- all supported connectors (Couchbase, MySQL, PostgreSQL, SQLite, Redis)
- [Scopes](/concepts/scopes) -- scope model and data isolation
- [Inspector guide](/guides/inspector) -- query instrumentation and flow waterfall
- [Async helpers](/globals/async) -- `onCompleteCall()` for Promise/async-await bridging
