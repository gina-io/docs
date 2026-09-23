---
id: data
title: Data Helper
sidebar_label: Data
sidebar_position: 7
description: Global functions for parsing URL-encoded and JSON request bodies and encoding RFC 5987 header values in the Gina framework.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
---

# Data Helper

The data helper injects two global functions for parsing HTTP request bodies and
encoding file name characters. It is used internally by the framework's request pipeline (both engines) and is available in bundle code for manual body processing.

---

## `formatDataFromString(bodyStr)`

Parses a URL-encoded string, a JSON document or an object into a plain JavaScript object.

| Parameter | Type | Description |
|-----------|------|-------------|
| `bodyStr` | `string` \| `object` | A URL-encoded string (`key=value&...`), a JSON document (`{...}` or `[...]`), or an object, which is stringified first |

It returns the parsed object — or `undefined` when a `{`- or `[`-leading input is not valid JSON.

### URL-encoded input

The string is split on `&`, each pair is split at its **first** `=`, and the name
and the value are then percent-decoded **exactly once**. An encoded `&`, `=` or `%`
inside a name or a value is therefore data, never a separator:

| Input | Result |
|-------|--------|
| `tag=a%26b&note=x%3Dy` | `{ tag: 'a&b', note: 'x=y' }` |
| `token=YWJj==` | `{ token: 'YWJj==' }` — a raw `=` inside a value is kept |
| `pct=100%2525` | `{ pct: '100%25' }` — decoded once, not twice |

Values stay **strings** on this path: `true`, `false`, `on` and `null` are not
converted. A value that is itself a JSON document (`filter={"active":"true","n":1}`,
raw or percent-encoded once) is parsed as JSON and keeps its own types —
`{ filter: { active: 'true', n: 1 } }` — while a value that merely starts with
`{` or `[` and is not JSON (`[DRAFT] Report`) is kept as text. A segment without
`=` is dropped, `name=` gives `''`, and a repeated name keeps its last value.

### JSON documents and objects

A JSON document is **never** percent-decoded: a value whose text holds `%20` or
`%22` is kept exactly as written. Before the document is parsed, quoted tokens in
its text are cast:

| Raw string | Resulting value |
|------------|----------------|
| `"true"` | `true` |
| `"false"` | `false` |
| `"on"` | `true` |
| `"null"` (any case) | `null` |
| All others | unchanged |

An object is stringified first and follows the same rule — this is how the
browser validator and DTO routes hand their fields over.

A top-level `__proto__`, `constructor` or `prototype` name is dropped on every
path.

### Nested keys

Bracket notation in field names is expanded into nested objects:

```
user[name]=Alice&user[role]=admin
```

```js
{
    user: {
        name : 'Alice'
      , role : 'admin'
    }
}
```

Deep nesting is supported:

```
filters[date][from]=2025-01-01&filters[date][to]=2025-12-31
```

Empty brackets are **not** array notation: `b[]=x&b[]=y` gives `{ b: { '': 'y' } }`.
Use explicit indexes (`b[0]=x&b[1]=y`) to build an array.

### Examples

```js
// URL-encoded body — values stay strings
var data = formatDataFromString('name=Alice&active=true&count=null');
// → { name: 'Alice', active: 'true', count: 'null' }

// an encoded & or = inside a value is data
var data = formatDataFromString('tag=a%26b&note=x%3Dy');
// → { tag: 'a&b', note: 'x=y' }

// JSON document — quoted tokens are cast, percent-escapes are kept
var data = formatDataFromString('{"name":"Alice","active":"true","q":"50%20off"}');
// → { name: 'Alice', active: true, q: '50%20off' }
```

---

## `encodeRFC5987ValueChars(str)`

Encodes a string for use in a `Content-Disposition` or `Content-Type` header
parameter value per [RFC 5987](https://datatracker.ietf.org/doc/html/rfc5987).

| Parameter | Type | Description |
|-----------|------|-------------|
| `str` | `string` | Value to encode (typically a filename) |

```js
var header = 'attachment; filename*=UTF-8\'\'' + encodeRFC5987ValueChars('rapport annuel 2025.pdf');
res.setHeader('Content-Disposition', header);
```

Letters, digits and `-`, `_`, `.`, `!`, `~` are not encoded. Everything else is
percent-encoded as UTF-8 byte sequences — including `*`, `'`, `(` and `)`, which
RFC 5987 does not allow unescaped (`encodeRFC5987ValueChars("a*b'c")` →
`a%2Ab%27c`).

---

## See also

- [Routing guide](/guides/routing) — how request bodies are made available to controllers
- [Controller guide](/guides/controller) — `req.body` usage
