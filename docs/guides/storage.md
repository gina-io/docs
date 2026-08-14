---
title: Object storage
sidebar_label: Object storage
sidebar_position: 3.7
description: Store files in Gina through a pluggable storage layer — named drivers pairing an adapter (where bytes live) with a strategy (how keys are laid out), opaque keys, atomic writes, and per-object metadata through a pluggable store seam.
keywords: [gina object storage, file storage, blob storage, storage driver, sharded storage, content-addressed storage, cas, stream strategy, resumable uploads, resumable upload node.js, opaque keys, atomic write, temp and rename, byte range, storage metadata, sqlite metadata store, maxObjectSize, gina.storage, node.js object storage]
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[File uploads](/guides/file-uploads)'
  - '[Connectors](/reference/connectors)'
---

# Object storage

Applications accumulate files that are not uploads: rendered PDFs, generated exports, zip archives, thumbnails. They need a place to live, a stable way to refer to them, and a write that a reader can never catch half-finished.

The **storage layer** provides that. You declare named **drivers** in `settings.json`, each pairing an **adapter** (where the bytes live) with a **strategy** (how keys are laid out), and reach them from application code through `gina.storage()`.

:::note Not the browser `gina/storage` plugin
Gina also ships a client-side AMD module with the id `gina/storage` — a `localStorage` wrapper that runs only in the browser. It is unrelated to this guide. Everything here is server-side.
:::

---

## How it works

```mermaid
flowchart LR
    A["Controller action<br/>gina.storage()"] -->|"put(stream, meta)"| D[Driver]
    D --> S["Strategy<br/>(sharded)<br/>builds the key"]
    D --> Q{"size vs<br/>inlineThreshold"}
    Q -->|"under — inline tier"| M["Metadata store<br/>(embedded SQLite,<br/>or a connector)"]
    Q -->|"at or above"| AD["Adapter<br/>(local)<br/>writes the bytes"]
    AD -->|"1. stream"| T["&lt;root&gt;/.tmp/…"]
    T -->|"2. rename — atomic publish"| F["&lt;root&gt;/YYYY/MM/DD/&lt;ulid&gt;.pdf"]
    AD -->|"3. metadata row"| M
    D -.->|"returns"| K["{ key, size, contentType }"]
```

A file-backed write reaches its final path only through `rename(2)`, which is atomic: a concurrent reader either sees nothing or sees the complete object, never a partial one. An object smaller than the driver's [size-tiering threshold](#size-tiering) never touches the filesystem at all — its bytes land in the metadata store in a single transaction. If anything fails mid-write — the source errors, the disk fills, the size cap is exceeded — nothing is published and the **real** error is reported.

---

## Configure a driver

```json
// settings.json
{
  "storage": {
    "default": "assets",
    "drivers": {
      "assets": {
        "adapter": "local",
        "strategy": "sharded",
        "root": "/var/data/assets",
        "maxObjectSize": "50MB"
      }
    }
  }
}
```

| Key | Required | Meaning |
| --- | --- | --- |
| `adapter` | yes | Where bytes live. `local` = the local filesystem under `root`. |
| `strategy` | yes | How keys are laid out. `sharded` = `YYYY/MM/DD/<ulid>` with a sanitised extension; [`cas`](#content-addressed-storage-cas) = content-addressed, deduplicating, refcounted; [`stream`](#large-media-and-resumable-uploads-stream) = one directory per asset, with resumable uploads. |
| `root` | yes | Absolute directory holding this driver's objects. |
| `maxObjectSize` | no | Per-object ceiling, as a **unit-suffixed string** (`"50MB"`). Defaults to `100MB`. |
| `store` | no | A `connectors.json` entry name for the metadata store. Omit for the embedded default. |
| `inlineThreshold` | no | [Size-tiering](#size-tiering) boundary, as a **unit-suffixed string**. Objects strictly under it live inline in the metadata store. Defaults to `"64KB"`; `"0B"` turns tiering off for this driver. Applies to `sharded` and `cas`; reported as an ignored key under `stream`, which never inlines. |
| `hash` | no | **cas only.** The digest algorithm; its name becomes a namespace segment in every key. Defaults to `"sha256"`. Validated at boot against what *this runtime's* crypto provides. |
| `fsync` | no | **cas and stream.** Whether writes are flushed to disk before they are published or acknowledged — under `stream`, that includes each resumable segment before its durability marker. Defaults to `true` in both — see [Durability](#durability-stated-plainly). |
| `sweepInterval` | no | **cas only.** How often the garbage-collection sweep runs, as a **unit-suffixed duration** (`"15m"`). `"0s"` disables the periodic sweep. |
| `sweepGrace` | no | **cas only.** How long a blob must sit at zero references before the sweep may collect it (`"1h"`). Must be greater than zero. |
| `chunkSize` | no | **stream only.** The segment size the write path is tuned for, as a **unit-suffixed string**. Defaults to `"8MB"`, and `createUpload()` reports it back so a client can match it. A tuning knob, not a protocol constraint. |
| `sessionTtl` | no | **stream only.** How long an untouched [resumable upload session](#large-media-and-resumable-uploads-stream) survives before it is reclaimed, as a **unit-suffixed duration**. Defaults to `"24h"`. Must be greater than zero. |
| `sessionSweepInterval` | no | **stream only.** How often that reclamation runs (`"1h"`). A pass also runs at boot. `"0s"` disables the periodic one. |

`storage.default` names the driver returned by a no-argument `gina.storage()`. Omit it and every call must name its driver.

### Two rules the boot enforces

**`root` must be absolute.** A relative root would resolve against the process working directory, which depends on how the bundle was launched.

**`root` must sit outside every web-served directory.** If it were inside a bundle's `publicPath` — or inside any target of a `content.statics` mapping — the stored objects would be fetchable directly, without passing through any authorization your application applies. The driver's own metadata database lives inside the root, so it would be downloadable too. Both cases refuse the boot with a message naming the offending pair.

### `maxObjectSize` needs an explicit unit

```json
"maxObjectSize": "50MB"   // ✅
"maxObjectSize": 50        // ⚠️ warns at boot, falls back to the default
```

This is deliberately stricter than `settings.json > upload`, where a bare number means megabytes for backward compatibility. Inside `upload` a bare number already means two different things — `maxFields: 1000` is a count, `maxFieldsSize: 50` would be megabytes — so there is no single meaning for this key to inherit. Rather than guess, it asks. `inlineThreshold` follows the same rule.

---

## Store and read an object

```javascript
var gina = require('gina');

// in a controller action
var pdf = renderInvoicePdf(order);          // any readable stream

gina.storage().put(pdf, {
    originalName : 'invoice-' + order.ref + '.pdf',
    contentType  : 'application/pdf'
}, function (err, res) {
    if (err) {
        return self.throwError(500, err);
    }
    // res => { key, size, contentType }
    order.invoiceKey = res.key;             // store the key, never parse it
    self.renderJSON({ stored: res.key, size: res.size });
});
```

Reading it back:

```javascript
gina.storage().get(order.invoiceKey, function (err, stream) {
    if (err) {
        return self.throwError(404);
    }
    stream.pipe(self.res);
});
```

### Storing a file that is already on disk

`put()` takes a **readable stream**, which is what a file already on disk becomes in one line — a child process wrote it, a library produced it, or you staged it yourself:

```javascript
var fs = require('fs');

gina.storage().put(fs.createReadStream('/tmp/report-8821.pdf'), {
    originalName : 'report-8821.pdf',
    contentType  : 'application/pdf'
}, function (err, res) {
    if (err) {
        return self.throwError(500, err);
    }
    // res.size is measured from the published bytes — no stat() needed
    fs.unlink('/tmp/report-8821.pdf', function () {});   // your temp, your call
});
```

Two things you do not have to do yourself: `res.size` is **measured by the layer** from what it actually published, so there is no reason to `stat()` afterwards or to trust a size you were handed; and on failure `put()` **destroys the source stream** before calling back, so a failed store leaves you no stream to clean up. The temp file itself is yours — the layer copies out of it and never assumes it may delete it.

If you hold the bytes in memory rather than on disk, wrap them the same way: `require('stream').Readable.from([buffer])`.

### Keys are opaque

`put()` returns a key. Store it, pass it around, hand it back to `get()` — but never parse it, build one by hand, or assume it encodes a date or a filename. That opacity is what allows a future strategy to change the layout without breaking anything already stored.

The client's filename never becomes the path. It is kept verbatim in the metadata row, and under `sharded` only a hard-whitelisted extension (alphanumerics, at most ten characters, lowercased) is appended to the key — enough for an operator browsing the tree to tell a PDF from a PNG. Under [`cas`](#content-addressed-storage-cas), keys carry **no extension at all**: identical bytes uploaded under different names must mint the same key for deduplication to work, so the content type lives in the metadata row alone.

---

## The full contract

| Method | Returns | Notes |
| --- | --- | --- |
| `put(stream, meta, cb)` | `{key, size, contentType}` | `size` is measured by the layer from the published bytes, never taken from the client. Under `cas` the result also carries `deduplicated` — `true` when identical content already existed. |
| `get(key, cb)` | a readable stream | **Errors** on an unknown key — a caller wanting bytes has no use for a null stream. Serves both tiers. |
| `getRange(key, start, end, cb)` | a readable stream | A byte range, `end` **inclusive** (as in the HTTP header). An `end` past the last byte is clamped; only a `start` at or beyond the object's size errors — that is your `416`. Serves both tiers. Gated by `capabilities.ranges`, true on every local driver. |
| `stat(key, cb)` | metadata, or `null` | `null` (not an error) when the key is unknown. This is the existence question. Never includes payload bytes. Under `cas` it includes `refs`, the live reference count. |
| `release(key, cb)` | `existed` | Under `sharded`: removes the object and its metadata row. Under `cas`: **drops one reference** — bytes are only reclaimed by the [sweep](#content-addressed-storage-cas). Idempotent either way. |
| `resolve(key, cb)` | `{kind: 'path', path}` or `{kind: 'inline'}` | How to serve the object. Branch on `kind` — an inline object has no path; stream it through `get()`. |
| `findByDigest(algo, hex, cb)` | a key, or `null` | **cas only** — gated by `capabilities.dedup`. The pre-upload existence check; see [the oracle caution](#content-addressed-storage-cas). |
| `createUpload(meta, cb)` | `{uploadId, chunkSize, expectedSize}` | **stream only** — gated by `capabilities.resumable`. Opens a [resumable session](#large-media-and-resumable-uploads-stream). `meta.expectedSize` is **required**. |
| `writeSegment(id, offset, stream, cb)` | `{offset, length, received}` | **stream only.** Writes one segment at a byte offset. Segments may arrive out of order; re-sending a covered range is harmless. |
| `statUpload(id, cb)` | upload state | **stream only.** `{expectedSize, received[], missing[], complete, …}` — the resumable twin of `stat()`, and what makes resuming possible. |
| `finalize(id, cb)` | `{key, size, contentType}` | **stream only.** Verifies coverage and publishes. Refuses a gap and keeps the session alive. Idempotent. |
| `abortUpload(id, cb)` | `{aborted}` | **stream only.** Discards a session. Idempotent. |
| `capabilities` | an object | What this driver can do. |

```javascript
gina.storage().stat(key, function (err, meta) {
    if (!meta) { return self.throwError(404); }
    // meta => { originalName, contentType, size, createdAt }
});
```

### Branch on `capabilities`, do not assume

```javascript
var driver = gina.storage();
if (driver.capabilities.ranges) {
    // Range requests will be answered with 206 — see "Serving objects over HTTP"
}
```

`inline` is `true` when the driver's [size tiering](#size-tiering) is active — meaning `resolve()` may answer `{kind: 'inline'}`. `dedup` is `true` on a [`cas`](#content-addressed-storage-cas) driver and is what gates `findByDigest()`. `resumable` is `true` on a [`stream`](#large-media-and-resumable-uploads-stream) driver and is what gates the five session verbs. `ranges` is `true` on every local driver, because all three strategies implement `getRange()`.

:::info `ranges` is consumed by the framework
`capabilities.ranges` says the driver can return a byte range — and [`self.serveFromStorage()`](#serving-objects-over-http) consumes it: when the flag is `true`, HTTP `Range` requests are answered with `206`/`416` and `Accept-Ranges`; when `false`, the header is transparently ignored and the full `200` is served. Reach for raw `getRange()` only when you want custom protocol handling.
:::

`offload` is `false` everywhere in this release — no X-Accel / X-Sendfile handling exists in either engine, so you stream the bytes yourself — and flips with the `s3` adapter; code that branches now keeps working when it does.

---

## Serving objects over HTTP

`self.serveFromStorage(driverName, key[, opts])` serves a stored object as the HTTP response with the protocol handled for you, identically on both engines: strong validators, conditional GET, and full single-range `Range` support.

```javascript
// GET /files/:id — Range, 304 and HEAD all handled for free
this.download = function (req, res) {
    var self = this;
    var doc  = getDocFromDb(req.params.id);   // { storageKey, mime }
    self.serveFromStorage('media', doc.storageKey, { contentType: doc.mime });
};
```

The method is **terminal** — it renders the bytes (or a 304/416, or a 404/500 through `throwError`) and ends the response. Do not render after it.

```mermaid
flowchart LR
    A[request] --> B{stat key}
    B -- "null" --> N404[404]
    B -- "meta" --> C{If-None-Match<br/>matches the ETag?}
    C -- "yes" --> N304[304 — no read]
    C -- "no" --> D{Range header,<br/>capabilities.ranges?}
    D -- "none / ignored" --> F["get() → 200, full body"]
    D -- "unsatisfiable" --> N416["416 + bytes */size"]
    D -- "satisfiable" --> E["getRange() → 206 + Content-Range"]
```

What one call gives you:

| Concern | Behaviour |
| --- | --- |
| Existence | `stat()`-gated: an unknown or released key answers **404**. A missing *driver* is an app config error and answers **500**, never 404. |
| Validators | `ETag: "<key>"` — deliberately **strong**, because storage keys are immutable (every strategy publishes by temp-and-rename; nothing mutates in place) — plus `Last-Modified` from the publish time. |
| Conditional GET | `If-None-Match` matching the key ETag answers **304** with no driver read at all. |
| Range | A single `bytes=` range (`a-b`, `a-`, `-n`) answers **206** with `Content-Range` and an exact `Content-Length`, read through `getRange()`. Unsatisfiable → **416** with `Content-Range: bytes */<size>`. Multi-range lists, other units and malformed values are ignored into the full **200**, which RFC 9110 allows. `Accept-Ranges: bytes` is advertised whenever `capabilities.ranges` is true. |
| `If-Range` | Honoured only on an exact validator match; anything else degrades to the full 200 — fail-safe, so an interrupted download never resumes against different bytes. |
| HEAD | Headers only — full-size accounting, no driver read, no body. |
| Caching | `Cache-Control: private, max-age=31536000, immutable` by default — a key's bytes can never change, and `private` keeps shared caches out of your authorization. Override verbatim with `opts.cacheControl`. |

### Options

| Key | Effect |
| --- | --- |
| `contentType` | Served verbatim — your informed choice, bypassing the downgrade below. |
| `cacheControl` | Replaces the immutable caching default, verbatim. |
| `download` | `true` emits `Content-Disposition: attachment` (the stored `originalName` by default, control characters stripped). |
| `filename` | The attachment filename (implies `download`). |

:::caution The stored contentType is uploader-supplied
`stat()` hands back whatever MIME type the uploader declared, verbatim. Serving `text/html` or `image/svg+xml` back on your own origin is a stored-XSS vector — and `nosniff` does not stop a *declared* type from rendering. So without an explicit `opts.contentType`, active-content types (`html`, `xml`, `svg`, `javascript`) are downgraded to `application/octet-stream`, and every response carries `X-Content-Type-Options: nosniff`. Pass `opts.contentType` once you have validated the type yourself.
:::

Under [`cas`](#content-addressed-storage-cas), a partially-downloaded object stays valid indefinitely — the key is a content address — which is exactly what the immutable cache default and the strong ETag lean on.

---

## Binding upload groups

Server-generated files are one producer. The other is uploads — and an upload
group can publish straight into a driver instead of being moved to a directory.
Add a `driver` to the group:

```json title="config/settings.json"
"upload": {
  "groups": {
    "avatars": {
      "allowedExtensions": ["jpg", "jpeg", "png"],
      "driver": "assets"
    }
  }
}
```

`self.store()` then partitions the call: files in that group publish through the
driver and come back with an opaque `key` (plus `group`, `driver` and the
layer's on-disk `size`) instead of a `filename`, while files in groups without a
`driver` keep the historical move behaviour. A single call can carry both.

```js
self.store(targetDir, req.files, function(err, files) {
  if (err) { return self.throwError(500, err); }
  // routed:  { file, group, driver, key, size, type, encoding }
  // moved:   { file, filename, size, type, encoding }
});
```

`targetDir` may be `null` when every file in the call routes to a driver.

Two boot-time checks apply, so a misconfiguration surfaces at startup rather
than on the first upload: a group naming a driver that is not declared in
`storage.drivers` refuses the boot (as does any `driver` binding when there is
no `storage` block at all), and a group whose staging `path` sits inside its
driver's own `root` earns a warning — files staged there are stranded with no
key referencing them. Keeping `path` alongside `driver` is otherwise perfectly
valid: for a routed group it only names the parse-time staging directory.

:::note One driver set per process
Drivers are resolved from the **starting app's** `storage` block, and that set
is process-wide. When several bundles run merged into one process, every
bundle's upload groups validate against that same set of drivers — so a group in
bundle B naming a driver only bundle B declares will not resolve unless the
starting app declares it too.
:::

The full upload-side reference — group rules, ordering, failure semantics —
lives in the [file uploads guide](/guides/file-uploads#routing-a-group-to-a-storage-driver).

---

## Size tiering

Below a threshold, per-file overhead — inode, block allocation, the syscalls around open and rename — costs more than the payload itself. So objects **strictly under** a driver's `inlineThreshold` are stored *inline*: their bytes land in the metadata store as part of a single transaction, with no temp file, no directories, no filesystem round-trip. At or above the threshold, objects take the file path described above.

The default is `"64KB"`, and it is a measured number, not folklore: on the embedded store, inline writes are 2.7–13× faster than per-file writes at and below that size, and the advantage disappears above it. Set `"0B"` to turn tiering off for a driver, or raise the threshold for a metadata backend that handles larger blobs well.

Nothing else about the driver changes:

- **Keys look the same in both tiers** — still opaque, still date-ordered.
- **`get()`, `stat()` and `release()` behave identically** for inline and file-backed objects.
- **`resolve()` is where the tier shows**: `{kind: 'inline'}` instead of `{kind: 'path'}`, because an inline object has no file to hand to a sendfile-style offload — stream it through `get()`.
- **Changing the threshold is safe at any time.** Reads follow where each object's bytes actually live, so existing objects stay readable on either side of a new threshold; only new writes are placed by it. A metadata database created before tiering existed is migrated in place at open.

Two operational tradeoffs, stated plainly:

- **Sub-threshold objects are not individually visible on disk.** The "SSH in and find the file by date" property of the `sharded` layout holds only for objects at or above the threshold. If your operations depend on every object being a browsable file, set `"0B"`.
- **The metadata store carries their bytes.** Losing `<root>/.meta.db` loses inline objects themselves, not just their metadata — file-backed bytes survive an index loss. The embedded database lives inside the driver root, so any backup of the root already includes it; on a connector-backed store, the payloads land in that backend and follow *its* durability story.

---

## Content-addressed storage (cas)

For immutable content — invoices, receipts, signed documents, anything where "has this exact file been stored already?" is a meaningful question — declare `strategy: "cas"`:

```json
"drivers": {
  "invoices": {
    "adapter": "local",
    "strategy": "cas",
    "root": "/var/data/invoices",
    "maxObjectSize": "50MB"
  }
}
```

The key **is** the content address: `blobs/<algo>/<aa>/<bb>/<hex>`, derived from the object's digest and nothing else. Storing identical bytes twice yields the *same key* and *no second copy* — the blob gains a reference instead, and the second `put()`'s result says so:

```javascript
gina.storage('invoices').put(pdf, { originalName: 'invoice-991.pdf' }, function (err, res) {
    // res => { key, size, contentType, deduplicated }
    // deduplicated: true  => identical content already existed; no new bytes were stored
});
```

```mermaid
flowchart LR
    A[put stream] --> B[hash chunk by chunk<br/>while writing]
    B --> C{content already<br/>stored?}
    C -- no --> D[fsync + rename<br/>into the blob tree]
    C -- yes --> E[discard this copy<br/>count one more reference]
    D --> F["{key, deduplicated: false}"]
    E --> G["{key, deduplicated: true}"]
```

Because keys are content addresses, they carry **no extension** and metadata is **first-write-wins**: two uploads of identical bytes under different filenames share one row, which keeps the first `originalName` and `contentType`. And because a content address can never go stale, cas objects are ideal for `Cache-Control: immutable` serving with the key as the ETag.

Keys remain [opaque](#keys-are-opaque) even though cas keys *look* parseable — composing one by hand breaks the moment the layout changes. The one sanctioned way from a digest to a key is `findByDigest`:

```javascript
// the client hashed the file locally and asks before uploading
driver.findByDigest('sha256', clientHexDigest, function (err, key) {
    if (key) { /* already stored — skip the transfer entirely */ }
});
```

:::caution findByDigest is a dedup oracle
An answer to "do you already have this exact content?" tells the asker whether *someone* has stored that file before — across users, that is an information leak. gina ships **no HTTP endpoint** for it: if you expose one, you own its authentication, and you should scope what it reveals per driver (a single-tenant archive leaks nothing; a shared upload pool does).
:::

### Releasing and the sweep

`release()` on a cas driver **drops one reference** — it never deletes bytes. A blob whose count reaches zero is stamped and left in place for a grace window (`sweepGrace`, default `"1h"`); a periodic sweep (`sweepInterval`, default `"15m"`) then reclaims blobs that have sat at zero past the grace. Three consequences worth knowing:

- **Re-uploading just-released content is free.** Within the grace window the blob is still there; an identical `put()` resurrects it without transferring anything twice.
- **A fully-released key reads as gone immediately.** `stat()` answers `null`, `get()` errors — the grace window is a garbage-collection detail, not a visible afterlife.
- **The grace window is a correctness margin, not a convenience.** It is what keeps the sweep from racing an in-flight identical upload. Do not set it lower than your longest plausible upload.

### Changing the digest algorithm — cheap. Changing the strategy — not.

The algorithm's name is a namespace segment in every key, so changing `hash` (say `sha256` → `sha512`) is **additive**: existing blobs stay addressable — and `findByDigest`-able — under their original algorithm, new writes land under the new one, and dedup simply does not span the two. The boot notes the change once and moves on.

Changing a driver's **strategy** on populated storage is a different animal: keys are strategy-specific, so every stored reference would dangle. The boot stamps each driver root with its strategy on first start and **warns on every boot** while a mismatch stands — the fix is a re-key migration, never a config edit. This stamp check applies to `sharded` drivers too.

### What cas is not for

Content addressing makes in-place mutation impossible — editing produces a new blob under a new key, and your reference updates or the old content stays. That is exactly right for legally-immutable documents and exactly wrong for anything with random writes; use `sharded` there.

---

## Large media and resumable uploads (`stream`)

The `stream` strategy is for content too big to send in one go: video, audio, large archives — anything where a dropped connection halfway through should not mean starting over.

```json
// settings.json
"storage": {
  "default": "media",
  "drivers": {
    "media": {
      "adapter": "local",
      "strategy": "stream",
      "root": "/var/data/media",
      "maxObjectSize": "5GB",
      "chunkSize": "8MB"
    }
  }
}
```

A `stream` key names an **asset**, not a file — `assets/<ulid>/original.mp4` — so the object and anything later derived from it live in one directory you can move, back up or delete as a unit. (Renditions beside `original` are [not in this release](#what-is-not-in-this-release); the layout reserves the room.) Keys stay opaque, exactly as under the other strategies.

`put()` works here as everywhere, for content you can send in one request. What `stream` adds is the resumable path.

### Resumable uploads

Five verbs, gated by `capabilities.resumable`:

```javascript
var driver = gina.storage('media');

// 1. open a session — expectedSize is REQUIRED
driver.createUpload({
    expectedSize : 4294967296,
    originalName : 'talk.mp4',
    contentType  : 'video/mp4'
}, function (err, session) {
    // session => { uploadId, chunkSize, expectedSize }
});

// 2. send segments — any order, in parallel, resumable
driver.writeSegment(uploadId, 8388608, req, function (err, r) {
    // r => { offset, length, received }
});

// 3. ask what is still missing (after a reconnect, say)
driver.statUpload(uploadId, function (err, state) {
    // state => { expectedSize, received: [...], missing: [...], complete, … }
});

// 4. publish
driver.finalize(uploadId, function (err, res) {
    // res => { key, size, contentType } — the same shape put() returns
});

// …or throw the session away
driver.abortUpload(uploadId, function (err, r) { /* r => { aborted } */ });
```

Segments are written **at their byte offset**, straight into the file being assembled, so they may arrive out of order or in parallel and no assembly pass runs at the end. Re-sending a range that already landed is harmless, and overlapping re-sends are fine. A session's state lives in the driver root rather than in memory, so it survives a bundle restart — `statUpload()` answers correctly afterwards.

:::info `expectedSize` is required, and that is deliberate
Without a declared total, nothing can verify that the ranges you sent actually **cover** the object, and `statUpload()` could only report what arrived — never what is missing. Uploading content whose size you do not know is what `put()` is for. (Equivalent wire protocols agree: `tus` requires `Upload-Length` unless a server opts into a separate extension, and S3 multipart can never tell you which part is missing because it never learns the total.)
:::

`expectedSize` also lets gina refuse an oversized upload before a single byte moves. That check is a courtesy, not the enforcement: the value comes from the client, so a segment that runs past the declared total is refused as it is written.

### Why finalise can refuse

`finalize()` merges the ranges it has actually made durable and requires them to cover `[0, expectedSize)` exactly. A gap is a real error, and the session is **kept alive** so the client can send what is missing and try again.

That check is the whole safety story, and it is worth knowing why it is stricter than it looks. An unwritten range in a partly-filled file does not fail on read — it returns **zeros**. So a finalise that simply added up the bytes it received would happily publish an object that looks complete and is quietly wrong: two segments overlapping in the middle can add up to the full size while leaving the tail untouched. Merging the ranges catches that; summing them does not.

If `finalize()` publishes the bytes but then fails to write the metadata row, call it again — it detects the published object, completes the row and cleans up. Do not call `writeSegment()` for a session while `finalize()` is running on it; one actor per finalise.

### Durability of a resumable upload

Each segment is flushed to disk **before** it is recorded as durable, so a client is never told a range is safe when it is not — that is the contract `statUpload()` rests on. `fsync: true` is the default here for that reason.

The cost is proportional to how fast the bytes arrive: measured, that flush is about 2% of the time an 8MB segment takes to cross a 100 Mbps link, but it dominates on a 10 Gbps LAN. If you are ingesting over a fast local network and can accept losing the last few segments' durability claim to a power cut, set `fsync: false`.

:::note gina cannot defragment
An earlier design called for preallocating the file. Node exposes no `fallocate`, and the available fallback produces a *sparse* file that reserves nothing — so gina neither prevents fragmentation nor can pretend to. Contiguity is a filesystem and volume concern (XFS extent hints and the like). What the per-asset directory buys is **operational** grouping, not physical locality.
:::

### Abandoned sessions

A client that simply goes away leaves a session holding real disk. Each `stream` driver reclaims sessions untouched for longer than `sessionTtl` (default `"24h"`), sweeping at boot and every `sessionSweepInterval` (default `"1h"`) — the same pass also clears temp files from a crashed `put()`. Liveness is measured from the file being assembled, so a long, slow upload is never mistaken for an abandoned one.

### Several processes, one session

Writing disjoint ranges of one session from several processes is safe on a POSIX-coherent filesystem. On a network mount with relaxed coherence, route a given session's segments to a single process — nothing in the driver enforces that, and it has not been measured there.

Finally: `stream` neither tiers nor hashes. `inlineThreshold` and `hash` on a `stream` driver are reported as ignored keys rather than silently doing nothing, and `capabilities.inline` and `capabilities.dedup` are `false` by design rather than pending.

---

## Metadata: embedded by default, pluggable when you need it

Each object gets a metadata row — original name, content type, size, creation time, and, for inline objects, the payload itself — which is what `stat()` (minus the payload) reads. By default that lives in an embedded SQLite file inside the driver root (`<root>/.meta.db`), so moving or backing up the root moves its metadata with it.

That default is **single-process per driver root**. SQLite's locking is unreliable on a shared network filesystem, so if two bundles, or several replicas, share one root, point the driver at a connector instead:

```json
// settings.json
"storage": {
  "drivers": {
    "assets": {
      "adapter": "local",
      "strategy": "sharded",
      "root": "/mnt/shared/assets",
      "store": "assetsMeta"
    }
  }
}
```

```json
// connectors.json
{
  "assetsMeta": {
    "connector": "couchbase",
    "protocol": "couchbase://",
    "host": "db1.internal",
    "username": "gina",
    "password": "${secret:CB_PASSWORD}",
    "database": "gina_storage"
  }
}
```

:::info Couchbase is the connector store that ships today
Other backends stay demand-gated: naming one refuses the boot with a clear message rather than falling back silently. If you need a different one, open an issue describing it.
:::

A store backing a **cas** driver additionally implements the four refcount verbs (`acquireRef` / `releaseRef` / `listZeroRefs` / `removeIfZero`) — the embedded store does, migrating pre-cas databases in place; a cas driver refuses to boot over a store that does not. Each verb must be atomic per key: that atomicity is what makes two concurrent identical uploads yield one blob with two references instead of a lost update.

### The couchbase store

Requires the `couchbase` SDK (major 3 or 4) in **your** project — the framework
declares no dependency on it — and reads the connector's usual keys, where
`database` is the **bucket** name. Optional: `scope` and `collection` (both
`_default`), `prefix` (`stor:`), and `durability`.

Each metadata row is one JSON document keyed `<prefix><driver>:<key>`. **The
driver name namespaces every row**, so several drivers may share one
`connectors.json` entry without colliding — which matters under `cas`, where
keys are content-derived and therefore identical across drivers storing the
same bytes.

Per-key atomicity comes from Couchbase's own CAS: each refcount verb reads the
document and writes it back with a compare-and-set guard, retrying a bounded
number of times if another writer got there first. That is also why **no sweep
election is needed** when several replicas run the GC concurrently — the claim
step is itself compare-and-set, so exactly one sweeper collects each blob and
the others simply skip it.

Two things worth knowing before you deploy it:

- **Inline payloads are stored base64-encoded inside the JSON document**, not
  as binary document bodies — Couchbase cannot index or query a binary value,
  and the maintenance verbs need to query. Budget the +33%: with the default
  64KB tiering threshold a row is about 85KB, comfortably under Couchbase's
  20MB document limit, but an `inlineThreshold` above roughly 14MB will not
  fit.
- **Two secondary indexes back the maintenance verbs.** The store creates them
  at boot when they are missing:

  ```sql
  CREATE INDEX `gina_storage_refs` ON `bucket`.`scope`.`collection`(d, refs, zeroAt);
  CREATE INDEX `gina_storage_keys` ON `bucket`.`scope`.`collection`(d, k);
  ```

  If the account cannot create indexes, that is not fatal — but run the two
  statements by hand, because Couchbase *errors* on an unindexed query rather
  than merely running it slowly, which would leave the GC sweep failing
  silently. The store logs the exact statement to run in that case.

Mutations use the SDK's default durability unless you set `durability` to
`majority`, `majorityAndPersistToActive` or `persistToMajority`. The default is
the same honesty class as the embedded store's WAL setting: a crash can lose the
most recently acknowledged write. Couchbase failover can lose durably-written
data too, and the two directions are not symmetric — a lost `acquireRef`
undercounts (the grace window and `storage:verify` catch it), while a lost
`releaseRef` overcounts and that blob is never collected.

---

## Durability, stated plainly

For file-backed objects, `rename(2)` guarantees that a reader never observes a partial object — under every strategy. What differs is crash durability:

- **`sharded` writes are not `fsync`ed.** An acknowledged write can still be lost if the machine loses power before the filesystem flushes. Recent writes at risk, never a partial object.
- **`cas` publishes are `fsync`ed by default** (`fsync: true`): the temp file is flushed *before* the rename publishes it — a flush failure fails the `put()` — and the parent directory is flushed after, **best-effort**: platforms that cannot fsync a directory (Windows; some network mounts) skip that half silently, and macOS honours `fsync` as the platform defines it. cas exists for immutable content where "acknowledged means durable" is the point; set `fsync: false` per driver to opt back into sharded-class durability.
- **`stream` fsyncs by default too**, and additionally flushes **each resumable segment before recording it as durable** — that ordering is what lets a client trust `statUpload()`. See [Durability of a resumable upload](#durability-of-a-resumable-upload) for when to turn it off.

Inline objects (`sharded` or `cas` — `stream` never inlines) are in the sharded class: the embedded store runs SQLite in WAL mode with `synchronous=NORMAL`, so a crash can lose the most recent committed transaction but never yields a torn row. If your retention requirements are stricter than all of this, replicate to durable storage rather than relying on the local adapter alone.

---

## Maintenance: stats, gc and verify

Three CLI commands operate a bundle's storage, each following the cache-command
grammar (`<bundle> @<project>`, or `@<project>` alone for every bundle;
`--driver=<name>` to scope one driver; `--format=json` for scripting):

```bash
gina storage:stats  api @myproject             # per-driver counts and bytes
gina storage:gc     api @myproject             # run the cas sweep now, to drained
gina storage:gc     api @myproject --dry-run   # list what a pass would collect
gina storage:verify api @myproject             # files ↔ metadata consistency scan
gina storage:verify api @myproject --fix       # also scrub orphaned files (bundle stopped)
```

**Who does the work depends on who owns the store.** The embedded metadata
store is single-process per driver root, so the CLI never opens a store a
running bundle owns:

- **Bundle running** — the command calls the bundle's own admin-gated
  `/_gina/storage/stats`, `/_gina/storage/gc` (POST) or
  `/_gina/storage/verify` endpoint, and the owning process does the work.
  The endpoints are always-on and gated by `app.json > admin.allowFrom`
  (loopback by default) — the same allowlist as `/_gina/info` and
  `/_gina/cache/stats`.
- **Bundle stopped** (every assigned port refuses the connection) — the
  command resolves the bundle's `settings.storage` and opens the store
  directly, offline.
- **Anything else** — a timeout, an unexpected socket error — is reported as
  unknown and the store is **not** opened: the bundle may still be alive and
  owning it.

A driver backed by a connector `store` has nothing local to open, so it is
reachable through the running bundle only.

`storage:stats` reports, per driver, the identity (strategy, root,
capabilities) plus the metadata store's counts: total objects, refcounted
(cas) objects, zero-reference blobs awaiting the sweep, inline (size-tiered)
objects, and total logical bytes — a deduplicated blob counts once.

`storage:gc` drives the cas sweep immediately instead of waiting for the next
`sweepInterval` tick, looping until nothing older than `sweepGrace` remains.
`--dry-run` lists the collectable blobs and touches nothing. `sharded` and
`stream` drivers have no sweep *here* and are named and skipped, never an error
— a `stream` driver does reclaim abandoned upload sessions, but on its own
schedule rather than through this command.

`storage:verify` walks the blob tree against the metadata rows and reports two
finding classes — deliberately asymmetric:

- **Files without rows** — the sweep's documented crash residue (a blob file
  whose row was already claimed). Harmless and invisible to every read verb;
  `--fix` unlinks them, and only offline: `--fix` is refused while the bundle
  runs, and the HTTP endpoint does not even accept a fix flag.
- **Rows without files** — a referenced object whose bytes are gone. That is
  **loss evidence**: it is reported and never auto-fixed, because deleting
  the row would destroy the only signal that content vanished.

Both directions are age-gated past `sweepGrace`, so in-flight uploads are
never reported as findings. A root shared by several bundles appears under
each of them; `gc` and `verify` against a shared root are idempotent — the
same result from whichever bundle you point at.

---

## What is not in this release

| Not yet | What it will bring |
| --- | --- |
| `s3` adapter | Object-store backend; its client stays a project-side dependency. Brings `resolve()` → `{kind: 'url'}`, presigned URLs and `capabilities.offload`. |
| Renditions | A `putRendition()` API for transcoded variants. The [`stream`](#large-media-and-resumable-uploads-stream) key layout already reserves the room beside `original`; there is no API yet. |
| Stream maintenance | `storage:gc` and `storage:verify` support for `stream` — orphaned upload sessions and objects orphaned by a failed post-publish row write. A `stream` driver reclaims abandoned sessions on its own schedule; what is missing is an operator door and a consistency scan. |
| `storage:migrate` | Strategy/hash re-key tooling for populated roots. |

Uploads that are **not** routed to a driver are unaffected — [`self.store()`](/guides/file-uploads) keeps its existing behaviour byte-for-byte for them. See [Binding upload groups](#binding-upload-groups) for routing one.

Every strategy named in the design now ships. A strategy name gina does not recognise refuses the boot as a typo, naming the ones it does.
