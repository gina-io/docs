---
id: text
title: Text Helper
sidebar_label: Text
sidebar_position: 9
---

# Text Helper

The text helper injects the `__()` translation stub and extends `String.prototype`
with trimming utilities.

---

## `__(str)`

Internationalization placeholder. Returns `str` unchanged. Full i18n support is
planned — this function is a stub that lets you mark translatable strings today
so they can be wired up to a translation layer later without changing call sites.

```js
var label = __('Welcome to the dashboard');
```

---

## `String.prototype`

### `.trim()`

Removes leading and trailing whitespace. Polyfill for environments without
native `String.prototype.trim`.

```js
'  hello  '.trim();   // → 'hello'
```

### `.ltrim()`

Removes leading (left) whitespace only.

```js
'  hello  '.ltrim();   // → 'hello  '
```

### `.rtrim()`

Removes trailing (right) whitespace only.

```js
'  hello  '.rtrim();   // → '  hello'
```

### `.gtrim()`

Collapses all interior whitespace runs to a single space and removes leading
and trailing whitespace.

```js
'  hello   world  '.gtrim();   // → 'hello world'
```

---

## See also

- [Prototypes](./prototypes.md) — other global prototype extensions
