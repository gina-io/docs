---
title: File uploads
sidebar_label: File uploads
sidebar_position: 3.6
description: Handle file uploads in Gina — multipart requests stream each file to disk and arrive as req.files, you persist them with self.store(), constrain them with upload groups in settings.json, and the data-gina-form-upload-* client layer adds staged uploads with image previews.
level: intermediate
prereqs:
  - '[Controllers](/guides/controller)'
  - '[Forms and Validation](/guides/forms-and-validation)'
  - '[settings.json](/reference/settings)'
---

# File uploads

A file upload in Gina is an ordinary `multipart/form-data` request. The server
streams each uploaded file to a temporary file on disk and hands your controller
an array, `req.files`. From there you decide where the files live by calling
`self.store()`.

There are **two ways** to drive that, and you can use either on its own:

- **A plain multipart form** — a normal `<form enctype="multipart/form-data">`
  posts its files, your controller reads `req.files` and persists them. Nothing
  client-side to wire. This is the whole story for simple uploads.
- **The `data-gina-form-upload-*` client layer** — richer UX: the file uploads
  to a temporary endpoint the moment it is selected, an image preview appears,
  and each file gets its own reset/delete control. It is opt-in and needs a
  couple of routes you provide.

The server side (`req.files` + `self.store()` + upload groups) is the same for
both. Start there.

---

## Receiving uploads in a controller

When a request arrives as `multipart/form-data`, Gina parses it with a streaming
parser: every file part is written to a temporary file as it arrives (files are
**not** buffered in memory), and the finished list is attached to the request as
`req.files` before your controller action runs.

```mermaid
flowchart LR
    A["multipart/form-data<br/>request"] --> B["Each file part<br/>streamed to a temp file"]
    B --> C["req.files = [ … ]"]
    C --> D["Controller action runs"]
    D --> E["self.store(dir)<br/>moves files to their home"]
```

`req.files` is an **array**; each entry describes one uploaded file:

| Field | What it is |
|---|---|
| `name` | The form field name the file came from. |
| `originalFilename` | The filename as the client sent it. |
| `type` | The MIME type (e.g. `image/png`). |
| `size` | Size in bytes. |
| `encoding` | The part's transfer encoding. |
| `group` | The upload group the part was tagged with (see [Configuring uploads](#configuring-uploads)). |
| `path` | The absolute path of the **temporary** file on disk. |

A minimal controller that accepts an upload and moves it into place:

```js
// src/myapp/controllers/controller.media.js
this.upload = function(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return self.throwError(res, 400, 'No file uploaded');
  }

  // Move the temp files into a permanent directory, then respond.
  self.store(getPath('myapp') + '/var/uploads').onComplete(function(err, files) {
    if (err) {
      return self.throwError(res, 500, err.message);
    }
    self.renderJSON({ status: 200, files: files });
  });
};
```

:::note Text fields arrive too
Text inputs in the same `multipart/form-data` request land on `req.body` —
and, on POST, PUT and PATCH, on the method slot (`req.post` / `req.put` /
`req.patch`) — alongside `req.files`, for every client (a plain HTML form,
`curl`, the gina client). Values are kept **verbatim** (no url-decoding, no
`"true"`/`"false"`/`"on"`/`"null"` coercion — the same contract as
`application/json` bodies), bracket-notation names are nested
(`item[0][id]` → `{ item: [ { id: "…" } ] }`), and a duplicated plain name
keeps its last value. The capture is capped by two `upload` settings —
[`maxTextFields` and `maxTextFieldSize`](#configuring-uploads) — and a request
that breaches either is rejected with **HTTP 400** rather than silently losing
data. *New in 0.5.16 — earlier versions drop non-file parts entirely, leaving
`req.post` and `req.body` empty on multipart routes.*
:::

---

## Persisting files — `self.store()`

Uploaded files start life in a temporary directory, so you must move them
somewhere permanent. `self.store(targetDir)` does that: it creates `targetDir`
if needed, moves every file in `req.files` into it (keeping each file's original
name), and reports back.

Two call shapes:

```js
// 1) Fluent — store everything currently in req.files:
self.store(targetDir).onComplete(function(err, files) {
  // err is false on success; files is the stored list (see below)
});

// 2) Explicit — pass the file list and a node-style callback:
self.store(targetDir, req.files, function(err, files) { /* … */ });
```

On success `err` is `false` and `files` is an array describing what was stored:

| Field | What it is |
|---|---|
| `file` | The stored file's name. |
| `filename` | The absolute path of the stored file. |
| `size` | Size in bytes. |
| `type` | The MIME type. |
| `encoding` | The part's transfer encoding. |

:::note `store()` moves; it does not validate
`self.store()` does no size, extension, or count checking — it just relocates
the temp files. Those constraints are enforced earlier, at parse time, from your
upload-group configuration (next section). Validate anything else (ownership,
business rules) in your action before or after the move.
:::

---

## Configuring uploads

Upload behaviour is configured in your bundle's `settings.json`, under the
`upload` key:

```json title="config/settings.json"
"upload": {
  "encoding": "utf8",
  "maxFieldsSize": "2MB",
  "groups": {
    "avatars": {
      "allowedExtensions": ["jpg", "jpeg", "png", "svg"],
      "isMultipleAllowed": false
    },
    "documents": {
      "allowedExtensions": ["pdf"],
      "isMultipleAllowed": true
    }
  }
}
```

| Key | Effect |
|---|---|
| `tmpPath` | Directory each uploaded file streams to. The default resolves to `<project>/tmp`; a per-group `path` overrides it. A configured directory is created automatically if it does not exist. |
| `maxFieldsSize` | Maximum size of the **whole request**. Accepts a unit suffix — `B`, `KB`, `MB`, `GB` (a bare number is read as MB, e.g. `"2MB"`). A request larger than this is rejected with **HTTP 431** before any file is read. |
| `maxFields` | Maximum number of files accepted in a single request. A request carrying more is rejected with **HTTP 400**. Set `0` (or omit) to disable the cap. |
| `maxTextFields` | Maximum number of **text (non-file) fields** accepted in a multipart request. Defaults to `1000`; a request carrying more is rejected with **HTTP 400**. Set `0` to disable the cap. *New in 0.5.16.* |
| `maxTextFieldSize` | Size cap for **each text field's value**. Same unit suffixes as `maxFieldsSize` (a bare number is read as MB); defaults to `"1MB"`. A field exceeding it is rejected with **HTTP 400**. Set `0` to disable the cap. *New in 0.5.16.* |
| `groups` | Named upload groups. A file is checked against its group's rules at parse time. |
| `groups.<name>.path` | Directory for this group's files, overriding the global `tmpPath`. Created automatically if missing. |
| `groups.<name>.allowedExtensions` | An array of permitted extensions (e.g. `["jpg","png"]`), or `"*"` for any. A disallowed extension is rejected with **HTTP 400**. |
| `groups.<name>.isMultipleAllowed` | When `false`, a request carrying more than one file for that group is rejected with **HTTP 400**. |

A file is tagged with a group on the client via
`data-gina-form-upload-group` (see below); on the wire the group travels in each
multipart part. **Every file must map to a configured group:** a file with no
group falls back to the default `untagged` group, and a group that is not declared
in `groups` is rejected with **HTTP 400**. Each group's `allowedExtensions` and
`isMultipleAllowed` are then enforced — `untagged` included.

```mermaid
flowchart TD
    A["File part arrives<br/>(group, or none → untagged)"] --> B{"Request size ><br/>maxFieldsSize?"}
    B -->|yes| C["HTTP 431"]
    B -->|no| D{"Group configured<br/>in settings groups?"}
    D -->|no| X["HTTP 400<br/>(unconfigured group)"]
    D -->|yes| E{"Extension allowed?"}
    E -->|no| F["HTTP 400"]
    E -->|yes| G{"Multiple ok<br/>for this group?"}
    G -->|no| F
    G -->|yes| H["Streamed to temp"]
```

### Probing the write-error crash-guard

If a file's write stream fails mid-stream — a full disk, a revoked permission — Gina
answers a guarded **HTTP 500** for that one request and keeps the bundle running. To
re-confirm this on your own upload surface after an upgrade (without engineering a real
disk-full or an unwritable directory, both of which affect your real uploads), add a
`simulateWriteError` flag to a throwaway group:

```json title="config/settings.json"
"upload": {
  "groups": {
    "_probe_fail": {
      "path": "${tmpPath}",
      "allowedExtensions": "*",
      "isMultipleAllowed": true,
      "simulateWriteError": true
    }
  }
}
```

Every upload tagged with that group now fails with the guarded 500 — no full disk or
unwritable directory needed, and nothing about your real uploads changes. The flag is
**honoured outside production scope only**: in `production` scope it is ignored, and a
boot warning names it either way so it can never ship silently.

:::note The group tag rides a Content-Disposition parameter
The `group="…"` tag travels as a **Content-Disposition parameter**, which `curl -F` and
browser `FormData` cannot set — so a faithful probe has to hand-build the multipart
body. For example:

```
------gina-probe
Content-Disposition: form-data; name="files"; group="_probe_fail"; filename="probe.bin"
Content-Type: application/octet-stream

any bytes here
------gina-probe--
```

Send that body with `Content-Type: multipart/form-data; boundary=----gina-probe` and
expect a `500` response. Because the write stream is opened before the simulated
failure, a probe may leave a 0-byte temp file — point the probe group's `path` at a
temp directory.
:::

Remove the probe group before shipping to production; if you forget, the flag stays
inert there and the boot warning flags it.

---

## The client upload layer

The `data-gina-form-upload-*` attributes turn a plain `<input type="file">` into
a staged uploader: the file is sent to a temporary endpoint **as soon as it is
chosen**, a preview appears, and hidden metadata fields are written into your
real form so its eventual submit carries only lightweight references — not the
binary. (Before 0.5.16 this was also the only way to keep text fields alongside
an upload, because multipart requests dropped non-file parts. Those fields are
[captured now](#receiving-uploads-in-a-controller), so the staging layer is
about UX — previews, per-file removal, a lightweight final submit — not field
survival.)

```mermaid
flowchart TD
    A["User picks a file"] --> B["Client builds a virtual<br/>multipart form, POSTs the file<br/>to data-gina-form-upload-action"]
    B --> C["Your staging route stores it<br/>and returns JSON metadata"]
    C --> D["Preview rendered from the<br/>returned tmpUri"]
    C --> E["Hidden metadata fields written<br/>into your real form"]
    E --> F["User submits the real form<br/>(ordinary request, no binary)"]
```

### Wire it up

Mark the file input with the attributes you need. At minimum, an upload action
and a preview container:

```html
<form id="profile" data-gina-form-rule="profile" method="POST" action="/profile">
  <input
    type="file"
    name="avatar"
    data-gina-form-upload-action="/media/stage"
    data-gina-form-upload-group="avatars"
    data-gina-form-upload-preview="avatar-preview">

  <ul id="avatar-preview"></ul>

  <button type="submit">Save</button>
</form>
```

### You provide the staging routes

The client posts the file to `data-gina-form-upload-action` and posts removals to
`data-gina-form-upload-reset-action` / `-delete-action`. **Gina does not ship
these endpoints** — you define them in your bundle. If you omit the attributes,
the client falls back to the route names `upload-to-tmp-xml` (stage) and
`upload-delete-from-tmp-xml` (remove), so you can either name your routes that or
point the attributes at routes of your own.

Your staging action receives the file as an ordinary multipart request
(`req.files`), stores it somewhere temporary with `self.store()`, and responds
with JSON the client understands:

```json
{
  "files": [
    {
      "originalFilename": "me.png",
      "mime": "image/png",
      "ext": "png",
      "size": 20480,
      "encoding": "7bit",
      "location": "/var/tmp/uploads/me.png",
      "tmpUri": "/media/tmp/me.png"
    }
  ]
}
```

The client uses each entry to render the preview (`tmpUri`, for `image/*` MIME
types) and to populate the hidden fields it injects into your real form
(`name`, `group`, `originalFilename`, `ext`, `encoding`, `size`, `location`,
`mime`, and `height`/`width` for images). Note the field names the client
expects — `mime` and `tmpUri` — differ from what `self.store()` returns
(`type`, `filename`); your staging action maps between them and supplies a
browse-able `tmpUri` for the preview.

### Attributes

| Attribute | Effect |
|---|---|
| `data-gina-form-upload-action` | URL (or route name) the chosen file is POSTed to for staging. Defaults to the route `upload-to-tmp-xml`. |
| `data-gina-form-upload-group` | The upload group tagged onto the file (drives the server-side extension/count checks). Defaults to `untagged`. |
| `data-gina-form-upload-preview` | Id of the element that receives image previews. Defaults to `<fieldId>-preview`. |
| `data-gina-form-upload-error` | Id of the element that displays staging errors. Defaults to `<fieldId>-error`. |
| `data-gina-form-upload-prefix` | Field-name prefix for the generated hidden fields. Defaults to the input's `name`. |
| `data-gina-form-upload-on-success` | Bare name of a `window` callback run when staging succeeds. |
| `data-gina-form-upload-on-error` | Bare name of a `window` callback run when staging fails. |
| `data-gina-form-upload-on-reset` / `-on-delete` | Bare name of a `window` callback run after a *staged* (reset) or *saved* (delete) file's removal. *New in 0.5.15.* |
| `data-gina-form-upload-reset-label` | Text of the auto-generated reset link. Defaults to `Reset`. |
| `data-gina-form-upload-reset-action` | URL/route for removing a *staged* (not-yet-saved) file. Defaults to the route `upload-delete-from-tmp-xml`. |
| `data-gina-form-upload-delete-action` | URL/route for removing an *already-saved* file. |
| `data-gina-form-upload-reset-trigger` / `-delete-trigger` | Id override for the reset/delete trigger element. |
| `data-gina-form-upload-hidden-class` | Class name the add-affordance restore removes from the file input *and its parent* after a removal — set it when your markup hides the input with a CSS class instead of an inline style. *New in 0.5.15.* |
| `data-gina-form-upload-is-locked` | When set on a generated hidden field, that field is kept even if its file is removed. |

### Previews and removal

If the staging response describes an image (`mime` starting with `image/`) and a
preview container exists, the client builds an `<img>` from the returned `tmpUri`
and appends it to the container — wrapped in an `<li>` when the container is a
`<ul>`. Cap the rendered width with a `data-preview-max-width` attribute on the
container.

Each preview gets a **Reset** link. Clicking it sends a removal request to the
reset (staged) or delete (saved) action URL, then removes the preview image,
its reset link, and the generated hidden fields, and restores the file input's
add-affordance. If your markup hides the input (or its wrapper) with a CSS
class rather than an inline style, name that class in
`data-gina-form-upload-hidden-class` — the restore removes it from the input
and its parent; without the attribute, the inline `display` restore applies.

To run your own logic after a removal, set `data-gina-form-upload-on-reset`
and/or `data-gina-form-upload-on-delete` to the bare name of a function
registered on `window` — the same convention as
`data-gina-form-upload-on-success` (a function-call shape like `"myCb()"` is
not supported and logs a warning). The callback fires once per removal action,
after the removal request has gone out and the preview has been cleaned up,
and receives one argument:

```html
<input type="file" id="avatar" name="avatar"
       data-gina-form-upload-hidden-class="is-hidden"
       data-gina-form-upload-on-reset="onAvatarReset">
```

```js
window.onAvatarReset = function (payload) {
    // payload.$upload      — the file <input> element
    // payload.bindingType  — 'reset' or 'delete'
    // payload.files        — the removed files' original filenames
};
```

An exception thrown inside your callback is logged and contained — it never
interrupts the removal. *The removal callbacks and
`data-gina-form-upload-hidden-class` are new in 0.5.15.*

---

## Limitations and gotchas

- **Multipart text fields are capped.** Text (non-file) fields are captured
  onto `req.body` / `req.post` since 0.5.16, subject to `upload.maxTextFields`
  (default `1000`) and `upload.maxTextFieldSize` (default `"1MB"`) — a request
  breaching either is rejected with HTTP 400. On earlier versions those fields
  are dropped entirely. See the [note above](#receiving-uploads-in-a-controller).
- **`untagged` is the permissive default — restrict it if you need to.** A file
  with no group is treated as `untagged`, which ships with `allowedExtensions: "*"`
  (any extension) and `isMultipleAllowed: true`. A group that is *not* configured is
  rejected (HTTP 400), and every configured group's rules — `untagged` included —
  are enforced. But because untagged accepts any extension by default, a client can
  still sidestep a restrictive *named* group by tagging its file `untagged`: if you
  rely on an allow-list, give `untagged` its own `allowedExtensions`, or require an
  explicit group.
- **No client-side size or type checking.** The client does not pre-validate a
  file's size or extension before staging — enforcement is server-side only (the
  upload-group rules). Do not assume the browser blocked anything.
- **No upload progress bar and no drag-and-drop.** The client layer renders
  previews and reset/delete controls but does not expose upload progress, and
  files are chosen through the native file input only. Both are planned for the
  staged upload layer — see the [roadmap](/roadmap).

---

## See also

- [Controllers](/guides/controller) — `self.store()`, `self.renderJSON()`,
  `self.throwError()`, and reading the request.
- [Forms and Validation](/guides/forms-and-validation) — the
  `data-gina-form-*` form layer the upload attributes extend.
- [settings.json](/reference/settings) — the `upload` configuration block.
