---
id: date-format
title: Date Format Helper
sidebar_label: Date Format
sidebar_position: 4
description: Global date formatting, calendar arithmetic, and fiscal period utilities for the Gina framework, available as dateFormat and on Date.prototype.
level: beginner
prereqs:
  - Controllers
---

# Date Format Helper

The date format helper provides date formatting, calendar arithmetic, and fiscal
period utilities for the Gina framework. It is exposed as the global `dateFormat` object and also wired onto `Date.prototype` by the [Prototypes helper](./prototypes.md), so all methods are available directly on any `Date` instance without a `require()` call.

---

## `dateFormat.setCulture(date, culture)`

Sets the locale used for day and month names.

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `Date` | Reference date (sets initial locale context) |
| `culture` | `string` | 5-char culture code (`'en-CM'`, `'fr-CM'`) or 2-char language code (`'fr'`) |

Built-in locales: `en` (default), `fr`.

---

## `dateFormat.format(date, mask, [utc])`

Formats a date using a named mask or a custom pattern string.

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `Date\|string\|number` | The date to format |
| `mask` | `string` | Named mask (see table below) or a custom pattern |
| `utc` | `boolean` | When `true`, outputs in UTC. Prefix the mask with `'UTC:'` for the same effect. |

```js
var now = new Date();
dateFormat.format(now, 'isoDateTime');    // → '2025-06-15T14:30:00'
dateFormat.format(now, 'dd/mm/yyyy');     // custom pattern
dateFormat.format(now, 'UTC:isoDate');    // UTC output
```

### Built-in masks

| Mask name | Pattern | Example output |
|-----------|---------|---------------|
| `default` | `ddd mmm dd yyyy HH:MM:ss` | `Sun Jun 15 2025 14:30:00` |
| `shortDate` | `m/d/yy` | `6/15/25` |
| `shortDate2` | `dd/mm/yyyy` | `15/06/2025` |
| `mediumDate` | `mmm d, yyyy` | `Jun 15, 2025` |
| `longDate` | `mmmm d, yyyy` | `June 15, 2025` |
| `fullDate` | `dddd, mmmm d, yyyy` | `Sunday, June 15, 2025` |
| `cookieDate` | `ddd, dd mmm yyyy HH:MM:ss Z` | RFC 2822 cookie format |
| `logger` | `HH:MM:ss.l` | `14:30:00.123` |
| `shortTime` | `h:MM TT` | `2:30 PM` |
| `shortTime2` | `HH:MM` | `14:30` |
| `mediumTime` | `h:MM:ss TT` | `2:30:00 PM` |
| `mediumTime2` | `HH:MM:ss` | `14:30:00` |
| `longTime` | `h:MM:ss TT Z` | `2:30:00 PM +0100` |
| `longTime2` | `HH:MM:ss Z` | `14:30:00 +0100` |
| `isoDate` | `yyyy-mm-dd` | `2025-06-15` |
| `isoTime` | `HH:MM:ss` | `14:30:00` |
| `isoDateTime` | `yyyy-mm-dd'T'HH:MM:ss` | `2025-06-15T14:30:00` |
| `isoUtcDateTime` | `UTC:yyyy-mm-dd'T'HH:MM:ss'Z'` | `2025-06-15T13:30:00Z` |
| `concatenatedDate` | `yyyymmdd` | `20250615` |

---

## `dateFormat.countDaysTo(date, dateTo)`

Returns the number of days between two dates.

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `Date` | Start date |
| `dateTo` | `Date` | End date |

```js
var days = dateFormat.countDaysTo(new Date('2025-01-01'), new Date('2025-12-31'));
// → 364
```

---

## `dateFormat.getDaysTo(date, dateTo, [mask])`

Returns an array of all dates between `date` and `dateTo` (inclusive).

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `Date` | Start date |
| `dateTo` | `Date` | End date |
| `mask` | `string` | When provided, each element is a formatted string instead of a Date |

```js
var range = dateFormat.getDaysTo(new Date('2025-06-01'), new Date('2025-06-03'), 'isoDate');
// → ['2025-06-01', '2025-06-02', '2025-06-03']
```

---

## `dateFormat.getDaysInMonth(date)`

Returns an array of all `Date` objects in the same month as `date`.

```js
var days = dateFormat.getDaysInMonth(new Date('2025-02-01'));
// → [Date(Feb 1), Date(Feb 2), ... Date(Feb 28)]
```

---

## `dateFormat.getQuarter(date, [code])`

Returns the fiscal quarter (1–4) for the given date.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | `Date` | — | Reference date |
| `code` | `string` | `'us'` | Fiscal calendar: `'us'`, `'eu'`, `'corporate'` |

---

## `dateFormat.getHalfYear(date, [code])`

Returns the fiscal half-year (`1` or `2`).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | `Date` | — | Reference date |
| `code` | `string` | `'us'` | Fiscal calendar: `'us'`, `'eu'`, `'corporate'` |

---

## `dateFormat.getWeek(date, [standardMethod])`

Returns the ISO 8601 week number (1–53).

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `Date` | Reference date |
| `standardMethod` | `boolean` | When `true`, uses the strict ISO 8601 calculation |

---

## Arithmetic

### `dateFormat.addHours(date, h)`

Returns a new `Date` with `h` hours added. Use a negative value to subtract.

### `dateFormat.addDays(date, d)`

Returns a new `Date` with `d` days added. Use a negative value to subtract.

### `dateFormat.addYears(date, y)`

Returns a new `Date` with `y` years added. Use a negative value to subtract.

```js
var tomorrow  = dateFormat.addDays(new Date(), 1);
var lastMonth = dateFormat.addDays(new Date(), -30);
```

---

## Usage via `Date.prototype`

All methods above are also available directly on any `Date` instance after the
framework boots:

```js
var d = new Date();

d.format('isoDate');           // → '2025-06-15'
d.countDaysTo(otherDate);
d.addDays(7);
d.getQuarter();
```

See [Prototypes](./prototypes.md#date-prototype) for how these are wired.

---

## See also

- [Prototypes](./prototypes.md) — wires `dateFormat` methods onto `Date.prototype`
