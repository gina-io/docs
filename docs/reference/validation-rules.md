---
title: Validation Rules
sidebar_label: Validation Rules
sidebar_position: 3.5
description: The complete catalog of Gina form-validator rules, transforms, and meta methods — signatures, JSON forms, default messages, return values, and the chaining and ordering rules that govern how they combine.
level: intermediate
prereqs:
  - '[Forms and Validation](/guides/forms-and-validation)'
  - '[Routing → Validator requirements](/guides/routing#validator-requirements)'
---

# Validation Rules

These rules are the shared grammar used in two places:

- **Rule files** — `src/<bundle>/forms/rules/<name>.json`, where each field maps
  to an object of `ruleName: argument` pairs (see
  [Forms and Validation](/guides/forms-and-validation)).
- **Route requirements** — `validator::{ ... }` constraints in `routing.json`
  (see [Routing → Validator requirements](/guides/routing#validator-requirements)).

The same engine runs in the browser (for live feedback) and on the server (for
trust), so a **built-in** rule behaves identically in both.
[Custom validators](#custom-validators) are the exception — they apply in the
browser only.

## Reading this page

Most rules are used **declaratively** in JSON — you name the rule and give it an
argument:

| Value in JSON | Passed to the rule as |
|---|---|
| `true` | a single `true` argument |
| a number / string | one scalar argument |
| an array | spread as positional arguments |

Each entry below shows the **JSON form** (what you write in a rule file or
requirement) and the **fluent signature** (how the rule is called when you write
a [custom validator](#custom-validators) or chain rules by hand). Inputs reach
every rule as **strings** on the declarative paths (browser field values and
URL-encoded bodies are always strings), so rules coerce as needed.

:::note Not every path delivers a string
Two paths hand a rule a **real JavaScript value** rather than a string, so a
rule must be correct for both:

- **JSON request bodies** keep their parsed types — a numeric field arrives as a
  `Number`, including when a `validator::{}` [routing requirement](/guides/routing)
  validates it, since the parsed body is merged into the validated data.
- **A preceding transform** — [`toInteger`](#tointeger) and
  [`toFloat`](#tofloat) leave a real number on the value, so every rule chained
  *after* one of them receives a number even in the browser.
:::

---

## Data rules

Data rules check a value and record an error if it fails.

### isRequired

`isRequired(isApplicable)` · JSON: `"isRequired": true`

Requires a non-empty value. Fails on `undefined`, `null`, `""`, and on any value
that *starts* with whitespace — `"   "` fails, and so does `" john"`. Pair it
with [`trim`](#trim) when a stray leading space should be cleaned up rather than
rejected. Passing `false` (`"isRequired": false`) marks the field optional and
short-circuits the check.

- **Default message:** *Cannot be left empty*
- **Must come first** — see [Chaining and ordering](#chaining-and-ordering).

```json
"email": { "isRequired": true, "isEmail": true }
```

### isEmail

`isEmail()` · JSON: `"isEmail": true`

Checks a syntactically valid email address. The value is lowercased.

- **Default message:** *A valid email is required*
- An empty value is left to [`isRequired`](#isrequired) alone — `isEmail` adds no
  message of its own to a blank field, whether or not the field is required.

```json
"email": { "isRequired": true, "isEmail": true }
```

### isString

`isString(minLength, maxLength)` · JSON: `"isString": true | N | [min, max]`

Checks that the value is a string, with optional length bounds.

| JSON | Meaning |
|---|---|
| `true` | any string |
| `8` | at least 8 characters |
| `[8]` | at least 8 characters — a one-element array supplies only the minimum, so this is identical to `8` |
| `[8, 72]` | between 8 and 72 characters |
| `[8, 8]` | exactly 8 characters — an exact length needs both bounds |

- **Default messages:** *Must be a string* · *Should be at least %s characters*
  · *Should not be more than %s characters* · *Must have %s characters* (exact).

```json
"password": { "isRequired": true, "isString": [8, 72] }
```

### isInteger

`isInteger(minLength, maxLength)` · JSON: `"isInteger": true | N | [min, max]`

Checks for a whole number. The value is coerced to a `Number`. Optional bounds
constrain the **length of the value's string form**, following the same shape as
[`isString`](#isstring) — `[5]` is a minimum, `[5, 5]` an exact length. For a
positive value that is its digit count; a **negative** value counts its minus
sign too (`-123` is 4), consistent with the same value arriving as a string.

:::caution Bounds are enforced on numeric values since 0.6.3
Before 0.6.3 these bounds were silently ignored whenever the value reached the
rule as a real number rather than a string — no error, no warning, and the field
reported valid. If you declare `"isInteger": N` or `"isInteger": [min, max]` on a
field that can carry a numeric value (a JSON body, or anything chained after
[`toInteger`](#tointeger)), the bound starts being enforced at 0.6.3 and input
that used to pass may now fail. See the
[migration note](/migration#fixed--isinteger-digit-bounds-are-enforced-on-numeric-values).
:::

- **Default messages:** *Must be an integer* · *Should be at least %s characters*
  · *Should not be more than %s characters* · *Must have %s characters* (exact)

```json
"quantity": { "isRequired": true, "isInteger": true }
```

### isNumber

`isNumber(minLength, maxLength)` · JSON: `"isNumber": true | [min, max]`

Checks for an integer or a float. Accepts `,` or `.` as the decimal separator
and strips surrounding whitespace; optional bounds constrain the number of
digits.

- **Default message:** *Must be a number: allowed values are integers or floats*

```json
"amount": { "isRequired": true, "isNumber": true }
```

### isFloat

`isFloat()` · JSON: `"isFloat": true`

Checks for a value with a fractional part. String floats such as `"1.5"` pass;
whole numbers (`"2"`) **fail** — an integer is not a float. A `,` is accepted as
the decimal separator.

- **Default message:** *Must be a proper float*

```json
"rate": { "isRequired": true, "isFloat": true }
```

### isDate

`isDate(mask)` · JSON: `"isDate": "yyyy-mm-dd"` (or `true` for the default)

Checks that the value parses as a date under `mask`. The mask defaults to
`"yyyy-mm-dd"`; separators may be `/`, `-`, or a space, and the field order
follows the mask — so `"dd/mm/yyyy"` accepts `15/06/2023`. Impossible dates
(e.g. `2023-02-30`) are rejected.

- **Default message:** *Must be a valid Date*
- **Returns the field object**, so it chains like any other rule. The parsed
  `Date` becomes the field's value, which is what [`format`](#format) consumes.

:::note Changed in 0.5.4
Earlier versions returned the parsed `Date` instead of the field, which ended any
chain continuing past it. On 0.5.3 and below, follow `isDate` with
[`.format()`](#format) or capture the field separately.
:::

```json
"birthdate": { "isRequired": true, "isDate": "dd/mm/yyyy" }
```

### isBoolean

`isBoolean()` · JSON: `"isBoolean": true`

Accepts `true`/`"true"`/`1` and `false`/`"false"`/`0`, coercing to a real
boolean. A required `false` is valid (an unchecked-but-required toggle does not
fail). Anything outside that set is rejected — including a checkbox posting the
HTML default `"on"`, the strings `"1"` and `"0"`, and case variants like
`"TRUE"`.

- **Default message:** *Must be a valid boolean*
- An empty value is left to [`isRequired`](#isrequired) alone — `isBoolean` adds
  no message of its own to a blank field, whether or not the field is required
  (since 0.6.3; before that a blank field reported *Must be a valid boolean*,
  and on a required field that message replaced *Cannot be left empty*).

```json
"acceptsTerms": { "isRequired": true, "isBoolean": true }
```

### isInList

`isInList(...allowedValues)` · JSON: `"isInList": ["a", "b", "c"]`

Closed-set membership. The value must be **strictly equal** to one of the listed
values. The argument **must be an array**; an empty list rejects every value.

- **Default message:** *Must be one of: %s* (`%s` lists the allowed values)

```json
"status": { "isRequired": true, "isString": true, "isInList": ["draft", "pending", "sent", "paid"] }
```

List values are **literal text** — a `$` has no reference meaning here
(`$name` references exist only in [`is`](#is) expressions), so since 0.6.3 a
value such as `"$100"` validates as its literal (earlier versions threw).
Avoid a value that coincides with `$` + one of the form's own field names —
it is currently reinterpreted as a reference and can never match.

### isJsonWebToken

`isJsonWebToken()` · JSON: `"isJsonWebToken": true`

Checks the three dot-separated base64url segments of a JWT.

- **Default message:** *Must be a valid JSON Web Token*

:::note
This rule lowercases the value as part of its check, which is destructive to a
real token. Use it to validate shape, not to pass a token through unchanged.
:::

### is

`is(condition, errorMessage)` · JSON: `"is": <condition>`

A general-purpose condition. `condition` may be:

- a **boolean** — used directly;
- a **regular expression** — a `RegExp` or a `/pattern/flags` string, tested
  against the value;
- a single **comparison expression** referencing other fields by `$name`, e.g.
  `"$password === $passwordConfirm"`.

`$name` references are an `is`-only grammar: in every **other** rule's
arguments a `$` is plain literal text (since 0.6.3 — earlier versions threw a
`TypeError` when an array-form rule's first value carried a `$` that matched no
field name).

For safety, free-form expressions are restricted to one regex test or one binary
comparison (`===`, `!==`, `==`, `!=`, `<`, `>`, `<=`, `>=`); anything else is
rejected.

- **Default message:** *Condition not satisfied* (override with the second
  argument or [`setFlash`](#setflash)).

```json
"passwordConfirm": { "is": "$password === $passwordConfirm" }
```

A confirmation field is typically also **required**. Pairing `is` with
`isRequired` on the same field is safe — while the field is blank, `isRequired`
reports it, and the condition neither errors nor adds a message of its own
(since 0.6.3; before that a blank required field also collected a second
*Condition not satisfied*). Use the two-argument form to set a message (keep
`isRequired` first):

```json
"passwordConfirm": {
  "isRequired": true,
  "is": ["$password === $passwordConfirm", "Passwords do not match"]
}
```

:::tip Applying a rule twice
To attach the same rule to one field more than once in a rule file, suffix it
with a number — `is`, `is1`, `is2`. Each runs independently and records any
failure under its own key on both the client and the server, so a per-field
error map sees one entry per alias.
:::

---

## Transforms

Transforms coerce or rewrite the value in place. They run as part of the rule
chain, so order them relative to the checks that depend on the result.

### toInteger

`toInteger()` · JSON: `"toInteger": true`

Rounds the value to the nearest integer (`Math.round`). A falsy value is left
untouched.

- **Default message:** *Could not be converted to integer*

`toInteger` leaves a **real number** on the value, not a string — so every rule
chained after it receives a number, in the browser as well as on the server.
Rules that inspect the value's text (such as the [`isInteger`](#isinteger)
length bounds) operate on its string form; this works correctly from 0.6.3
onward, and the bounds were silently skipped in a `toInteger` → `isInteger`
chain before then.

### toFloat

`toFloat(decimals)` · JSON: `"toFloat": N`

Coerces the value to a float rounded to `decimals` places (default `2`),
handling thousands separators.

:::warning Browser-only
`toFloat` reads the live DOM element's value, so it runs **only in the browser**
and will throw on the server. For plain numeric validation that works in both
contexts, use [`isFloat`](#isfloat) or [`isNumber`](#isnumber) instead.
:::

- **Default messages:** *Could not be converted to float* · *Value must be a
  valid number*

### trim

`trim(isApplicable)` · JSON: `"trim": true`

Strips leading and trailing whitespace from a string value.

:::warning Always pass `true`
`trim` only acts — and only continues a chain — when called with `true`.
`trim(false)` or `trim()` is a no-op that breaks a fluent chain (it returns
nothing). In a rule file always write `"trim": true`.
:::

### format

`format(mask, utc)` · JSON: `"format": "isoDateTime"`

Formats a `Date` value to a string using `mask`. It is designed to follow
[`isDate`](#isdate), which produces the `Date` it consumes.

- **Returns a string** — it is terminal; do not chain another rule after it.

```js
// fluent form, e.g. inside a custom validator
field.isDate('dd/mm/yyyy').format('isoDateTime');
```

---

## Meta and control

These methods shape output, labels, messages, and async checks rather than
validating a value directly.

### set

`set(value)` · JSON: `"set": <value>`

Sets the field's value and writes it to the element's `value` attribute.

:::warning Browser-only
`set` always writes to the DOM element, so it runs **only in the browser** and
throws on the server, where a field has no element behind it — the same
constraint as [`toFloat`](#tofloat).
:::

### setLabel

`setLabel(label)` · JSON: `"setLabel": "Email address"`

Sets the human label used by the `%l` message placeholder (the declarative
equivalent of the `data-gina-form-field-label` attribute).

### setFlash

`setFlash(regex, flash)` · JSON: `"setFlash": [null, "Please enter a work email"]`

Overrides the error message for the field. **Only the second argument (`flash`)
is used** — the first is ignored. Subsequent rules that fail use this message
instead of their default.

### exclude

`exclude(isApplicable)` · JSON: `"exclude": true`

Drops the field from the validated output (`toData()` removes it). Pass `false`
to keep it. Useful for confirmation fields you validate but do not want to
persist or send.

```json
"passwordConfirm": { "is": "$password === $passwordConfirm", "exclude": true }
```

### query

`query(options)` · JSON: `"query": { ... }`

Validates the value against a remote endpoint (e.g. a uniqueness check).

- In the **browser** it performs an asynchronous `XMLHttpRequest` and is
  effectively terminal — put it **last** in the chain.
- On the **server** it returns a `Promise`.
- **Default message:** *Must be a valid response*

Response placeholders use the `{{path.to.value}}` syntax (distinct from the
`%`-tokens used by every other message — see
[Messages and placeholders](#messages-and-placeholders)). A field error containing no
`{{placeholder}}` is used verbatim; one that is not a string is ignored, and the rule
keeps its resolved label. A field error that is a raw server stack trace — which an
[`ApiError`](/globals/api-error) produces when the underlying error has no message of
its own — is replaced with a neutral message outside `local` scope, so backend
internals never reach the form.

### getValidationContext

`getValidationContext()` → `{ isGFFCtx, self, local, replace }`

Returns the engine context a [custom validator](#custom-validators) needs to
read sibling fields, the message catalog, and the placeholder helper. Not used
in declarative rule files.

---

## Chaining and ordering

When rules are written as a fluent chain — inside a
[custom validator](#custom-validators), or when the engine applies a rule file —
each rule normally returns the field object so the next rule can run. Two
behaviours are load-bearing:

**`isRequired` should come first.** An empty value is adjudicated by `isRequired`
alone: every other rule passes on a blank field, so an optional one is never
flagged, and a required one reports a single *Cannot be left empty* instead of a
pile of *"…is not valid"* messages stacked on top of it. "Empty" means the
**literal empty string** (and, for a browser field, an unfilled input — whose
value is exactly that). It does **not** mean falsy: since 0.6.3 the values `0`,
`false` and `[]` are validated like any other input rather than being mistaken
for blank — see the
[migration note](/migration#fixed--the-rule-engine-no-longer-treats-0-false-or--as-empty). Whether the **form** is
valid does not depend on the order — but each rule keeps its own per-field
`valid` flag consistent with a surviving `isRequired` error, and that flag is
only correct at every step when `isRequired` ran first.

**Some methods do not return the field — they end a chain:**

| Method | Returns | Consequence |
|---|---|---|
| [`format`](#format) | the formatted string | terminal |
| [`trim`](#trim) | the field **only** when called with `true` | always pass `true` |
| [`query`](#query) | async (browser) / a `Promise` (server) | put it last |

In a declarative rule file these are rarely an issue — you list rules and the
engine applies them — but they matter the moment you write a custom validator
that chains calls.

---

## Messages and placeholders

Every rule has a default message (listed above and collected below). Two
placeholder syntaxes exist:

- **`%`-tokens** — used by all standard messages, substituted from the field:
  `%l` → the field label, `%n` → the field name, `%s` → the size (a length bound
  or the allowed-values list).
- **`{{path.to.value}}`** — used only by [`query`](#query) responses, to pull a
  value out of the response body.

`%`-tokens are substituted in **whatever message the rule resolved** — the English
default, a translated label from the bundle catalog, or a `setErrorLabels()`
override alike. A translated `isStringMinLength` must therefore keep its `%s`, or
the bound disappears from the message.

:::caution `%` is a metacharacter
`%l`, `%n` and `%s` are the only tokens, and the lookup is case-sensitive. Any other
`%` immediately followed by letters is read as a placeholder and renders as the
literal text `undefined` — `%d`, `%L`, and a bare percent glued to a word such as
`20%sur le prix` (which matches `%sur`). Write `20 % sur le prix`, or reword. Gina
warns at bundle boot when a catalog label contains an unknown token.

`%l` reads the DOM attribute `data-gina-form-field-label`, so it is meaningful only
in the browser; server-side it renders as an empty string.
:::

:::note A label must be a string
A label that is not a string — an object, a number, an array — is discarded. The
engine warns once, naming the rule, and renders that rule's **English default**
instead; the field still fails validation. This holds wherever the label came from:
the bundle catalog, a `setErrorLabels()` override, a rule's `errorMessage` argument,
or a per-field `error`. Only the catalog case is also caught at bundle boot, since
that is the only one Gina can see before a request renders it.

*Changed in 0.5.14.* Before that the engine threw, which aborted the whole validation
pass — no message rendered, the form did not submit, and forms bound after it on the
same page were left unbound.
:::

Override messages three ways:

- **Per field** — [`setFlash`](#setflash) (declarative: `"setFlash": [null, "…"]`).
  Wins over everything below.
- **Per culture, in the catalog** — a `_validator.<rule>` block in
  `locales/<culture>.json`. See
  [Localizing built-in error labels](/guides/forms-and-validation#localizing-built-in-error-labels).
- **Per key, at runtime** — `gina.validator.setErrorLabels(labels[, culture])`,
  which overlays the catalog one key at a time rather than replacing it.

### Default message catalog

| Rule | Default message |
|---|---|
| `is` | Condition not satisfied |
| `isEmail` | A valid email is required |
| `isRequired` | Cannot be left empty |
| `isBoolean` | Must be a valid boolean |
| `isNumber` | Must be a number: allowed values are integers or floats |
| `isInteger` | Must be an integer |
| `isFloat` | Must be a proper float |
| `isDate` | Must be a valid Date |
| `isString` | Must be a string |
| `isJsonWebToken` | Must be a valid JSON Web Token |
| `isInList` | Must be one of: %s |
| `query` | Must be a valid response |
| length (min) — `isString` / `isInteger` / `isNumber` | Should be at least %s characters |
| length (max) — `isString` / `isInteger` / `isNumber` | Should not be more than %s characters |
| length (exact) — `isString` / `isInteger` | Must have %s characters |
| length (exact) — `isNumber` | Must contain %s characters |
| `toInteger` | Could not be converted to integer |
| `toFloat` | Could not be converted to float / Value must be a valid number |

---

## Custom validators

When the built-in rules are not enough, drop a function file at:

```
src/<bundle>/forms/validators/<name>/main.js
```

It becomes a chainable rule named `<name>` that you can use like any other
(`"<name>": ...` in a rule file). Inside, reach the engine through
`this.getValidationContext()` to read sibling fields and set errors. Custom
validators get a default message of *Condition not satisfied*.

:::caution Browser-side only — not a server-side guarantee
A custom validator is applied in the browser, but it is **not** enforced on the
server: the server-side registration path is not wired, and the engine silently
skips a rule name it does not recognise. A rule file that leans on a custom
validator therefore gets live feedback and nothing more — re-check that
constraint in your action, or express it with built-in rules, before you trust or
persist the value.
:::

:::warning Trust boundary
Custom validator source is loaded from disk at bundle start and never from
request input. **Never let user-supplied data become a validator definition** —
validator files must be authored by you and shipped with the bundle.
:::

---

## Reading results

When validating by hand (in a custom validator or server-side path), the engine
exposes:

| Method | Returns |
|---|---|
| `isValid()` | `true` if no field has errors |
| `getErrors()` | errors keyed by field name, each a `{ ruleName: message }` map |
| `getErrors(fieldName)` | errors for a single field |
| `toData()` | the validated, transformed values (excluded fields removed) |

---

## See also

- [Forms and Validation](/guides/forms-and-validation) — the how-to: rule files,
  attributes, live checking, submission, and the server-side trust layer.
- [Routing → Validator requirements](/guides/routing#validator-requirements) —
  using these rules as route `requirements`.
