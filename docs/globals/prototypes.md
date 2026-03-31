---
id: prototypes
title: Prototypes
sidebar_label: Prototypes
sidebar_position: 5
description: Built-in prototype extensions for Array, Object, JSON, and Date in the Gina framework, applied at startup and available globally in bundle code.
level: expert
prereqs:
  - '[JavaScript prototypes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)'
  - Framework internals
---

# Prototypes

The prototypes helper extends the built-in JavaScript globals (`Array`, `Object`,
`JSON`, `Date`) with utility methods and wires the [Date Format](./date-format.md)
helper onto `Date.prototype`. Extensions are applied at framework startup and are
available everywhere in bundle code without any `require()` call.

---

## `Array.prototype`

### `.clone()`

Returns a shallow copy of the array.

```js
var copy = [1, 2, 3].clone();
```

### `.inArray(value)`

Returns `true` if `value` is present in the array.

```js
['a', 'b', 'c'].inArray('b');   // → true
```

### `.from(array)`

Returns a new array with duplicate values removed. Polyfill for environments
without `Array.from`.

```js
[1, 2, 2, 3].from([1, 2, 2, 3]);   // → [1, 2, 3]
```

### `.toString()`

Joins the array elements with the default separator.

---

## `Object.prototype`

### `.count()`

Returns the number of own enumerable properties.

```js
{ a: 1, b: 2 }.count();   // → 2
```

---

## `JSON`

### `JSON.clone(obj)`

Returns a deep clone of `obj`. Implemented via JSON serialise/parse.

```js
var copy = JSON.clone({ nested: { value: 42 } });
```

### `JSON.escape(jsonStr)`

Escapes `\n`, `\r`, and `\t` characters inside a JSON string so it can be
safely embedded in another string context.

```js
JSON.escape('{"msg":"line1\nline2"}');
// → '{"msg":"line1\\nline2"}'
```

---

## `Date.prototype` {#date-prototype}

All [Date Format](./date-format.md) methods are attached to `Date.prototype`:

```js
var d = new Date();

d.format('isoDate');                      // → '2025-06-15'
d.format('shortDate2');                   // → '15/06/2025'
d.countDaysTo(new Date('2026-01-01'));
d.getDaysTo(new Date('2026-01-01'), 'isoDate');
d.getDaysInMonth();
d.getQuarter();
d.getHalfYear();
d.getWeek();
d.addHours(6);
d.addDays(-7);
d.addYears(1);
```

See [Date Format](./date-format.md) for full parameter documentation.

---

## `__stack`

A global property that returns the current V8 call stack as an array of
`CallSite` objects. Used internally by `getConfig()` and `getLib()` to detect
the calling bundle automatically.

```js
var stack  = __stack;
var caller = stack[1].getFileName();
```

---

## See also

- [Date Format helper](./date-format.md) — full documentation of the methods wired onto `Date.prototype`
