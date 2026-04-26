---
id: uuid
title: UUID
sidebar_label: UUID
format: md
---

## lib/uuid {#module_lib/uuid}
Lightweight, cryptographically secure ID generator.
Produces short random strings from a base-62 alphabet (0-9 A-Z a-z).
Uses `crypto.getRandomValues` with bitmask bias avoidance — zero external dependencies.
Works in Node.js (CommonJS) and browser (AMD / GFF) contexts.

**Example**  
```js
var uuid = require('lib/uuid');
uuid();    // 'aB3x'  (4 chars, base-62 default)
uuid(8);   // 'kQ7mZp2R'
```

In controllers and entities, `lib.uuid` is available globally without a require:

```js
// controller action
var id = lib.uuid();

// entity
rec._id = lib.uuid();
```

### lib/uuid(size) ⇒ <code>string</code> {#module_lib/uuid.uuid}
Generate a cryptographically secure random ID from the base-62 alphabet.

**Kind**: static method of [<code>lib/uuid</code>](#module_lib/uuid)  
**Returns**: <code>string</code> - Random base-62 string  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [size] | <code>number</code> | <code>4</code> | Length of the generated ID |

**Example**  
```js
uuid()     // 'aB3x'
uuid(8)    // 'kQ7mZp2R'
uuid(12)   // 'V1StGXR8Z5jd'
```

### lib/uuid.customAlphabet(alphabet, defaultSize) ⇒ <code>function</code> {#module_lib/uuid.customAlphabet}
Create a generator function for a custom alphabet and default size.
The returned function uses the same `crypto.getRandomValues` + bitmask technique
as the default `uuid()`, adapted to the given alphabet length.

**Kind**: static method of [<code>lib/uuid</code>](#module_lib/uuid)  
**Returns**: <code>function</code> - Generator function `(size?) => string`  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| alphabet | <code>string</code> |  | Characters to use |
| [defaultSize] | <code>number</code> | <code>4</code> | Default length when the returned function is called without arguments |

**Example**  
```js
// Hex IDs
var hex = uuid.customAlphabet('0123456789abcdef', 8);
hex();     // 'f47ac10b'
hex(4);    // 'a3f1'  (override length)

// Numeric IDs
var numeric = uuid.customAlphabet('0123456789', 6);
numeric(); // '847291'

// URL-safe
var urlSafe = uuid.customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz-_', 10);
urlSafe(); // 'k7m-z_p2ra'
```

### How it works

The generator uses `crypto.getRandomValues` to fill a `Uint8Array` with random bytes,
then applies a bitmask (`& mask`) to map each byte to a valid alphabet index. The mask
is the smallest `(2^n - 1) >= alphabet.length`, which ensures uniform distribution —
values outside the alphabet range are rejected (not re-mapped), eliminating modulo bias.

| Alphabet size | Mask | Rejection rate |
| --- | --- | --- |
| 62 (base-62, default) | 63 | ~3% |
| 16 (hex) | 15 | 0% |
| 36 (alphanumeric lowercase) | 63 | ~43% |
| 10 (digits) | 15 | ~37% |

Higher rejection rates are safe — they only affect performance (more random bytes consumed),
not security or distribution quality.

### Collision probability

With the default 4-character base-62 alphabet, there are 62^4 = 14,776,336 possible IDs.
For use cases requiring lower collision probability, increase the size:

| Size | Possible IDs | Safe for |
| --- | --- | --- |
| 4 | ~14.7M | DOM element IDs, session-scoped identifiers |
| 8 | ~218T | Database keys within a collection |
| 12 | ~3.2 x 10^21 | Globally unique identifiers |
| 21 | ~4.3 x 10^37 | Equivalent to UUID v4 collision space |
