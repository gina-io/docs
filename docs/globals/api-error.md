---
id: api-error
title: ApiError
sidebar_label: ApiError
sidebar_position: 10
description: Global constructor for structured API error responses in the Gina framework, supporting server errors and field-level client validation errors.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[throwError](/guides/controller)'
---

# ApiError

`ApiError` is a global constructor for structured error objects used in API
responses. It distinguishes between **server errors** (unexpected failures) and
**client errors** (validation failures tied to specific form fields). The constructor is injected globally at startup and requires no `require()` call.

The constructor is injected globally by the framework when the Validator plugin
is loaded, or directly from the helpers bootstrap as a fallback.

---

## Signatures

### Server error

```js
new ApiError(message)
new ApiError(message, httpStatus)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `message` | `string` | — | Human-readable error description |
| `httpStatus` | `number` | `500` | HTTP status code |

### Client error — single field

```js
new ApiError(message, fieldName)
new ApiError(message, fieldName, httpStatus)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `message` | `string` | — | Error description for the field |
| `fieldName` | `string` | — | Name of the form field that caused the error |
| `httpStatus` | `number` | `412` | HTTP status code |

### Client error — multiple fields

```js
new ApiError([message1, message2, ...], [fieldName1, fieldName2, ...])
```

Messages and field names are matched by index. The resulting error has one entry
per field in its `.fields` map.

---

## Return shape

`new ApiError(...)` returns an Error-like object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `.status` | `number` | HTTP status code |
| `.error` | `string` | Human-readable status text derived from the status code (e.g. `'Internal Server Error'`, `'Precondition Failed'`) |
| `.message` | `string` | The error message — **server errors only**, and never part of the response body (see [What reaches the client](#what-reaches-the-client)) |
| `.tag` | `string` | Internal reference string — only present on client errors |
| `.fields` | `object` | Field-to-message map — only present on client errors. Shape: `{ fieldName: 'message', ... }` |
| `.path` | `string` | Source file path where `ApiError` was constructed — only present on client errors |

:::note Field messages must be user-safe
Each value in `.fields` is rendered directly into the form as that field's error
message. If a value is a raw server stack trace — which happens when the underlying
error has no message of its own, or when a stack string is passed as the message — Gina
replaces it with a neutral **"An error occurred"** outside `local` scope, and keeps the
full stack in `local` for debugging. Pass a real, user-facing message per field rather
than relying on the raw error. *Added in 0.5.14.*
:::

### What reaches the client

`renderJSON` serialises the object with `JSON.stringify`, and that is where the two
return flavours diverge:

| Constructor form | Returns | `message` in the body? |
|------------------|---------|------------------------|
| `new ApiError(message)`, `new ApiError(message, httpStatus)` | a real `Error` | **No** — an `Error`'s `message` is a *non-enumerable* own property, so `JSON.stringify` skips it. It stays readable server-side. |
| `new ApiError(message, fieldName)`, `new ApiError(message, fieldName, httpStatus)`, the array form | a plain object | **No** — the object is built by merging over the `Error`, and that copies enumerable properties only. The text travels in `.fields` instead. |

So an `ApiError` response body carries `status` and `error` — the status *text* — plus
`fields`, `tag` and `path` for client errors, but **never** `message`.

:::caution Sending a human-readable sentence
If the client needs the message itself, either build the payload yourself:

```js
return self.renderJSON({
    status  : 503,
    error   : 'Service Unavailable',
    message : 'Database connection lost'
});
```

…or use [`throwError`](/guides/controller#selfthrowerrorres-code-err), which copies
`message` onto the payload explicitly (and `stack` too, in `local` scope):

```js
return self.throwError(res, 503, new Error('Database connection lost'));
// → { "status": 503, "error": "Service Unavailable", "message": "Database connection lost", "ref": "A1B2C3" }
```
:::

---

## Examples

### Unexpected server failure

```js
return self.renderJSON(new ApiError('Database connection lost'));
// → { "status": 500, "error": "Internal Server Error" }
// 'Database connection lost' stays server-side — see "What reaches the client" above.
```

### Single field validation error

```js
return self.renderJSON(new ApiError('Email is required', 'email'));
// → {
//     "status" : 412,
//     "error"  : "Precondition Failed",
//     "fields" : { "email": "Email is required" },
//     "tag"    : "…",   // internal framework reference
//     "path"   : "…"    // source file that built the error
//   }
```

### Multiple field validation errors

```js
return self.renderJSON(new ApiError(
    ['Email is required', 'Password too short'],
    ['email', 'password']
));
// → {
//     "status" : 412,
//     "error"  : "Precondition Failed",
//     "fields" : {
//       "email"    : "Email is required",
//       "password" : "Password too short"
//     },
//     "tag"    : "…",
//     "path"   : "…"
//   }
```

### Custom status code

```js
return self.renderJSON(new ApiError('Feature not implemented', 501));
// → { "status": 501, "error": "Not Implemented" }
```

---

## See also

- [Controller guide](/guides/controller) — using `renderJSON` to send error responses
- [Validator plugin](/reference/security) — validation rules that produce `ApiError` instances
