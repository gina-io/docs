---
id: data
title: Data Helper
sidebar_label: Data
sidebar_position: 7
---

# Data Helper

The data helper injects two global functions for parsing HTTP request bodies and
encoding file name characters. It is used internally by the framework's request
pipeline and is available in bundle code for manual body processing.

---

## `formatDataFromString(bodyStr)`

Parses a URL-encoded or JSON request body string into a plain JavaScript object.

| Parameter | Type | Description |
|-----------|------|-------------|
| `bodyStr` | `string` | Raw request body — either URL-encoded (`key=value&...`) or a JSON string |

### Type casting

String values are automatically cast:

| Raw string | Resulting value |
|------------|----------------|
| `"true"` | `true` |
| `"false"` | `false` |
| `"on"` | `true` |
| `"null"` | `null` |
| All others | `string` (unchanged) |

### Nested keys

Bracket notation in field names is expanded into nested objects:

```
user[name]=Alice&user[role]=admin
```

```js
{
    user: {
        name: 'Alice',
        role: 'admin'
    }
}
```

Deep nesting is supported:

```
filters[date][from]=2025-01-01&filters[date][to]=2025-12-31
```

### Examples

```js
// URL-encoded body
var data = formatDataFromString('name=Alice&active=true&count=null');
// → { name: 'Alice', active: true, count: null }

// JSON body
var data = formatDataFromString('{"name":"Alice","active":true}');
// → { name: 'Alice', active: true }
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

Characters in the unreserved set (`A–Z`, `a–z`, `0–9`, `-`, `_`, `.`, `!`, `~`,
`*`, `'`, `(`, `)`) are not encoded. All others are percent-encoded as UTF-8
byte sequences.

---

## See also

- [Routing guide](/guides/routing) — how request bodies are made available to controllers
- [Controller guide](/guides/controller) — `req.body` usage
