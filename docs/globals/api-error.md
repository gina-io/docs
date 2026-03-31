---
id: api-error
title: ApiError
sidebar_label: ApiError
sidebar_position: 10
description: Global constructor for structured API error responses in the Gina framework, supporting server errors and field-level client validation errors.
level: intermediate
prereqs:
  - Controllers
  - throwError
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
| `.message` | `string` | The error message (first message for multi-field errors) |
| `.tag` | `string` | Internal reference string — only present on client errors |
| `.fields` | `object` | Field-to-message map — only present on client errors. Shape: `{ fieldName: 'message', ... }` |
| `.path` | `string` | Source file path where `ApiError` was constructed — only present on client errors |

---

## Examples

### Unexpected server failure

```js
return self.renderJSON(new ApiError('Database connection lost'));
// { status: 500, error: 'Internal Server Error', message: 'Database connection lost' }
```

### Single field validation error

```js
return self.renderJSON(new ApiError('Email is required', 'email'));
// {
//   status: 412,
//   error: 'Precondition Failed',
//   message: 'Email is required',
//   fields: { email: 'Email is required' }
// }
```

### Multiple field validation errors

```js
return self.renderJSON(new ApiError(
    ['Email is required', 'Password too short'],
    ['email', 'password']
));
// {
//   status: 412,
//   fields: { email: 'Email is required', password: 'Password too short' }
// }
```

### Custom status code

```js
return self.renderJSON(new ApiError('Feature not implemented', 501));
```

---

## See also

- [Controller guide](/guides/controller) — using `renderJSON` to send error responses
- [Validator plugin](/reference/security) — validation rules that produce `ApiError` instances
