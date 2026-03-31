---
title: Testing
sidebar_label: Testing
sidebar_position: 8
description: Unit test Gina controllers and entities without a running server using constructor injection and createTestInstance for isolated, mock-driven tests.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[Entity system](/guides/models)'
---

# Testing

Gina provides two purpose-built APIs for unit testing without a running server:
**entity constructor injection** for model layer tests and
**`createTestInstance`** for controller tests.
Both mechanisms use Node's native `node:test` runner with zero external dependencies, letting you verify entity logic against mock connectors and controller actions against mock request/response objects.

---

## Entity testing — constructor injection

Entity classes accept an optional third constructor argument, `injected`, that
replaces live infrastructure with test doubles. This lets you test entity logic
against a mock database connection and mock config without a running Couchbase
cluster.

```js
var inst = new InvoiceEntity(null, null, {
  connector: mockConnector,
  config:    function(bundle, key) { return mockConfig; }
});
```

### `injected.connector`

Overrides `this.getConnection()`. Any object you pass is returned as-is when the
entity calls `getConnection()` internally. Pass a mock that records calls or
returns controlled fixture data.

```js
var mockConnector = {
  query: function(statement, params, cb) {
    cb(null, [{ id: 'inv-001', amount: 1500 }]);
  }
};

var inst = new InvoiceEntity(null, null, { connector: mockConnector });
```

### `injected.config`

Overrides `this.getConfig()`. Must be a function with the same signature
`(bundle, confName)`. Return whatever the entity under test needs from config.

```js
var inst = new InvoiceEntity(null, null, {
  config: function(bundle, confName) {
    return { vatRate: 0.2, currency: 'EUR' };
  }
});
```

### Priority order

When `injected` is provided, the injected values take priority over the live
connection and global config. When a key is absent, the entity falls back to the
live values normally:

| What the entity calls | With `injected.connector` | Without |
|---|---|---|
| `this.getConnection()` | returns `injected.connector` | returns live Couchbase conn |
| `this.getConfig(b, k)` | calls `injected.config(b, k)` | calls global `getConfig(b, k)` |

### Full example

```js
'use strict';

var assert       = require('node:assert/strict');
var { describe, it } = require('node:test');
var InvoiceEntity    = require('../src/api/models/db/entities/invoice.js');

describe('InvoiceEntity#getVatTotal', function() {

  it('returns the correct VAT total', function() {

    var inst = new InvoiceEntity(null, null, {
      connector: {},                           // not used by this method
      config: function() {
        return { vatRate: 0.2 };
      }
    });

    var result = inst.getVatTotal(1000);
    assert.strictEqual(result, 200);
  });

});
```

:::note
`injected` is only intended for test code. Production entity instantiation always
uses the two-argument form `new MyEntity(conn, caller)`.
:::

---

## Controller testing — `createTestInstance`

Controllers are singletons in production. `SuperController.createTestInstance(deps)`
bypasses the singleton and returns a fresh, isolated instance wired with mock
request/response objects.

```js
var inst = MyController.createTestInstance({
  req:     { session: { user: mockUser }, routing: { param: { id: 'abc' } } },
  res:     {},
  next:    function() {},
  options: {}
});
```

The returned instance has:
- Its own independent `local` closure — `req`, `res`, `next`, and `options` are
  already set via `setOptions()`
- `inst._isTestInstance === true`
- No effect on the production singleton

### `deps` reference

| Key | Default | Description |
|---|---|---|
| `req` | `{}` | Mock request object |
| `res` | `{}` | Mock response object |
| `next` | `function() {}` | Mock next middleware |
| `options` | `{}` | Controller options (merged with routing config) |

### Full example

```js
'use strict';

var assert       = require('node:assert/strict');
var { describe, it } = require('node:test');

// Source inspection — loading the full controller requires a running server.
// Use source checks for structural assertions and a mini-controller simulation
// for isolation contract tests.
var fs   = require('fs');
var path = require('path');
var src  = fs.readFileSync(
  path.resolve(__dirname, '../src/api/controllers/controller.invoice.js'),
  'utf8'
);

describe('InvoiceController — source structure', function() {

  it('has a get action', function() {
    assert.ok(src.indexOf('this.get = function') > -1);
  });

});
```

For full isolation contract tests (verifying per-instance closure behaviour,
`_isTestInstance` flag, dependency forwarding), use a minimal controller
simulation rather than loading the real controller module — see
`test/core/controller-injection.test.js` for the reference implementation.

:::note
Each `createTestInstance` call returns a distinct object. They do not share state
with each other or with the production singleton.
:::

---

## Running the tests

Gina's built-in unit tests use Node's native `node:test` runner — no extra
dependencies needed:

```bash
node --test test/core/entity-injection.test.js
node --test test/core/controller-injection.test.js
```

Run all tests in a directory:

```bash
node --test test/core/
```

---

## See also

- [Controllers guide](./controller) — Singleton pattern, request lifecycle
- [Scopes — data isolation](../concepts/scopes#scopes-and-data-isolation) — `_scope` and test data isolation
