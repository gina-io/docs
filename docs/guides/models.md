---
title: Models and entities
sidebar_label: Models
sidebar_position: 2.5
description: How the Gina model layer works — entity classes, SQL files, @param/@return annotations, scope-based data isolation, and calling entity methods from controllers.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[connectors.json reference](/reference/connectors)'
---

# Models and entities

The model layer is where database interaction lives in a Gina bundle. It is built around
**entity classes** — one class per domain object — each backed by SQL files that the
framework automatically wires up as callable methods. Controllers never touch a database
connection directly: they call entity methods and `await` the result.

---

## How it works

At startup, the framework reads every connector declared in `connectors.json`, opens the
connection, and scans the bundle's `models/` directory. For each entity class it finds,
SQL files in the matching subdirectory are converted into methods on that entity's
prototype. By the time a controller action runs, all entity methods are ready to call.

```mermaid
flowchart LR
    A["HTTP request"] --> B["Controller action"]
    B --> C["getModel('mydb')"]
    C --> D["db.userEntity\n.getById(id)"]
    D --> E["SQL executed"]
    E --> F["Promise resolved"]
    F --> G["self.render(data)"]
```

---

## Directory layout

```
src/<bundle>/models/
  <database>/
    entities/
      user.js          ← UserEntity class
      order.js         ← OrderEntity class
    n1ql/              ← Couchbase N1QL queries
      user/
        getById.sql
        update.sql
      order/
        getByUserId.sql
    sql/               ← SQLite queries
      user/
        getById.sql
        update.sql
```

The framework derives entity names and method names entirely from the file system:

```mermaid
flowchart TD
    subgraph files["File system"]
        EF["entities/user.js"]
        SF1["n1ql/user/getById.sql"]
        SF2["n1ql/user/update.sql"]
    end

    subgraph api["Runtime API"]
        ENT["db.userEntity"]
        M1["db.userEntity.getById()"]
        M2["db.userEntity.update()"]
    end

    EF -->|"UserEntity → db.userEntity"| ENT
    SF1 -->|"method name"| M1
    SF2 -->|"method name"| M2
    ENT --- M1
    ENT --- M2
```

The subdirectory name under `n1ql/` or `sql/` must match the entity file name (without
`.js`). The SQL file name (without `.sql`) becomes the method name.

---

## Getting a model in a controller

`getModel()` is a global — no `require` needed. Pass the connector name as declared in
`connectors.json`:

```js
var db = getModel('mydb');
```

The returned object has one property per entity class, keyed as `<entityName>Entity`
(lower-camel-case). For a `user.js` entity file:

```js
db.userEntity       // UserEntity instance
db.orderEntity      // OrderEntity instance
db._connection      // raw database connection (avoid using directly)
```

For cross-bundle access, pass the bundle name as the second argument:

```js
var sharedDb = getModel('analytics', 'reporting-bundle');
```

---

## Entity classes

An entity class is a plain constructor function. The framework injects the `EntitySuper`
base (an EventEmitter) at startup — you do not extend it yourself.

```js
// src/api/models/mydb/entities/user.js

function UserEntity() {
    var self = this;

    this.insert = function(rec) {
        var conn = self.getConnection();

        rec._scope      = self._scope;
        rec._collection = self._collection;

        try {
            conn.insert(rec.id, rec, function(err, result) {
                if (err) return self.emit('user#insert', err);
                self.emit('user#insert', false, rec);
            });
        } catch(e) {
            self.emit('user#insert', e);
        }
    };
}

module.exports = UserEntity;
```

**Rules for JS-defined methods:**

- The method body must contain the string `<shortName>#<methodName>` (e.g. `user#insert`).
  The framework scans source text to discover which methods participate in the event system.
- Call `self.emit('<shortName>#<methodName>', err)` on failure and
  `self.emit('<shortName>#<methodName>', false, result)` on success.
- The framework wraps discovered methods in a Promise with an `.onComplete(cb)` shim —
  callers can use `await` or the callback style interchangeably.

Methods whose body does not reference the trigger string are plain functions and are not
wrapped — they have no `.onComplete()` and no Promise return.

---

## SQL files

SQL files are the primary way to define entity methods. Drop a file at the right path
and the framework creates the method automatically — no registration, no boilerplate.

### Couchbase (N1QL)

```
models/<database>/n1ql/<EntityName>/<methodName>.sql
```

```sql
-- models/mydb/n1ql/user/getById.sql

/*
 * @param  {string} $1
 * @return {object}
 */
SELECT *
FROM `mydb` t
WHERE t.id = $1
  AND t._scope = $scope
```

This produces `db.userEntity.getById(id)`.

For complex queries split across multiple files, use a subdirectory with a `_main.sql`
entry point:

```
n1ql/user/getOrderSummary/
  _main.sql
  totals.sql          ← referenced via @include in _main.sql
```

`_main.sql` can pull in sub-files with:

```sql
@include './totals.sql';
```

### SQLite

```
models/<database>/sql/<EntityName>/<methodName>.sql
```

```sql
-- models/mydb/sql/user/getById.sql

/*
 * @param  {string} ?
 * @return {object}
 */
SELECT * FROM users WHERE id = ?
```

SQLite uses `?` positional placeholders. Statements are pre-compiled at startup via
`conn.prepare()` — the compiled statement is reused on every call.

---

## Annotations

A block comment at the top of each SQL file carries metadata the framework reads at
load time. All annotations are optional.

```mermaid
flowchart LR
    A["SQL file\non disk"] -->|"parse on startup"| B["@param\n@return\n@options"]
    B -->|"inject"| C["entity prototype\nmethod"]
    C -->|"returns"| D["Promise\n+ .onComplete()"]
```

### `@param`

Declares positional parameters and their types. Types are used to cast arguments before
the query runs.

```sql
/*
 * @param {string}  $1   user id
 * @param {integer} $2   page number
 * @param {float}   $3   minimum rating
 */
```

Supported types: `string`, `number` / `integer` (parsed as integer), `float`.

For SQLite, use `?` in the query body — the `@param` count determines binding order.

### `@return`

Controls what the framework extracts from the result set.

| Annotation | What is returned |
|---|---|
| `@return {object}` | First row, or `null` if the result is empty |
| `@return {array}` | All rows (default for SELECT) |
| `@return {boolean}` | `true` if any row exists (SELECT) or any rows were affected (write) |
| `@return {number}` | Numeric value of the first key of the first row — for `COUNT(*)` queries |
| *(omitted on write)* | `{ changes, lastInsertRowid }` (SQLite) or raw result (Couchbase) |

### `@options` (Couchbase only)

Sets Couchbase query options. The most common use is scan consistency:

```sql
/*
 * @options { consistency: "request_plus" }
 */
SELECT ...
```

`request_plus` forces the cluster to index all mutations before the query runs. Use it
when a query must see a document that was just written in the same request. The default
is `not_bounded` (fastest, eventual consistency), which is appropriate for most reads.

---

## Calling entity methods

All SQL-derived methods return a native Promise with an `.onComplete(cb)` shim. The
sequence below shows what happens inside the framework on each call:

```mermaid
sequenceDiagram
    participant C as Controller
    participant E as Entity method
    participant DB as Database

    C->>E: db.userEntity.getById(id)
    E-->>C: Promise (pending)
    Note over E: deferred via setTimeout(0)
    E->>DB: N1QL / SQL query
    DB-->>E: result rows
    E->>E: emit('user#getById', false, row)
    E-->>C: Promise resolved → user object
    C->>C: self.renderJSON(user)
```

Choose whichever call style fits the surrounding code.

### `await` (preferred in async actions)

```js
var Controller = function() {
    var self = this;

    this.profile = async function(req, res, next) {
        var db   = getModel('mydb');
        var user = await db.userEntity.getById(req.routing.param.id);

        if (!user) return self.throwError(404, 'User not found');
        self.renderJSON(user);
    };
};
module.exports = Controller;
```

### `.onComplete()` callback (legacy / mixed style)

```js
this.profile = function(req, res, next) {
    var db = getModel('mydb');

    db.userEntity.getById(req.routing.param.id).onComplete(function(err, user) {
        if (err) return self.render(err);
        self.renderJSON(user);
    });
};
```

### Multiple awaits in sequence

```js
this.dashboard = async function(req, res, next) {
    var db      = getModel('mydb');
    var userId  = req.session.user.id;

    var user    = await db.userEntity.getById(userId);
    var orders  = await db.orderEntity.getByUserId(userId);

    self.render({ user: user, orders: orders });
};
```

### Parallel awaits

```js
var [user, orders] = await Promise.all([
    db.userEntity.getById(userId),
    db.orderEntity.getByUserId(userId)
]);
```

---

## Scope-based data isolation

Every entity prototype gets a `_scope` property injected from the connector configuration
or from `process.env.NODE_SCOPE`. In Couchbase N1QL files, the special placeholder
`$scope` is replaced with the literal scope value before the query is sent — it is **not**
a positional parameter.

```mermaid
flowchart LR
    A["NODE_SCOPE=production\nor connectors.json scope"] -->|"injected at startup"| B["entity._scope\n= 'production'"]
    B -->|"$scope in .sql file"| C["WHERE t._scope = 'production'"]
    C -->|"query sent to DB"| D["Only production\ndocuments returned"]
```

```sql
-- authoring time
SELECT * FROM `mydb` t
WHERE t.id = $1
  AND t._scope = $scope

-- runtime (NODE_SCOPE=production)
SELECT * FROM `mydb` t WHERE t.id = 'abc123' AND t._scope = 'production'
```

When writing a document from a JS entity method, stamp `_scope` and `_collection`
explicitly so the document is visible to future N1QL queries:

```js
rec._scope      = self._scope;
rec._collection = self._collection;
conn.insert(rec.id, rec, cb);
```

See [Scopes — data isolation](../concepts/scopes#scopes-and-data-isolation) for the
full conceptual explanation.

---

## Related entities

Call `this.getEntity('name')` inside an entity class to get another entity instance from
the same model. Use this for operations that span more than one domain object.

```js
function OrderEntity() {
    var self       = this;
    var userEntity = self.getEntity('user');   // UserEntity instance

    this.placeOrder = function(rec) {
        userEntity.getById(rec.userId).onComplete(function(err, user) {
            if (err || !user) return self.emit('order#placeOrder', new Error('User not found'));
            // ... create order ...
            self.emit('order#placeOrder', false, order);
        });
    };
}
```

`getEntity()` returns the cached singleton for that entity within the bundle — the same
instance other callers use, with the same connection.

---

## Couchbase vs SQLite — quick reference

| | Couchbase | SQLite |
|---|---|---|
| SQL directory | `n1ql/` | `sql/` |
| Placeholders | `$1`, `$2`, … | `?` |
| `$scope` substitution | Yes — replaced with scope value | No |
| `@include` support | Yes | No |
| `@options` support | Yes | No |
| Statement preparation | At query time | At startup (`conn.prepare()`) |
| Dev hot-reload (SQL) | Re-reads file on every call | Not applicable |

---

## See also

- [connectors.json reference](../reference/connectors) — configuring database connections
- [Scopes](../concepts/scopes) — scope-based data isolation explained
- [Testing](./testing) — mocking entities and connectors in unit tests
- [Controllers](./controller) — using `await` in controller actions
