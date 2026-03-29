---
id: text
title: Text Helper
sidebar_label: Text
sidebar_position: 9
description: Global i18n translation stub and String.prototype trimming utilities for the Gina framework, injected at startup without require().
---

# Text Helper

The text helper injects the `__()` translation stub and extends `String.prototype`
with trimming utilities. Both are available globally in bundle code after framework startup, providing a forward-compatible i18n entry point and convenience methods for whitespace handling.

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
