---
title: Forms and Validation
sidebar_label: Forms & Validation
sidebar_position: 3.5
description: Validate forms with Gina's shared rule engine — one rule set that runs live in the browser for UX and again on the server for trust. Covers rule files, the data-gina-form-* attributes, live checking, submit gating, AJAX submission, CSRF, error display, and the server-side routing validator.
level: intermediate
prereqs:
  - '[Routing](/guides/routing)'
  - '[Controllers](/guides/controller)'
  - '[Views and templates](/guides/views)'
---

# Forms and Validation

Gina ships a form validator built on a single rule engine that runs in **two
places from one definition**:

- **In the browser**, the validator self-runs at page load. It binds your forms,
  checks fields live as the user types, gates the submit button, renders error
  messages, and submits over AJAX — no JavaScript to write.
- **On the server**, the same rule grammar validates incoming URL parameters
  through a route's `requirements`, so a request that fails validation never
  reaches your controller.

You write the rules once, as JSON. The browser uses them for fast feedback; the
server uses them to keep bad input out. The two halves never disagree, because
they execute the same code.

:::tip Where to go for the rule catalog
This guide is the how-to. For the full list of rules, transforms, signatures,
default messages, and chaining gotchas, see the
[Validation rules reference](/reference/validation-rules).
:::

---

## How live validation works

When the page loads, the validator scans every `<form>`, matches it to a rule
set, and wires the events below. Each keystroke or change runs a two-stage pass:
the touched field updates its own error display, then the whole form is
re-checked to enable or disable the submit button.

```mermaid
flowchart TD
    A["Page load"] --> B["Validator scans every &lt;form&gt;<br/>resolves its rule set"]
    B --> C["Bind fields + submit control"]
    C --> D{"User edits a field"}
    D --> E["Validate the touched field"]
    E --> F["Render error / warning<br/>on that field only"]
    E --> G["Re-validate the whole form"]
    G --> H{"All fields valid?"}
    H -->|yes| I["Enable submit button"]
    H -->|no| J["Disable submit button"]
    I --> K{"User submits"}
    K --> L["Cancel native submit<br/>collect + validate all fields"]
    L --> M{"Form valid?"}
    M -->|yes| N["Send over AJAX<br/>(+ CSRF header)"]
    M -->|no| O["Focus the first invalid field"]
    N --> P["success / error callback"]
```

---

## Step 1 — Define a rule set

Rule sets are JSON files under your bundle's `forms/rules/` directory:

```
src/<bundle>/forms/rules/<name>.json
```

Each top-level key is a **field name** (matching the `name` attribute of an
input). Its value is an object of `ruleName: argument` pairs:

```json title="src/myapp/forms/rules/signup.json"
{
  "email": {
    "isRequired": true,
    "isEmail": true
  },
  "password": {
    "isRequired": true,
    "isString": [8, 72]
  },
  "age": {
    "isInteger": true
  }
}
```

The argument shape depends on the rule:

| Value in JSON | Passed to the rule as | Example |
|---|---|---|
| `true` | a single `true` argument | `"isRequired": true` |
| a number | one scalar argument | `"isString": 8` (minimum length 8) |
| a string | one scalar argument | `"isDate": "dd/mm/yyyy"` |
| an array | spread as positional arguments | `"isString": [8, 72]` → min 8, max 72 |

:::note Order matters
Rules run in the order they appear. `isRequired` must come **first** — the
"optional fields may be left blank" behaviour keys off whether `isRequired`
already recorded an error. See
[Chaining and ordering](/reference/validation-rules#chaining-and-ordering) in
the reference.
:::

Sub-directories become dotted paths: `forms/rules/account/signin.json` is the
rule set `account/signin`. The full catalog of rules lives in the
[Validation rules reference](/reference/validation-rules).

---

## Step 2 — Bind a form to its rules

Point a form at a rule set with `data-gina-form-rule`. The value is the rule-set
name (a `/`- or `.`-separated path resolved against `forms/rules/`):

```html
<form id="signup" data-gina-form-rule="signup" method="POST" action="/signup">
  <label>
    Email
    <input type="email" name="email" data-gina-form-field-label="Email">
  </label>

  <label>
    Password
    <input type="password" name="password" data-gina-form-field-label="Password">
  </label>

  <label>
    Age
    <input type="text" name="age" data-gina-form-field-label="Age">
  </label>

  <button type="submit">Create account</button>
</form>
```

That is the entire integration. No script tag, no initialisation call. When the
page loads, Gina:

1. finds the form, resolves the `signup` rule set, and binds each named field;
2. turns **live checking on** (it is on by default for any rule-bound form);
3. tracks the `<button type="submit">` as the form's **submit control** and
   toggles its `disabled` state as validity changes;
4. publishes the running instance as `window.gina.validator`.

:::note Binding by form id
If you omit `data-gina-form-rule`, Gina also matches the **form's `id`**
(with `-` treated as `.`) against your rule-set names. A `<form id="signup">`
with no `data-gina-form-rule` still picks up `forms/rules/signup.json`.
A form with neither a matching rule set nor the attribute is left untouched.
:::

---

## Live checking

Live checking is **on by default** for every rule-bound form. As the user
interacts with a field, Gina validates it and updates its display; it also
re-checks the whole form to enable or disable the submit control.

To turn it off for a specific form, set the attribute explicitly to `false`:

```html
<form id="signup" data-gina-form-rule="signup" data-gina-form-live-check-enabled="false">
```

A few behaviours worth knowing:

- **Only the touched field shows its error.** The whole-form pass controls the
  submit button, but error messages appear for fields the user has actually
  interacted with — untouched invalid fields stay quiet until submit.
- **Warnings vs. errors.** While a field is still being edited it shows only a
  soft *warning* border (`form-item-warning`) — the error message itself stays
  hidden. Once the field is committed (blur, or submit), it becomes a hard
  *error* (`form-item-error`) and its message is revealed. Style these two
  classes to taste.
- **Field labels.** `data-gina-form-field-label` provides the human label used
  in messages — the `%l` placeholder in a message resolves to it.

### Accessibility

Error rendering is wired for assistive technology out of the box:

- committed errors set `aria-invalid="true"` on the field (mirroring the native
  `:user-invalid` state);
- each error message is linked to its field with `aria-errormessage` (Gina does
  not override an `aria-errormessage` you set yourself);
- a visually-hidden `role="status" aria-live="polite"` region announces
  blur-time errors;
- on a failed submit, focus moves to the **first invalid field in document
  order**, so screen readers announce it immediately.

---

## The submit control

The form's submit control is the element whose `disabled` state Gina toggles to
gate submission. Gina discovers it automatically:

- a `<button type="submit">` owned by the form, or
- an `<a data-gina-form-submit="true">` acting as a submit link (anchors are not
  native form controls, so this attribute opts them in).

You do not need to give the button an `id` — Gina assigns one if it is missing.

:::warning The gate is the disabled button, not an attribute
The only thing that prevents submission of an invalid form is the **disabled
state of the submit control**. There is no "block submit" data attribute. If a
form has no discoverable submit control, Gina logs a console warning and submit
gating quietly does nothing — so make sure every validated form has a
`<button type="submit">` or an `<a data-gina-form-submit="true">`.
:::

To override the HTTP method a submit link uses, add
`data-gina-form-submit-method` (e.g. `"PUT"`).

---

## Submission is always AJAX

For a validator-bound form, Gina **always cancels the native submit** and sends
the request over `XMLHttpRequest` instead — the browser never navigates away.
On submit it re-collects the fields, validates them once more, and:

- **if valid**, sends the data to the form's `action` (merging in any
  [inherited data](#inheriting-data-into-the-payload) first);
- **if invalid**, moves focus to the first invalid field and shows the errors.

### CSRF

On mutating methods (`POST` / `PUT` / `PATCH` / `DELETE`), Gina automatically
attaches an `X-Gina-CSRF-Token` request header, read from the `gina-csrf-token`
cookie. This is the header the [CSRF plugin](/guides/csrf) verifies — register
`gina.plugins.Csrf` and the token round-trips with no extra work. If the cookie
is absent (the CSRF plugin is not active), the header is simply omitted.

### Inheriting data into the payload

`data-gina-form-inherits-data` holds URL-encoded JSON that Gina merges into the
payload just before sending — useful for carrying context that is not a visible
field:

```html
<form id="signup" data-gina-form-rule="signup"
      data-gina-form-inherits-data="%7B%22source%22%3A%22landing%22%7D">
```

---

## Reacting to the result

### Declarative callbacks

The simplest way to react to a submission is to name a callback on `window`:

```html
<form id="signup" data-gina-form-rule="signup"
      data-gina-form-event-on-submit-success="onSignupSuccess"
      data-gina-form-event-on-submit-error="onSignupError">
```

```js
// Registered on window — bare identifier, not a call expression.
window.onSignupSuccess = function (event, data) {
  // the XHR succeeded
};

window.onSignupError = function (event, data) {
  // the server returned an error
};
```

:::warning Use a bare identifier
The attribute value must be the **name** of a `window` function
(`"onSignupSuccess"`), not a call expression (`"onSignupSuccess()"`). The
call-expression form is rejected with a console warning and the handler is
not registered.
:::

### Programmatic API and events

For finer control, the live instance is published as `window.gina.validator`
once a form is ready. Each form has a handle at `gina.validator.$forms[formId]`
exposing:

| Method | Effect |
|---|---|
| `.submit()` | trigger validation + submit programmatically |
| `.send(data)` | send a payload over AJAX (skips re-validation) |
| `.reBind()` | re-scan the form after you have changed its DOM |
| `.destroy()` | unbind the form and remove its listeners |
| `.resetFields()` | restore fields to their initial values |
| `.resetErrorsDisplay()` | clear rendered error/warning state |

Events are attached with `.on(eventName, handler)`:

```js
// gina is the global; the form id here is "signup".
gina.validator.$forms['signup'].on('submit', function (event, result) {
  // Binding 'submit' intercepts the validated submit BEFORE the default
  // AJAX send — you take over from here (e.g. call .send() yourself).
  if (result.isValid()) {
    gina.validator.$forms['signup'].send(result.toData());
  }
});
```

A `ready.<formId>` event fires once a form is wired, in case you need to run
setup after binding. Binding `submit` replaces Gina's default auto-send for
that form — only do it when you mean to take control of submission.

---

## Server-side validation

**Client-side validation is for user experience, not trust.** Anyone can bypass
the browser and post directly to your endpoint, so the server must validate
independently. Gina gives you one automatic server-side layer and leaves the
rest to your controller.

### Route requirements (automatic)

A route's `requirements` validate incoming values **before the route is
considered a match**, using the same `is*` rule grammar. A route whose
requirements fail is skipped — the router moves on as if it did not exist.

```json title="config/routing.json"
"account-email-update": {
  "url": "/account/email",
  "method": "PUT",
  "requirements": {
    "email": "validator::{ isRequired: true, isEmail: true }"
  },
  "param": { "control": "emailUpdate" }
}
```

Requirements see both **URL parameters** and the **merged request body**, so on
a `POST`/`PUT` route a requirement keyed on a posted field name is checked too.

```mermaid
flowchart LR
    A["Request"] --> B["Router tries each route"]
    B --> C{"URL + method match?"}
    C -->|no| B
    C -->|yes| D["Check validator:: requirements<br/>(URL params + merged body)"]
    D --> E{"All requirements pass?"}
    E -->|yes| F["Route matches →<br/>controller action runs"]
    E -->|no| G["Route skipped →<br/>try next route"]
    G --> B
    B -.->|no route left| H["404 / 405"]
```

:::warning Requirements gate routing, not form errors
A failed requirement makes the route **not match** — the eventual response is a
`404`/`405` if no other route matches, not a per-field validation message. Use
requirements to keep malformed requests out (the trust gate), not to produce a
friendly "this field is wrong" response. See
[Routing → Validator requirements](/guides/routing#validator-requirements) for
the full requirements syntax.
:::

### Validating a submitted body in the controller

There is **no built-in controller method that re-runs the rule engine against a
submitted body and hands you field-level errors.** When you need to re-validate
a posted body for trust and respond with your own error shape, do it explicitly
in the action by reading the parsed body and checking the values you care about:

```js
this.emailUpdate = function(req, res, next) {
  var email = req.put.email;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return self.throwError(res, 422, 'A valid email is required');
  }

  // ... trusted from here
};
```

This keeps the trust decision in your hands. The client-side rules already gave
the user fast feedback; the route `requirements` already rejected the most
malformed requests; the controller check is the final, explicit gate for
anything that must be true before you act on the data.

---

## Attribute reference

### Form-level

| Attribute | Effect |
|---|---|
| `data-gina-form-rule` | Name of the rule set (a `/`- or `.`-path under `forms/rules/`). |
| `data-gina-form-live-check-enabled` | Toggle live checking. **On by default** for a rule-bound form; set `"false"` to disable. |
| `data-gina-form-inherits-data` | URL-encoded JSON merged into the payload before sending. |
| `data-gina-form-event-on-submit-success` | Bare name of a `window` callback run when the AJAX submit succeeds. |
| `data-gina-form-event-on-submit-error` | Bare name of a `window` callback run when the submit errors. |

### Field-level

| Attribute | Effect |
|---|---|
| `data-gina-form-field-label` | Human label for the field, used by the `%l` message placeholder. |
| `data-gina-form-element-group` | Groups related radios/checkboxes for collective validation. |

### Submit control

| Attribute | Effect |
|---|---|
| `data-gina-form-submit` | Marks an `<a>` as a submit control (anchors are not native form controls). |
| `data-gina-form-submit-method` | Overrides the HTTP method a submit link uses. |

---

## Not covered here

File uploads use a separate set of `data-gina-form-upload-*` attributes and a
different submission path (multipart, staged previews). That subsystem is
documented in its own chapter — see [File uploads](/guides/file-uploads).

---

## See also

- [Validation rules reference](/reference/validation-rules) — every rule,
  transform, signature, default message, and chaining gotcha.
- [Routing → Validator requirements](/guides/routing#validator-requirements) —
  the server-side `validator::{ ... }` syntax.
- [CSRF Protection](/guides/csrf) — the plugin behind the automatic
  `X-Gina-CSRF-Token` header.
- [Controllers](/guides/controller) — reading `req.post` / `req.put` and
  responding with `self.throwError()`.
