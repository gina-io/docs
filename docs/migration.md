---
title: Migration Guide
sidebar_label: Migration Guide
sidebar_position: 99
description: Step-by-step upgrade notes for migrating between Gina framework versions, covering breaking changes, new config fields, and required actions.
level: intermediate
prereqs:
  - '[Existing Gina project](/getting-started/first-project)'
  - '[Version changelog](/migration)'
---

# Migration Guide

Step-by-step notes for upgrading between Gina versions. Each section lists only
the changes that require action on your part. Additive changes (new optional
fields, new features) are noted for awareness but do not require any change to
existing code. Start from the section that matches your current version and work
upward to the target version.

---

## 0.5.24 → 0.5.25

### Added — cross-service request-id propagation

**No action required — additive.** The always-on request id (`req._ginaReqId`,
resolved from a sanitised inbound `X-Request-Id` or a fresh UUID) now travels
with your inter-bundle calls. Every `self.query()` forwards it as `x-request-id`
(a caller-set value is never overwritten), and every response echoes it back as
`X-Request-Id` — so one logical request stays correlatable as it fans out across
bundles, and a caller, load balancer, or APM can read the id off the wire. It is
independent of log format (the id is always-on even when the JSON-log
`requestId` field is not) and is never emitted after the response has been sent.
Server-side only — running bundles pick it up at restart, no asset re-bake. See
[Observability → Request correlation](/guides/observability#request-correlation).

### Added — `/_gina/health/check` liveness on every engine

**No action required — additive.** The built-in `GET /_gina/health/check`
liveness endpoint — which returns `200` with `{"status":"healthy","timestamp":…}`
and was previously served only by the Isaac engine — now answers on the default
(Express) engine too. It is deliberately **ungated** (no admin allowlist, no dev
gate) so a kubelet, Docker `HEALTHCHECK`, or load-balancer probe reaches it
off-loopback. If you kept a bundle on the Isaac engine only to pass a health
probe, that constraint is gone. Server-side only — pick it up at restart. See
[Kubernetes & Docker → Liveness and readiness probes](/guides/k8s-docker#liveness-and-readiness-probes).

### Added — machine-caller authentication (`auth.machine`)

**No action required — additive (opt-in, fail-closed).** Service-to-service
callers can now pass `requireAuth` / `roles` / `policy` routes **without a
session**: declare named callers under `settings.json > auth.machine.callers`
(keys are `${secret:KEY}`-capable and compared in constant time against
boot-computed sha256 hashes), and the caller presents
`Authorization: Bearer <key>` on each request — including from another bundle
via `self.query()`'s `headers` option. A verified caller is the request's
principal everywhere a session user would be: it satisfies `requireAuth`, its
configured roles ride the same ANY-of match, policies receive it as
`{ name, roles, machine: true }`, `self.hasRole()` answers its roles, and
audit records carry the caller name as the actor key (a new `401-machine`
`authz.denied` outcome covers rejected credentials, which get a clean `401`
with `WWW-Authenticate: Bearer` — never the login bounce). A signed-in session
always wins, and `enabled: false` (the default) is byte-identical to before.
For JWT / HMAC / API-key schemes, `auth.machine.authenticator` names a
per-bundle synchronous verifier module (the `policies/<name>.js` shape).
Boot config — enable it with a bundle restart; server-side only, no asset
re-bake. See [Route authorization → Machine callers](/guides/route-authorization#machine-callers).

### Fixed — absolute URLs no longer poisoned by port-less internal calls

**No action required.** A request whose `Host` header carries no `:port` — a
container health probe pointed at an app route, a service-mesh hop, a
sibling-bundle call addressed by service/DNS name — was classified as
reverse-proxied and rewrote the worker's proxy-host context, so later renders'
`getUrl`/`url` filter output and cross-bundle redirect targets could carry the
internal host (dead links, images that never load, redirects to unreachable
hosts — alternating per replica behind a load balancer). Each render now
prefers its own request's classification, on both engines; renders with no
request of their own still use the worker context — see the new opt-in below to
make that deterministic. Server-side only: running bundles pick the fix up at
restart, no asset re-bake.

### Added — `server.proxy.requireForwardedHeaders` (opt-in)

**No action required — additive (defaults to `false`).** When `true`, a request
is classified as reverse-proxied **only** when it carries an `X-Forwarded-Host`
header — the port-less-Host heuristic is disabled, so internal service-DNS
calls can never rewrite the worker's proxy-host context. This is the
deterministic option, and the only one that also protects renders with no
request of their own (e.g. worker-driven mail). Enable it only behind a front
proxy that always sends `X-Forwarded-Host`:

```json
{
  "server": {
    "proxy": {
      "requireForwardedHeaders": true
    }
  }
}
```

### Added — scaffold a namespace controller with `controller:add`

**No action required — additive.** A new [`controller:add`](/cli/cli-controller)
CLI command scaffolds a namespace controller into a bundle and prints the
paste-ready `routing.json` rules to wire it:

```bash
gina controller:add checkout demo @myproject --controls=start,confirm,cancel
```

It creates `controllers/controller.checkout.js` (one JSDoc'd action stub per
`--controls` entry) and, for a view bundle, one template per action at
`templates/html/checkout/<action>.html`, then prints the routing rules for you to
paste. The bundle flavor auto-detects (view → `render()` stubs + templates;
API-only → `renderJSON()` stubs) and is overridable with `--views` / `--api`.
`controller:add` **never edits `routing.json`** — it prints the rules and you
paste them, then restart the bundle. This is a scaffolding command, so nothing in
existing projects changes.

### Added — remove a namespace controller safely with `controller:remove`

**No action required — additive.** [`controller:remove`](/cli/cli-controller#controllerremove)
(alias `controller:rm`) deletes a namespace controller from a bundle, but only
after a reference-aware scan. Because a routing rule that names a namespace with
no matching controller file silently falls back to the default `controller.js`
rather than erroring, a bare delete is unsafe — so `controller:remove` scans
`routing.json` (rule-level `namespace` and `param.namespace`) plus
`requireController()` calls across the bundle and **refuses** the removal while
any still point at the controller, listing each one. It **never edits
`routing.json`**. When clean, it confirms interactively, then deletes the
controller file and its `templates/html/<name>/` tree. `--dry-run` previews,
`--force` deletes even with blockers (leaving the references for you to clean),
and `--format=json` emits a machine-readable envelope.

### Added — rename a namespace controller with `controller:rename`

**No action required — additive.** [`controller:rename`](/cli/cli-controller#controllerrename)
renames a namespace controller and rewrites the references that point at it.
Because a controller is named by its namespace string in several places — the file
`controllers/controller.<old>.js`, `namespace` values in `routing.json`, and
`requireController('<old>')` literals — a plain file rename would leave them
dangling (and a routing rule naming a missing namespace silently falls back to the
default `controller.js`). So `controller:rename` moves the controller file, moves
its `templates/html/<old>/` tree, and rewrites the structured references with
comment-preserving string ops:

```bash
gina controller:rename checkout basket demo @myproject --dry-run
```

Anything a static rewrite cannot safely resolve — a `param.namespace` set to a
`:variable`, or a `requireController(<expression>)` — is reported rather than
rewritten. `--dry-run` previews the full plan, `--force` applies without the
interactive confirmation, and `--format=json` emits a machine-readable envelope.
Restart the bundle after a rename.

### Added — opt into Swig output auto-escaping with `settings.swig.autoescape`

**No action required — additive; the default is unchanged.** Swig bundles render
variable output (`{{ x }}`) **raw** by default, and until now no setting could
change that. A new boolean `settings.swig.autoescape` makes HTML auto-escaping
reachable per bundle:

```json
{
  "swig": {
    "autoescape": true
  }
}
```

When `true`, Swig HTML-escapes variable output as an XSS defense — matching
Nunjucks, whose `settings.nunjucks.autoescape` already defaults to `true`. Absent
or `false`, behaviour is exactly as before (raw). A non-boolean value now fails
the bundle at startup, so the toggle can't be silently mis-typed. See
[`settings.swig`](/reference/settings#swig) for details. Swig's default stays
`false` in this release; enabling escaping globally by default is planned for a
future major.

---

## 0.5.23 → 0.5.24

### Added — probe the upload write-error crash-guard with `simulateWriteError`

**No action required — additive, and inert in production.** A new per-upload-group
`simulateWriteError` flag lets you re-confirm, on your own upload surface after an
upgrade, that a mid-stream write error answers a guarded **HTTP 500** for that one
request (rather than crashing the bundle). Add the flag to a throwaway group in your
bundle's `settings.json`:

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

Any upload tagged with that group (`group="_probe_fail"`) then fails with the same
guarded 500 a real disk-full / permission error produces — with no filesystem or
global-config change that affects your real uploads. The flag is **honoured outside
production scope only**; in production it is ignored, and a boot warning surfaces it
so it can never ship silently. Server-side only — restart your bundles to pick it up.
See the [file uploads guide](/guides/file-uploads#probing-the-write-error-crash-guard)
for the full recipe, including why the group tag must be sent as a Content-Disposition
parameter that `curl -F` / `FormData` cannot emit.

### Added — upload progress for the staged upload client layer

**No action required — opt-in.** File inputs using the `data-gina-form-upload-*`
staging layer can now report real transfer progress: a declarative indicator
(`data-gina-form-upload-progress`, default target `<fieldId>-progress` — native
`<progress>` elements track bytes, anything else gets a percent text plus
`data-gina-upload-progress` / `data-gina-upload-progress-state` styling hooks), a
`data-gina-form-upload-on-progress` window callback (bare identifier, the
`-on-success` convention), and a registered `uploadProgress` form event carrying
`{ status, progress, loaded, total, lengthComputable, files }`. Progress is
per-request (one staging POST carries every file of a selection). The indicator
lifecycle is managed — `preparing` on selection, `complete` on success, an
emptied bar on error, and a full strip when a staged file is removed. This is
**browser-bundled**: rebuild your bundles (re-bake) to pick it up. See the
[file uploads guide](/guides/file-uploads#upload-progress).

### Added — drag-and-drop for the staged upload client layer

**No action required — opt-in.** A staged file input can now delegate a
dropzone: `data-gina-form-upload-dropzone="<elementId>"` binds the named
element, and dropped files go through the exact same staging pipeline as a
native picker selection (group tagging, staging POST, previews, hidden metadata
fields, reset/delete, upload progress). Explicit id only — there is
deliberately no default: without the attribute nothing changes. The zone gets
`data-gina-upload-dropzone` / `data-gina-upload-dropzone-state`
(`idle`/`over`/`dropped`) styling hooks; text/link drags are ignored; a
multi-file drop on a non-`multiple` input keeps the first file with a console
warning. This is **browser-bundled**: rebuild your bundles (re-bake) to pick it
up. See the [file uploads guide](/guides/file-uploads#drag-and-drop-dropzone).

### Fixed — a misconfigured upload group destination no longer crashes the bundle

**No action required — behavior fix.** When a configured upload group's custom
`path` cannot be created (a read-only or permission-denied parent directory),
the synchronous directory creation inside the multipart parser used to throw
and take the whole bundle down — an unauthenticated, single-request crash. It
now answers a guarded **HTTP 500** for that one request (a server configuration
problem, not client input; an unknown group name still answers 400) and the
bundle keeps serving. Server-side only — restart your bundles to pick it up.

### Added — an incident ref on every error response

**No action required — additive and backward-compatible.** Every `throwError`
JSON error body now carries a top-level `ref` field — a short, voice-relayable
correlation code (6 uppercase hex, e.g. `A1B2C3`, or a relay-safe
caller-supplied value) present in **all scopes**. Server-side, one error-level
log line pairs that ref with the full error detail (message + stack + cause)
plus the request correlation id, emitted **before** the stack-egress gate
strips the wire copy — so support can resolve a user-relayed ref to the exact
server-side failure, even in production (where the stack never reaches the
client). Custom error pages and the inline fallback page render the same ref
(`data.ref`). Consumers that only read `status` / `error` are unaffected until
they adopt the ref. Server-side only — restart your bundles to pick it up. See
the [controller guide](/guides/controller#incident-ref).

### Fixed — staged file uploads store binary files byte-identical

**Action needed if you upload binary files through the staged client layer
(`data-gina-form-upload-*`): re-bake your bundles AND make sure the receiving
server is on gina ≥ 0.5.22.** The staged-upload client layer used to assemble
its multipart body as a JavaScript string, which the browser then UTF-8-encoded
on the wire — so every file byte ≥ `0x80` was inflated to a two-byte sequence,
and any real binary upload (image, PDF, archive) was stored corrupted and
mis-sized server-side. (Pure-ASCII uploads were unaffected, which is what hid
it; and on servers **before** 0.5.22 a since-removed server-side decode
accidentally cancelled the inflation, so the corruption only began biting once
the server became byte-faithful at 0.5.22.) The body is now assembled as a
`Blob`, so the raw file bytes reach the wire verbatim — the multipart framing
and the upload-group tag are byte-identical, so there is **no server-contract
change**. This is **browser-bundled** — rebuild your bundles (re-bake) to pick
it up, paired with a server ≥ 0.5.22. Files already corrupted by this defect are
losslessly recoverable: the stored bytes are exactly the UTF-8 encoding of the
original byte sequence, so decoding as UTF-8 and re-encoding as latin1 restores
the exact original.

### Fixed — staged upload client layer: action fallback and missing-preview guard

**No action required — browser-bundled bug fixes; re-bake your bundles to pick
them up.** Two edge-case defects in the `data-gina-form-upload-*` staging layer:
(1) a file input that declared only its staging action
(`data-gina-form-upload-action`) and relied on a default route for its
reset/delete action had the staging action silently repointed at the delete
route, so the staging POST went to the wrong endpoint (and failed silently when
the resolved origin also differed from the page origin); (2) an upload
configured without a preview element threw in its success handler after an
otherwise-completed upload. Both are fixed. This is **browser-bundled** —
rebuild your bundles (re-bake) to pick it up.

---

## 0.5.22 → 0.5.23

### Fixed — `req.files[].size` now reports the exact stored byte count

**No action required — behavior fix. Re-check any workaround that re-measures
uploaded files.** On multipart uploads, `req.files[].size` was snapshotted while
the write pipeline could still hold uncounted chunks, so it under-reported by a
varying whole-chunk amount — the file bytes on disk were always intact and
complete; only the reported number was short. The count is now finalized once
the last chunk has been counted, strictly before your controller runs, so
`req.files[].size` — and anything persisting it, including the
`self.store()` result's `size` — is the exact on-disk byte size. If you added a
consumer-side re-measure (`fs.statSync` on the stored file) to work around the
short value, it becomes unnecessary after pickup. Server-side only: restart your
bundles to apply — no client rebuild needed.

### Fixed — multi-file uploads no longer hang when an early file finishes first

**No action required — behavior fix. Remove any client/proxy-timeout workaround
you added for stalled multi-file uploads.** A multipart request with two or
more file parts could hang forever — no response, no log line — whenever an
early small file finished writing to disk while a later, larger part was still
streaming in. The internal completion listeners were attached only after the
whole body was parsed, and a stream that had already finished never re-emits
its completion event, so the request never resumed; only a client or
front-proxy timeout severed it. Slow client connections hit this
deterministically, fast ones intermittently. The listeners are now armed the
moment each file stream is created, and the request resumes once the parse and
every file write have both completed — in any order. As part of the same
change, a disk write error during streaming (missing upload directory, disk
full) now answers a guarded 500 instead of crashing the bundle process.
Single-file uploads were never affected. Server-side only: restart your
bundles to apply — no client rebuild needed.

### Fixed — the stale-release banner now shows on bundles using a custom async template loader

**No action required — behavior fix; relevant only if you use `server.releaseWatch`
with a custom async template loader.** A bundle configured with an async template
loader (`settings.template.<engine>.loader`) doing a local production rehearsal
with `server.releaseWatch` enabled got the `/_gina/release/*` status endpoints and
the SSE event stream, but no in-page banner — the client banner was spliced in
only on the synchronous render paths. Both async render delegates (swig and
nunjucks) now inject the banner onto the finalized HTML exactly like the
synchronous delegates, carrying the per-request CSP nonce when `useNonce` is
active. The injector itself is unchanged and stays byte-inert on any request
outside the release-watch gate (non-local scope, production off, or the feature
disabled). Server-side only: restart your bundles to apply — no client rebuild
needed.

---

## 0.5.21 → 0.5.22

### Changed — runtime pins now live under the standard `engines` manifest key

**No action on supported runtimes.** Gina's `package.json` declares its runtime
floors under the standard `engines` key (formerly the non-standard singular
`engine`, which npm and Bun ignore entirely). On Node `>= 22 <27` or Bun
`>= 1.2` nothing changes. An out-of-range runtime now gets npm's standard
`EBADENGINE` **warning** at install time — it becomes a hard failure only if
your environment sets `engine-strict`. Newly scaffolded projects get the
standard object-form key in their generated `package.json` too.

### Fixed — reopening a popin no longer renders the previous open's content

**No action required — behavior fix. Re-check any workaround you built for stale
popin content.** The AJAX popin content cache outlived the open it warmed: every
open after the first paid for a network fetch yet rendered the body fetched
around the *previous* open — a one-generation lag — because no close path
invalidated the cached copy. A dialog whose content changes between opens
(a record edited elsewhere, a value updated server-side) therefore reopened
showing a stale snapshot. This was a long-standing defect, not a 0.5.21
regression — it predates the eager preload feature. The cache entry now dies
with the open: closing a popin clears its cached content — including the copy
silently re-warmed by the close-time focus return and pointer re-hover — so
every open renders current content. Default triggers pay at most one extra
idempotent GET per close. Browser-bundled: rebuild your bundles
(`gina bundle:build`) to pick it up.

### Changed — `data-gina-dialog-preload="false"` is now a hard always-refetch guarantee

**Action for volatile popins: annotate their triggers `false`.** A trigger
marked `data-gina-dialog-preload="false"` already opted out of hover/focus/idle
warming; it now also skips the cache *read* when the popin opens, on both open
paths. That makes `false` a guarantee: the trigger's popin GET happens at open
time, every time — never served from a warm, never from a same-URL sibling
trigger's cache entry. Use it for content that must be current at the moment it
is displayed.

While auditing triggers, also check the other direction: before relying on the
default hover/focus warm (or opting into `eager`), audit each popin GET route
for halting or side-effecting middlewares and session-mutating renders, and
annotate those triggers `false` too. Pay particular attention to anchors built
at render time from stored data — a query parameter baked into a stored URL can
turn a GET into a write path, and those triggers are invisible to template
greps.

### Fixed — numbered `is<N>` rules no longer collapse onto a doubled bare `is` error

**No action required — display/keying fix** (completes the 0.5.20 `is<N>`
enforcement fix). When validation re-applied rules against the same form — a
`_case_` conditional re-evaluation, nested field groups — every numbered
`is<N>` rule fell back to the bare `is` error key: the last-declared rule
overwrote its siblings, and its message rendered twice (once under its own key,
once under the mirrored `is` key). Which rule doubled depended only on
declaration order, not on the digit. Numbered rules now keep their distinct
error keys on every pass and each message renders once. Browser-bundled:
rebuild your bundles (`gina bundle:build`) to pick it up.

### Fixed — multipart binary uploads arrive byte-identical

**No action required — data-integrity fix. If you base64-encode binary files
over JSON to work around upload corruption, you can retire that workaround
after picking up this version.** Binary file payloads uploaded via native
multipart (`FormData`, `curl -F`, hand-built bodies) were string-decoded on
their way to disk, so any content that is not valid UTF-8 — images, PDFs,
archives — arrived mangled and mis-sized (pure-ASCII files were unaffected,
which is why text uploads always worked, and why the corruption could go
unnoticed). The request stream now stays raw for multipart bodies and the
write pipeline passes chunks through verbatim: files reach `req.files[].path`
byte-identical, and `req.files[].size` now reports the real on-disk byte
count instead of a decoded character count. Server-side only — no bundle
rebuild needed; restart your bundles to pick it up.

### Fixed — checkbox migration warnings: payload-only remedy + explicit opt-out

**Action only if the #49 migration warnings fire on markup you authored
deliberately.** The tick-direction warning ("`value` no longer implies the
checked state") also fired on checkboxes authored *after* the 0.5.18
state-model change — `value="true"` with no `checked`, intended to render
unticked — where both listed remedies would have done the wrong thing. Two
additions: the messages now name the third remedy — remove the `value`
attribute; a boolean-classified checkbox posts its live checked state either
way, so the posted wire is identical — and an explicit
`data-gina-form-checkbox-value-as-state="false"` on the `<form>` declares the
current state model and silences both migration warnings for that form (any
explicit value counts; `"false"` has no other effect). Browser-bundled:
rebuild your bundles (`gina bundle:build`) to pick it up.

### Fixed — a `query` rule failure can no longer hang the submit

**No action required — robustness fix.** The `query` rule's backend result is
processed asynchronously: if the form had been unbound by then (for example a
popin closed mid-flight), the response was malformed JSON under a JSON
content-type, or the field value was a boolean (a checkbox with a `query`
rule), the processing threw and the submit pass waited forever on a completion
event that never fired. Any failure while handling the result now warns in the
console and releases the pass with the field state unchanged — the server
still re-validates on submit, which remains the trust boundary. Browser-bundled:
rebuild your bundles (`gina bundle:build`) to pick it up.

### Added — the `settings.i18n.cultures` allowlist is now honoured

**No action unless you had set it — the key was documented as reserved.** A
non-empty `cultures` array under `settings.json > i18n` now constrains which
cultures the user-signal negotiation steps (URL prefix, cookie,
`Accept-Language`) may match, so a staged rollout can ship a
`locales/de.json` catalog without `de` becoming reachable until it is listed.
`null` or `[]` keep the historical behavior (available cultures derive from
the loaded catalogs), and the bundle default (`settings.region.culture`) is
never constrained. The whole `i18n` block is now declared in the published
settings.json schema. Restart the bundle to apply.

### Fixed — `page.view.locale` now carries the real country record

**No action required — a dead surface starts working.** The per-request
country-locale lookup filtered the region data on a key it does not carry, so
`page.view.locale` had always been an empty object (plus the date stamp) when
the culture carried a country code — and an arbitrary first record when it did
not. Templates now receive the real record (`countryName`, `currency`,
`capital`, …) resolved from the request culture's country code, with lowercase
country segments normalized; a country-less culture (bare `en`) yields an
explicit empty object. Nothing read the broken object before, so no existing
template changes behavior — the surface simply starts working.

### Fixed — install no longer dies on a redactor-matched npm prefix

**No action required — install robustness.** `npm install -g gina` died
whenever the effective npm prefix contained a path segment npm's redactor
masks — a UUID-shaped directory is enough (CI sandboxes, generated
workspaces): `npm config get prefix` refuses such a read as protected on
every current npm generation (10/11/12), and gina's install scripts probed it
unguarded. The probe is now guarded, falling back to the prefix npm itself
exports to the install lifecycle. The fix ships inside the tarball, so it
applies from this version's install onward — older versions cannot be
retro-fixed.

### Fixed — link HTML callbacks (`data-gina-link-event-on-*`) now work, and no longer break the link

**No action required — a dead feature starts working. If you tried these
attributes and removed them because the link stopped working, they are safe
now.** Carrying `data-gina-link-event-on-success` or
`data-gina-link-event-on-error` on a `data-gina-link` anchor used to make
every click throw before the request was even opened: no request left the
page, no callback ran, and the link was effectively dead. The callback
registration helper was unreachable from the link plugin, and the internal
success/error events were named and targeted inconsistently between
registration and dispatch. Both attributes now work as designed: name a
`window`-level function (bare identifier, no parentheses) and it receives
`(event, result)` when the link's XHR succeeds or fails. The programmatic
`gina.link.on('success'/'error')` channel is unchanged. Browser-bundled:
rebuild your bundles (`gina bundle:build`) to pick it up.

---

## 0.5.20 → 0.5.21

### Added — popin eager preload (`data-gina-dialog-preload="eager"`)

**Additive — no action required.** AJAX popin triggers can now opt into idle
warming: mark a trigger with `data-gina-dialog-preload="eager"`
(case-insensitive) and the popin plugin fetches its content after `window`
load, at browser idle — one trigger at a time, off the critical path — so the
popin opens instantly with no second GET. The pass reuses the same safety
gates as the hover/focus warm: the `"false"` opt-out and the disabled skip
apply identically, an eager warm and a hover warm coalesce into a single GET,
and the pass is skipped entirely when the browser signals Save-Data. Default
behavior is unchanged — hover/focus warm remains the default, and `"false"`
still disables warming entirely. Browser-bundled: rebuild your bundles
(`gina bundle:build`) to pick it up.

### Changed — a missing bundle `routing.json` now fails the boot (deliberate)

**Check this one if your deployment pipeline can ever produce a release tree
where a bundle's `config/routing.json` is momentarily absent** (staged file
sync, partial artifact promotion). A bundle whose `config/routing.json` was
missing at boot used to start anyway with only the framework's synthetic
routes — every app route 404'd, and a sibling bundle's cross-bundle
`getRoute('rule@bundle')` threw hours later with a bare not-found. The boot now
**refuses to start** with an error naming the bundle and environment, exactly
like a malformed `routing.json` always has; under an **external** supervisor
(Kubernetes, a container restart policy such as `--restart=always`, an init
system) the restart retries until the release tree settles, so a mid-deploy
race self-heals instead of half-booting. One caveat: a container `restart:`
policy keys on **PID 1** — if PID 1 is a supervisor-style init whose foreground
process outlives the app (a log tail, a wrapper script), a crashed bundle never
exits PID 1 and the policy never fires; make the bundle process (or an init
that propagates its exit) PID 1 for the retry loop to work. The gina daemon
itself does **not**
retry a startup crash — a bare `gina bundle:start` bundle reports
`crashed during startup` once and stays down until you restart it manually.
This is deliberate: silent partial route tables produced hours-later mystery
errors. If a boot refuses after upgrading, the deployment artifact really is
missing the file — fix the artifact. Related quality-of-life: the route-lookup
not-found error now names the bundle and its rule count
(`` …`nope@api` not found ! (bundle `api` holds 6 rules) ``), so a degraded
table is tellable from a plain mistyped rule; the browser bundle carries the
same enriched message — rebuild your bundles (`gina bundle:build`) to pick up
the client side.

### Security — 500 bodies no longer carry stack traces outside local scope

**No action required for most deployments — check your error handling only if
a service parsed stacks out of 500 response bodies.** Uncaught controller and
middleware errors route through the server-side error responder, which used to
serialize the full stack — absolute server paths and frames — into the JSON
`error` field (and the HTML error fallback) on every scope. Outside **local**
scope the wire now carries only the error's message line; the full stack goes
to the server log instead, so the diagnostic is preserved server-side.
Local scope is unchanged — the dev toolbar keeps reading the stack off the
wire. Service-to-service consumers that relied on wire stacks for debugging
should read the failing bundle's server log instead.

### Fixed — the hardcoded `accept-language` response header is gone

**Check your generated `env.json` if you have seen
`accept-language: en-US,en;q=0.8,fr;q=0.6` on responses.** `Accept-Language`
is a request header; the framework's env template declared it as a
response-header default, so every response — error responses included —
emitted the hardcoded value. The framework default is removed. If your
project's own `env.json` carries the copied line under
`server.response.header`, remove it there too — a value your project declares
deliberately keeps being emitted verbatim (the override path is intact), and
the locale fallback still honors a declared value.

### Fixed — fields with `autocomplete="off"` accept keyboard shortcuts again

**No action required — behavior fix.** On a [live-check
form](/guides/forms-and-validation), a field carrying `autocomplete="off"` (or
`"false"`) has its keystrokes intercepted to defeat the browser's
autofill/autosuggest dropdown. The interception mishandled modifier chords:
Cmd/Ctrl+A typed the chord letter into the field instead of selecting all, and
keyboard paste (Cmd/Ctrl+V) did nothing — its re-implementation relied on
`document.execCommand("paste")`, which browsers ignore in ordinary page
content (mouse and context-menu paste worked). Modifier chords now pass
through to the browser untouched: select-all, copy, paste, cut and undo behave
natively on intercepted fields, and plain typing still goes through the
interception. One deliberate delta: Cmd/Ctrl+Z on these fields is now a native
no-op (it used to reset the field to its default value, discarding input).
Browser-bundled: rebuild your bundles (`gina bundle:build`) to pick it up.

### Fixed — the `autocomplete="off"` interception no longer runs on Chromium

**Check this one only if you relied on the interception's autofill-defeat on
Chrome.** The interception is a Safari-specific workaround (Safari ignores
`autocomplete="off"`), but its browser gate tested `/safari/i` against the
user agent — and every Chromium browser (Chrome, Edge, Brave, Opera) carries
the `Safari/537.36` token, so the workaround ran there too, against its own
documented intent. The gate now matches real Safari only: Chromium users get
native typing and the browser's own autofill handling on these fields. iOS
third-party browsers (Chrome, Firefox or Edge on iOS) run Safari's WebKit
engine and are still treated as Safari. Browser-bundled: rebuild your bundles.

### Fixed — live check clears stale error messages when the form becomes valid

**No action required — display fix.** With live checking enabled, a validation
pass triggered by one control — ticking a checkbox, changing a select — that
makes the whole form valid (for example by raising a value another field's
comparison rule reads) re-enabled the submit trigger but left the other
field's error message on screen until that field's next keystroke. The
whole-form pass now clears every previously-errored field's message when it
comes back valid, on both the input/checkbox/radio path and the select path.
Error messages for untouched fields still appear only on interaction or
submit. Browser-bundled: rebuild your bundles.

### Fixed — cross-bundle links in merged-process projects

**No action required — server-side fix; applies only if several bundles share
one port.** In a merged-process project (every bundle of the project on the
same port, served by one process), the first cross-bundle
`{{ 'rule@bundle'|getUrl() }}` permanently replaced the target bundle's
routing table with the starting app's — from then on every cross-bundle link
to that bundle rendered the literal `404:[<METHOD>]<rule>@<bundle>` marker
instead of a URL, and inbound requests statics-matched to that bundle could be
resolved against the wrong table. Each bundle now keeps its own routing table
(the shared hostname is preserved). Projects with distinct per-bundle ports —
the common layout — were never affected. Server-side only: pick it up with the
version bump and a bundle restart; no rebuild of your bundles is needed for
this one.

---

## 0.5.19 → 0.5.20

### Fixed — region locale data: one standalone file per language, localized `countryName`

**Check this one if any of your bundles resolves a non-English culture and
renders country lists.** The region locale generator used to append each
requested language's rows to the previous language's output, so
`dist/region/fr.json` carried every country twice — the English copy first —
and `isoShort` lookups through `getLocales().getCountries()` always matched the
English row. Each language now ships as a standalone file, and non-English
builds localize `countryName`: a bundle resolving a `fr` culture gets
`Allemagne`, `États-Unis`, `Royaume-Uni` where it previously rendered
`Germany`, `US`, `UK`. **No application code changes** — the same
`getLocales().getCountries()` path returns the corrected data, and the
per-request [culture negotiation](/guides/i18n) keeps selecting the language,
so an `Accept-Language` flip changes the names per request as it should.

Two data notes. Rows without an ISO 3166 alpha-2 code are dropped (`en.json`
goes from 251 to 249 entries — the two dropped rows had an empty `isoShort`
*and* an empty `countryName`, so they could only ever render as blank list
entries). And the region files are read once at process start, not
hot-reloaded — restart your bundles after upgrading so they pick up the
regenerated data.

### Fixed — `getCountries(code)` honors its documented projection argument

The optional `code` argument (e.g. `capital`, `continent`, `tld`) was computed
and never applied. It now **adds** the requested field to every returned row —
the four historical fields (`isoShort`, `isoLong`, `countryName`,
`officialStateName`) are always present, so calls without an argument return
exactly what they did before. An unknown or non-string field logs a warning and
is ignored, and a bundle with no locale set now gets an empty list instead of a
throw.

### Changed — busboy is now an npm dependency

Multipart parsing uses [`@rhinostone/busboy`](https://github.com/gina-io/busboy) installed from npm instead of a patched copy vendored inside the framework tree. The fork is a strict superset of upstream busboy 1.6.0 — its only addition exposes each part's parsed Content-Disposition parameters, which is what lets the upload layer read the `group="…"` tag. **Nothing about upload behaviour or the multipart wire format changes**: files still arrive with their group, an unconfigured group is still rejected, and a file with no group still falls back to `untagged`. No application changes and no client rebuild — pickup is the version plus a bundle restart.

### Fixed — numbered `is` rules (`is1`, `is2`, …) now enforce

**Check this one if any rule file attaches `is` to a field more than once with
a numbered suffix.** [Numbered `is` aliases](/reference/validation-rules#is) —
`is1`, `is2`, and so on — were silently skipped: the alias installer sat behind
a type check that made it unreachable, so a rule keyed `is1` ran no check at
all, with no warning, on both the client and the server. They now install and
run. **A form that submitted clean because its `is2` condition was ignored may
begin failing validation** (and a server-side check may return a 422), so sweep
your rule files for `is`-with-a-number keys before upgrading and confirm each
condition is one you want enforced.

Two riders. Each alias now records its failure under its **own** error key
(`is`, `is1`, `is2`) on both client and server, so a per-field error map sees
one entry per alias instead of a single shared `is`. And a server-side rule set
that references other fields with `$name` — including a plain `is` cross-field
comparison — no longer crashes before the rules run.

### Fixed — dynamically injected forms activate live checking

When a form is added to the page after load — a popin, a dynamically loaded
fragment — and bound by id through `gina.validator.validateFormById(id)`, live
checking now activates. Before, if the form's id differed from its rule name,
that call resolved to an empty rule set and stamped the form
`data-gina-form-live-check-enabled="false"`, so keystroke validation never ran
(submit-time validation still worked, because the submit handler read the rule
independently). The call now reads the form's `data-gina-form-rule` attribute
first, matching the framework's three other rule-resolution sites. **No
application changes** — forms that relied on submit-time validation are
unaffected. An author-set `data-gina-form-live-check-enabled` attribute still
wins; the automatic stamp only applies when you leave it off.

### Fixed — boolean conditions in `_case_` rule blocks match during live checking

In a `_case_<field>` conditional rule block, a `case` written as the string
`"true"` or `"false"` now coerces to a boolean when it is evaluated during live
checking (one field at a time), the same way full-form validation on submit
already treated it. Before, such a string case silently failed to match while
the user typed, so its nested `rules` never applied until the whole form was
validated. **No application changes** unless a flow relied on that gap — live
checking and full-form submission now agree.

These three fixes change the client validator bundle, so a version bump and a
restart alone will not pick them up — **rebuild your bundles** to re-bake the
browser assets. (The numbered-`is` and `$name`-reference changes also apply
server-side, which a restart does pick up.)

## 0.5.18 → 0.5.19

### Changed — `self.redirect()` carries request data through the session by default

**Check this one if any of your routes read `req.get` values that a redirect put
there.** When a redirect carried the request's params, they used to travel in
the url as `?inheritedData=<encoded JSON>` — in clear, in the address bar, in
browser history and in your access logs, capped at 2000 characters. On a bundle
with a session mounted they now ride the session instead: nothing is appended to
the url, and the size cap no longer applies. The target action still reads them
from `req.get` exactly as before, so **no application code changes**.

Two consequences worth knowing. The session carry is **one-shot** — it is
consumed by the first routed GET that follows and then dropped, so a **page
refresh no longer replays the data** (the url form did, because it was in the
url). If a flow depended on that, read what you need on the first request and
persist it yourself. And because the first routed GET consumes it, a second tab
loading in parallel can win the race — this was equally true of the session
channel before, which already carried popin redirects.

**Session-less bundles are byte-identical to before**: no session means the url
form, the 2000-char cap, and the same `424` over it. Conversely, a redirect on a
bundle *with* a session that used to fail with `424` now succeeds.

See [Controllers → Carrying request data across the
redirect](/guides/controller#redirect-data-carry).

### Fixed — `self.redirect()` is now async; an unresolvable target answers 404 instead of crashing

Two related redirect fixes. First, the relative-path form
`self.redirect('/some/path')` — the documented primary form — resolves its
target again: the route matcher is asynchronous and the historical call was
never awaited, so a relative redirect silently matched nothing server-side.
Fixing it makes **`redirect()` itself `async`**. Redirects that pass an absolute
URL, a `route@bundle` name, or the `ignoreWebRoot` form have no await and settle
on the same tick, so existing code is unaffected; going forward prefer
`return self.redirect(...)` from your action, so a resolution error reaches the
framework's error handler instead of surfacing as an unhandled rejection.

Second, a redirect whose target cannot be resolved now returns a clean `404` for
that one request. Previously the unresolved sentinel reached the response-header
composer, which threw from inside the error path and **took the whole bundle
down** (a SIGTERM restart); the composer now tolerates a falsy routing state, so
a bad redirect target fails its own request instead of the process. No action
required.

### Fixed — `resumeRequest()` no longer drops the paused request's extra data

A GET replay dropped whatever you snapshotted with `pauseRequest(data)` unless
the request happened to be a popin XHR: the popin flavor routed through
`redirect()` and picked up its session carry, while the plain-XHR and full-page
flavors rebuilt the url from the route's params alone and silently lost the
rest. The replayed action now reads that data from `req.get` in all three
flavors. Snapshotting into a custom `requestStorage` with no live session
degrades exactly as before. No action required — a flow that worked around the
drop by stuffing data into the url or the session by hand keeps working.

### Fixed — `getRoute()` no longer throws for a requirements-less GET route with extra params

Composing a URL for a GET route that declares no `requirements` block, when
extra params are passed, threw — surfacing as a `500` at the caller. It bit the
deep-link-before-login replay (`resumeRequest()`) on any halted
requirements-less GET route that carried data, and the same crash was reachable
from the `url` template filter and the `getUrl()` family, in the browser bundle
too. Extra params now compose onto the URL as query parameters, as intended.
The client half ships in the browser bundle, so **rebuild your bundles after
upgrading** to pick up the `url` / `getUrl` fix. No code change required.

### Added — route authorization: `requireAuth`, `roles`, and `policy`

A `routing.json` rule's `param` block can now gate access before the controller
action runs — **fully additive**, so a route that declares none of these keys
behaves exactly as before:

- `"requireAuth": true` — a request is authenticated when `req.session.user` is
  set (populating it at login stays your application's job). An unauthenticated
  request gets a `401`; for a browser navigation, when
  `settings.json > auth.loginRoute` names a rule or a path, it gets a
  non-cacheable redirect to the login page with the original request snapshotted
  for `self.resumeRequest()` to replay. XHR requests always get the `401`, never
  a redirect.
- `"roles": ["admin", "editor"]` — the session user must hold one of the listed
  roles (`req.session.user.roles`, ANY-of; implies `requireAuth`). A caller
  holding none gets a generic `403` — the required roles are never echoed to the
  wire.
- `"policy": "ownsInvoice"` — delegates the decision to
  `<bundle>/policies/ownsInvoice.js`
  (`module.exports = function (user, req) { return boolean }`), AND-composed
  after roles (implies `requireAuth`). Access is granted only on a literal
  `true`; anything else — including a thrown error — denies with a generic
  `403`. The controller helper `self.hasRole(role)` is available for actions
  that authorize mid-logic.

Author mistakes refuse to boot rather than leaving a route silently open: a
non-boolean `requireAuth`, an `auth.loginRoute` the bundle does not declare, an
invalid `roles` shape, or a missing / broken / non-function / `async` policy.
The authorization keys are stripped from the client-served routing maps. No
action required unless you adopt the feature.

### Added — an audit trail (`settings.json > audit` + `self.audit()`)

A user-attributed, append-only record of "who did what to which record when",
kept separate from application logging (its own store, never the logger sinks).
Opt in with `audit.enabled: true` in `settings.json` and call
`self.audit(action, data[, cb])` from an action —
`self.audit("invoice.delete", { resource: id })` writes a record carrying the
actor (a snapshot of `session.user[audit.actorKey]`, default `"id"`, plus a copy
of `user.roles` — never the whole user object), the action, the request id, the
socket `ip` (`X-Forwarded-For` is never trusted), and the route metadata.

The default backend is an append-only JSONL file at
`<project>/logs/audit-<bundle>-<env>.jsonl` (override with `audit.file`, or point
`audit.store` at a `connectors.json` entry — no connector ships an audit-store
implementation yet, so that path refuses the boot rather than failing silently).
When the trail is on, route-authorization denials are recorded automatically as
`authz.denied` events (opt out with `audit.events.authz: false`), and an audit
failure can never change an authorization outcome. Malformed `audit` settings
refuse to boot rather than leaving a compliance control silently off.

Independently of the trail, **every request now carries an always-on request id**
(previously stamped only when JSON logging was enabled), so audit records and
JSON log lines correlate by construction; the id honours a sanitized inbound
`X-Request-Id`, making it a correlation key, not an attribution one. No action
required unless you adopt the feature.

### Fixed — Prometheus metrics no longer double-count under the isaac engine

**Check this one if you run the built-in metrics endpoint (`app.json`
`metrics.enabled`) on the isaac engine.** The request-lifecycle hook ran at both
dispatch layers for any request that reached the router, so every request
counter was incremented twice and the duration histogram observed twice. The
hook now records exactly once on either engine (the Express engine was never
affected). **The visible effect on upgrade: your request-counter rates roughly
halve** — that is the double-count disappearing, not a drop in traffic, so
re-check any alert thresholds or dashboards calibrated against the inflated
series. Request durations are now measured from engine entry, and the dev
Inspector Flow timeline keeps its accurate request-start time. See the
[Observability guide](/guides/observability).

### Added — the checkbox migration warning now covers the un-tick direction

`0.5.18` introduced a console warning for checkbox markup whose `value` used
to imply the checked state. It covered one direction only: `value="true|on"`
without a `checked` attribute (markup that used to render ticked). This
release adds the mirror: a checkbox **carrying the `checked` attribute** whose
`value` — or `data-value` — reads `false` or empty used to render **unticked**
(the old init pass cleared it) and now stays ticked; it is flagged once per
field with the same guidance. Remove the `checked` attribute if the box must
render unticked, or set `data-gina-form-checkbox-value-as-state="true"` on the
form while you migrate. No action required for markup that already renders as
intended — the warning is a migration aid, not a behaviour change.

### Fixed — `gina.emit('error', …)` no longer throws

The module-level `gina.emit` is now an inert stub: it always returns `false`,
never dispatches, and never throws. It was previously a detached copy of an
internal emitter's method — it never dispatched to any listener, and calling
it with the `'error'` event name threw its argument synchronously. The module
object is not an event surface (it exposes no `on`/`once`); for application
events, use the controller's
[`self.emitEvent()`](/guides/inspector#event). No action required — no
working code could have depended on the old behaviour.

### Added — image and container CLI: `image:list` / `image:rm` / `image:run`, and `container:ps` / `container:stop`

New verbs alongside `image:build`, all resolving the container host through the
same precedence `image:build` uses (`GINA_CONTAINER_HOST`, then native buildah,
then the `container.host` setting), so they always act on the host `image:build`
targets:

- `gina image:list` — inspect the OCI images on the host (aligned table or
  `--format=json`); `gina image:rm <ref|id>` removes one (`--force` for an image
  a container still references; no bulk delete).
- `gina image:run <image>` — run an image (via podman), detached by default and
  publishing the image's `EXPOSE`d port same-to-same (the port the gina-init
  allocator computed at build time); `--publish`, `--name`, `--rm`, `--stream`,
  `--format=json`, and `--env-var` / `--env-file` (runtime env reaches the
  container without ever entering argv or a shell). A build-only host (buildah
  present, podman absent) says so honestly instead of failing opaquely.
- `gina container:ps [--all]` — list containers on the host;
  `gina container:stop <name|id> [--time=<s>] [--force]` stops one and reports
  the rung it came down on (a `137` exit means it was SIGKILLed after the grace
  period).

No action required — these are new capabilities. See the
[image CLI reference](/cli/cli-image) and the
[container CLI reference](/cli/cli-container).

### Fixed — `image:build` for projects that depend on gina themselves

An image built for a project whose own `package.json` declares `gina` among
its `dependencies` failed at the in-image `gina-init` step with
`EACCES: permission denied … projects.json`. The project-dependency install
runs as root and re-runs the framework postinstall, which re-created the
runtime user's `~/.gina` root-owned *after* the synthesized Containerfile had
already handed the home directory back; the build then died at the first
`USER node` step. The dependency-install layer now re-hands the home back
after that last root-run npm step. Projects without their own `gina`
dependency were never affected. No action required — re-running
`gina image:build` with the fixed CLI produces a working image; the
`--gina-version` in-image pin does not need to change, since the fix lives in
the synthesis on the machine running the CLI.

### Fixed — `image:build`: the pinned framework now wins `require('gina')`

In the same gina-dependent-project images, the `node_modules/gina` link to
the pinned global install was silently bypassed: the link step cannot replace
the real directory npm extracted for the project's own `gina` dependency, so
it nested a stray symlink inside it and the bundle resolved the *project's*
gina at runtime while the CLI binaries (`gina-init`, `gina-container`) ran
from the global pin — a mixed-version container. The link now supersedes the
project-extracted copy, so the version selected at build time (the project's
registered framework pin, or `--gina-version`) is the one the bundle actually
runs. If you relied on the project's own `gina` dependency winning inside the
image, pass the version you want via `--gina-version` instead.

---

## 0.5.17 → 0.5.18

This release ships additive cache improvements, the route-DTO layer (typed,
validated payloads), repaired TypeScript declarations, and a checkbox
state-model correction in the form validator. Two behavioural changes are
worth noting: the `fs` cache backend below, and checkbox markup that relied
on `value` deciding the checked state (see the FormValidator entry at the
end of this section).

### Added — a bundle-wide default cache backend (`server.cache.type`)

`settings.json` gains a `server.cache.type` key (`"memory"` | `"fs"` |
`"redis"`, default `"memory"`) that sets the default cache backend for the
whole bundle. A route
with a `cache` block but no `type` now inherits it, mirroring the existing
`ttl` / `sliding` / `maxAge` fallbacks. A per-route `cache.type` still wins. No
action required — existing bundles behave exactly as before (a route with no
effective `type` is not cached). See [Caching → Server-level cache
config](/guides/caching#server-level-cache-config).

### Changed — the `fs` cache backend now survives a restart

Previously an `fs`-cached response was orphaned on the next boot: the
in-process index started empty, so the file on disk was never served again (and
never cleaned up). The server read path now falls back to disk on an index
miss, so `fs`-cached pages survive a restart as the backend always intended.
See [Caching → Surviving a restart](/guides/caching#surviving-a-restart).

The original expiry is preserved — a restart never extends a TTL — so entries
never live longer than configured. **If you previously restarted the server to
clear the `fs` cache, that no longer works**; evict entries with
`invalidateOnEvents`, a shorter `ttl`, or by clearing the cache directory
(`server.cache.path`) instead. The `memory` backend is unchanged (still cleared
on every restart).

Each `fs` cache file now has a sibling `<file>.meta` JSON file holding its
expiry metadata; the two are written and removed together. If your deployment
tooling copies or prunes the cache directory, treat `<file>` and `<file>.meta`
as a pair.

### Added — a `redis` cache backend: a shared L2 across replicas

Routes — or the whole bundle, via `server.cache.type` above — can now cache to
`"type": "redis"`: a **shared second tier (L2)** on top of each replica's
in-process L1. A rendered response is stored in this replica's heap
synchronously *and* pushed to a shared redis fire-and-forget (the response
never waits on redis), so every replica behind a load balancer serves the same
cached page — and a freshly-started or scaled-up replica serves content a peer
already rendered, instead of cold-starting its own cache. A request that
misses L1 warms it back from redis with the authoritative remaining TTL;
`delete` / `clear` / `invalidateByEvent` remove the matching redis keys as
well. If redis is down or a command fails, caching degrades transparently to
per-replica `memory` behaviour (fail-open) — a render is never blocked or
failed by a redis outage.

The connection is named by `server.cache.store` in `settings.json`, which
points at a `connectors.json` redis entry (`{ "cacheRedis": { "connector":
"redis", "host": …, "port": … } }`); the connector uses `ioredis`, resolved
from your project's `node_modules` (`npm install ioredis`). The resolved cache
config is validated at boot, and an unsupported shape refuses to start:
`redis` with `sliding: true`, a `redis` route with neither a `ttl` nor
`invalidateOnEvents` (a non-expiring key would be orphaned on a
release-namespace change), or a `redis` route with no `server.cache.store`.

No action required — the backend is opt-in; `memory` and `fs` bundles are
unchanged. See [Caching → redis (shared L2 across
replicas)](/guides/caching#redis-shared-l2-across-replicas).

### Changed — render/output-cache keys are release-namespaced

Cached entries are now scoped to a release namespace (`GINA_CACHE_NAMESPACE`,
or the framework version via `GINA_VERSION` when that is unset). **The practical
effect on this upgrade: your existing render/output cache is invalidated once**
(the framework version changed), and `fs`-cached files move under a new
`${cache.path}/${bundle}/${namespace}/…` subdirectory. This is a one-time
cache-cold — pages re-render and re-cache on first request; the old flat
`${cache.path}/${bundle}/html…` files are orphaned and can be deleted at your
convenience.

To invalidate the cache on your *own* deploy cadence rather than only on
framework upgrades, set `GINA_CACHE_NAMESPACE` to a per-release id (e.g. a git
SHA). See [Caching → Release namespacing](/guides/caching#release-namespacing).

### Added — flush the render cache on demand (`gina cache:clear`)

A new `gina cache:clear [<bundle>] @<project>` CLI — and the admin endpoint it
uses, `POST /_gina/cache/clear` — flushes a bundle's render/output cache (the
`static:` HTML and `data:` JSON namespaces) without touching compiled templates
or HTTP/2 sessions. It clears the live in-heap entries **and** reclaims the
on-disk cache directories, including the orphaned prior-namespace directories
left by the release-namespacing change above. `--dry-run` previews without
removing anything; `--format=json` emits a machine-readable envelope. No action
required — this is a new capability. See [Caching → Flushing the
cache](/guides/caching#flushing-the-cache).

### Fixed — event-driven cache invalidation now works (`self.cache`)

**Check this one if any of your routes declare `cache.invalidateOnEvents`.**
Those registrations were accepted but nothing ever fired them: the documented
`self.cache.invalidateByEvent()` did not exist, so a route configured to
invalidate on an event silently served stale content until its TTL expired.
`self.cache` now exists on the controller — `self.cache.invalidateByEvent(event)`
evicts the entries registered for that event and returns how many were removed,
and `self.cache.clear([bundle])` flushes the namespace. No config change is
needed; routes that already declare `invalidateOnEvents` start behaving as
documented as soon as you upgrade, so expect those pages to refresh on their
event rather than on their TTL.

Three further defects in the same path are fixed. Re-registering a key that
carried a querystring **threw** (the registry ran cache keys through a
condition evaluator, where `?` and `=` parse as operator tokens) — and under
the swig engine that throw unwound to the top-level render error handler, which
answered **500 and discarded a page that had already rendered correctly**.
Registrations were never reclaimed, so the registry grew a row on every
cache-miss re-render. And an `fs` entry read back after a restart carried no
registration at all, so firing its event silently failed to evict it.

Because `self.cache` only reaches its **own** process, cross-bundle eviction now
has a first-class path: `gina cache:clear @<project> --event=<name>` and
`POST /_gina/cache/clear?event=<name>` (both engines) evict by event and report
the count. ⚠️ `?event=` was previously **unread** on the endpoint, so passing it
flushed *every* bundle's output cache instead of evicting that event's entries —
if you were calling it that way as a blunt flush, it now does what it says, and
takes precedence over `?bundle=`. See [Caching → Event-driven
invalidation](/guides/caching#event-driven-invalidation) and [Invalidating
across bundles](/guides/caching#invalidating-across-bundles).

### Added — Cache-Status names the serving tier; `/_gina/cache/stats` reports L2 health

Every render-cache hit's `Cache-Status` header now carries an RFC 9211 `detail`
parameter naming the physical tier that served the bytes: `detail=memory` (the
in-process L1), `detail=redis` (a shared-L2 warm — a replica serving a page a
peer rendered, visible per request), or `detail=fs` (a disk read-back after a
restart). The parameter is appended after the existing `hit`/`ttl` tokens, so
anything matching on `gina-cache; hit` keeps matching. `/_gina/cache/stats`
gains an additive `l2` block on both engines reporting the redis connection's
health (`status`, `mode`, key `prefix`, connection-error count and last error);
the field is absent on `memory`/`fs`-only bundles. No action required. See
[Caching → Cache-Status response header](/guides/caching#cache-status-response-header).

### Changed — the Cache-Status miss form is now `fwd=uri-miss` (RFC 9211)

A cache miss is now reported as `gina-cache; fwd=uri-miss` — the RFC 9211
grammar, where `uri-miss` is a value of the `fwd` parameter — instead of the
bare `gina-cache; uri-miss` shipped in 0.5.17, which read as an unregistered
parameter to RFC-aware tooling. **If you match the miss header exactly (for
example `grep '; uri-miss'`), update the pattern**; a plain `uri-miss`
substring still matches. Express bundles additionally gain their first
cache-miss signal: routes served through the shared cache read path now emit
the miss form too (previously the header was Isaac-only on misses).

### Fixed — a checkbox's `value` attribute no longer decides its `checked` state

FormValidator historically treated a checkbox's `value` as the state carrier:
`value="true"` was ticked at bind time even with no `checked` attribute —
silently pre-ticking consent-style boxes — a value-less checkbox was ticked on
form *reset* through the cached default state, `value="false"` un-ticked a
server-checked box, and the posted boolean was derived from the `value` string
(so un-ticking a box from your own script could still post `true`, and a
neutral `value` could never post `true`).

The model is now the HTML standard: the **`checked` attribute decides the
initial state**, and the **live checked state decides the posted boolean**.
Boolean-classified checkboxes (no `value` attribute, `value` reading
`true`/`false`, or an `isBoolean` rule) post real JSON booleans in both
states. For a checkbox that already posted booleans the wire is unchanged; a
value-less checkbox previously posted the string `"on"` when checked and —
when its declared rule lacked `isBoolean` — was absent when unchecked (other
rule shapes already posted a coerced `false`); it now posts `true`/`false`
uniformly, so a server reading
`"on"` or testing the field's mere presence must read the boolean instead
(this holds even under the legacy opt-in below, which restores ticking only).
Value-carrying checkboxes (ids, emails + `checked`) are untouched.

**Action needed only if your markup relied on `value` deciding the state**
(e.g. `value="{{ flag }}"` with no `checked` attribute — such boxes now render
unticked): either template the standard attribute — `{% if flag %}checked{%
endif %}` — or set the **deprecated, transitional** opt-in
`data-gina-form-checkbox-value-as-state="true"` on the form while you migrate.
A console warning flags each checkbox whose `value` reads `true`/`on` without
a `checked` attribute. The validator is part of the browser bundle: rebuild
your bundles after upgrading. See [Forms & validation →
Checkboxes](/guides/forms-and-validation#checkboxes).

### Added — route DTOs: validated, typed request payloads (`param.dto` / `param.responseDto`)

A bundle can now author a data shape once (`<bundle>/dtos/<Name>.js`) and let
the framework validate and coerce the request payload **before** the
controller action runs (`param.dto` on the route — clean `422` with a
field-level error map on failure, coerced payload plus a strict `req.dto`
projection on success), shape 2xx JSON responses (`param.responseDto` —
`.exclude()`d fields never reach the wire or the render cache), feed
`bundle:openapi` / `bundle:mcp` request/response schemas, and emit TypeScript
declarations via the new `gina bundle:types`. **Fully additive** — a route
that declares no DTO is byte-identical to before. DTOs are registered at
bundle boot (like `routing.json`), so adding or editing one requires a bundle
restart; a missing or broken DTO refuses the boot rather than silently
skipping validation. Note the honest limits: `.min()`/`.max()` are
schema-only (documented in OpenAPI, not runtime-enforced), undeclared keys
are passed through rather than stripped (URL params ride alongside the
body), and a `dto.date()` value arrives as an ISO **string**, not a `Date`.
See the new [Route DTOs guide](/guides/dtos).

### Fixed — the published TypeScript declarations now describe the runtime

`types/index.d.ts` previously declared **no value** for the main entry, so
`import gina from 'gina'; gina.lib` (and every other member access) failed to
typecheck for all TypeScript consumers; several declared members also did not
exist at runtime (`gina.on(...)` typechecked, then threw — the module object
is not an EventEmitter — and `String.prototype.ltrim/rtrim/gtrim` were never
real). The declarations were rebuilt against the measured runtime surface:
`import gina = require('gina')` and the ESM default import both typecheck,
`gina.dto` / `gina.lib.*` / the controller's i18n, jobs, trailers and events
methods are all typed, and `GinaRequest<TDto>` types route-DTO payloads. If
you carried `// @ts-ignore` or `as any` workarounds for gina imports, they
can come off. A consumer-compile gate plus a runtime-parity test now keep the
declarations honest going forward.

### Added — stale built-release watch for local production rehearsals (`server.releaseWatch`)

Opt-in and disabled by default — purely additive, no action required unless you
want it. When you run a **built release** under `local` scope + a non-dev env (a
local production rehearsal), the bundle serves the compiled release with no
hot-reload, so editing source silently keeps serving the stale build. Enable
`server.releaseWatch` in `settings.json` and the bundle fingerprints its source
tree, surfaces staleness on `GET /_gina/release/status` (plus a live
`GET /_gina/release/events` SSE stream and a click-to-rebuild banner), and can
rebuild + restart on demand — always **idle-gated**, so an in-flight request or
a busy application job is never interrupted.

```json title="src/<bundle>/config/settings.json"
{
  "server": {
    "releaseWatch": { "enabled": true }
  }
}
```

Hard-gated on `local` scope + a non-dev env; never active on a real cluster. New
keys: `mode` (`notify` | `auto`), `restartMode` (`daemon` | `supervisor`),
`debounceMs`, `reconcileIntervalMs`. See the
[Release Watch guide](/guides/release-watch) for the full surface.

### Fixed — error and log output tells you what actually happened

No action required, but your diagnostics change for the better. At nine sites
across the HTTP server, the browser client bundle, and three CLI commands, an
error was composed with a **bitwise** `|` instead of a logical `||` — the
expression evaluated to the number `0`, so a rendered 500 page body, the
express-middleware error handler, and the `protocol:set` / `port:reset` /
`project:add` error output all reported `0` instead of the cause. They now
surface the real stack or message. Separately, the text log formatter spliced
its `%`-tokens with a string replacement, which dollar-expands `$`-sequences in
the message — a `$` followed by a backtick was replaced by the rendered log
prefix itself, recurring at each occurrence — so a message containing a `$` came
out mangled. It now renders verbatim, across every level and every sink (stdout,
mq, file). A framework error raised from a **detached context** (a scheduled
cron or timer, a worker, or a bootstrap-time `getLib()`) no longer crashes the
process with `TypeError: next is not a function` while masking the original
error, and `getLib()` / `getConfig()` no longer crash with an opaque `Cannot
read properties of undefined (reading 'conf')` when configuration is read while
the config build is still partway — for example a fail-closed `${secret:KEY}`
resolution — so the real boot error surfaces instead of a masking crash.

---

## 0.5.16 → 0.5.17

This release ships fixes — no breaking changes. If you install with npm 12,
read the first section: it unblocks the npm 12 install path.

### Fixed — `--allow-scripts=gina` no longer breaks the global install

npm exports every explicitly-set config value to install-script children as
`npm_config_*` environment variables, and npm rejects `allow-scripts` in
project-scoped installs (`EALLOWSCRIPTS`). Gina's post-install runs exactly
such an install — the framework directory's own dependencies — so following
the documented npm 12 remedy (`--allow-scripts=gina`, or `npm config set
allow-scripts=gina --location=user`) made the whole `npm install -g gina`
fail on npm 12 and late npm 11.x. The nested install no longer inherits the
allowance; nothing is lost, since the framework dependencies carry no install
scripts of their own.

This makes `0.5.17` the first Gina version installable on npm 12, where
install scripts are blocked by default and the flag is **required**: without
it, installing Gina ≤ 0.5.16 completes without running the bootstrap (no
`~/.gina`, no framework dependencies — a broken install), and with it, the
install crashed as above. On npm ≤ 11 the `allow-scripts` warning is
advisory — the scripts run without any flag, and no action is needed.

The fix ships inside the installed package itself, so it cannot be applied
retroactively to older versions: to install Gina ≤ 0.5.16, use npm ≤ 11 (or
Bun).

### Fixed — `project:rm --force` and stale-path removal

`gina project:rm @<project> --force` (the short alias) now removes the
registration instead of erroring — the alias had failed an internal `--force`
guard that only the full `project:remove` form passed. And neither
`project:remove` nor `project:rm --force` crashes with `ENOENT` when a stale
project's path can no longer be created (a top-level path such as `/app`, or one
under a read-only parent): it skips the pointless directory re-creation and
removes the registration directly, cleaning `~/.gina/projects.json`, its
state-store mirror, and the project's port assignments — without resurrecting an
empty skeleton directory. No action required; these are cleanup-path fixes.

### Fixed — `bundle:start` honours a bundle's configured default scope

A typo in the scope-resolution expression returned an undefined property, so a
bundle that declared a default scope in its manifest started with an undefined
scope instead of the configured one. `gina bundle:start` now reads the correct
property. Bundles with no configured default scope were unaffected — they
already fell back to the framework default scope. No action required.

---

## 0.5.15 → 0.5.16

This release ships fixes and additions — no breaking changes. Behaviour
notes worth reading before you upgrade: multipart request bodies are no
longer always empty (first section below), and a declared
`settings.i18n.cookieName` now takes effect where it was previously ignored.

### Added — multipart requests now carry their text fields

A `multipart/form-data` request's text (non-file) fields used to be dropped:
only `req.files` was populated, and `req.post` / `req.body` stayed empty. They
are now captured for every client (a plain HTML form, `curl`, the gina client)
and exposed on `req.body` — and, on POST, PUT and PATCH, on the method slot
(`req.post` / `req.put` / `req.patch`) — before your action runs. Values
arrive **verbatim** (no url-decoding, no `"true"`/`"false"`/`"on"`/`"null"`
coercion — the same contract as `application/json` bodies), bracket-notation
names are nested (`item[0][id]` → `{ item: [ { id: "…" } ] }`), and a
duplicated plain name keeps its last value.

**Behaviour note:** `req.post` / `req.body` are no longer always-empty on
multipart routes. A controller that spreads them generically (say, merging
`req.post` into a record on every request) now receives client-supplied fields
on upload routes too — if an upload handler must ignore text fields, ignore
them explicitly.

Two new `settings.json` keys under `upload` cap the capture; a request
breaching either is rejected with **HTTP 400** instead of silently losing
data:

| Key | Default | Effect |
|---|---|---|
| `maxTextFields` | `1000` | Maximum text fields per multipart request. `0` disables the cap. |
| `maxTextFieldSize` | `"1MB"` | Per-field value size cap (`B`/`KB`/`MB`/`GB`, bare number = MB). `0` disables the cap. |

### Fixed — `send(FormData)` keeps its non-file fields in mixed payloads

A `FormData` payload carrying **both** files and regular fields, sent through
the client's `send()`, lost the regular fields — the multipart body was
assembled from the file entries only, so the fields never reached the wire.
They now travel as standard multipart text parts (original bracket-notation
names, values verbatim) and arrive nested server-side exactly as they would on
a file-less submit. Files-only payloads are byte-identical to before.

This fix ships in the browser bundle: after upgrading, rebuild your bundles
(`gina bundle:build`) so each baked `gina.min.js` picks it up.

### Fixed — a rule's `param.title` now sets the page title

The routing-param title promotion had been silently inert since its
introduction: declaring `"param": { "title": "My Title" }` on a rule had no
effect, and the browser-tab title always showed the route name. It now works —
`param.title` lands on `page.view.title`, the stripped route name remains the
**fallback** for title-less rules, and a title set from the controller
(`data.page.view.title`) still wins over both.

If a rule in your app declares a `param.title` you never expected to apply
(because it never did), that title now takes effect — remove the `title` key
from the rule to keep the route-name behaviour.

The title is applied verbatim (no `:param` substitution inside the string);
for dynamic titles, set `data.page.view.title` from the controller. All other
static `param` keys are template-reachable as `page.view.params.<key>`.

The `view:add` layout boilerplate now reads `page.view.title` /
`page.view.lang` (previously the never-populated `page.title` / `page.lang`),
so freshly scaffolded pages render a real tab title and `lang` attribute —
existing apps keep their own layouts and are unaffected.

### Fixed — `settings.i18n.cookieName` is now honoured

The documented `i18n.cookieName` setting had no effect: locale negotiation
always read the fixed cookie name `gina_culture`. The negotiation's cookie
step (after the URL prefix, before `Accept-Language`) now reads the cookie
named by `settings.i18n.cookieName`, and an explicit `null` disables
cookie-based negotiation entirely. An absent, empty, or non-string value keeps
the historical `gina_culture` default, so bundles that never set the key are
unaffected.

**Behaviour note:** a bundle that already declares `i18n.cookieName` — or sets
it to `null` — gets the declared behaviour from this release on; previously
the setting was silently ignored.

### Fixed — locale-database fallback no longer crashes region-less bundles

When a request's negotiated culture had no entry in the framework's locale
database, the fallback path dereferenced `settings.region.shortCode` blindly:
a bundle without a `region` block threw on every affected request (an HTTP
500), and a fallback language itself missing from the loaded region set threw
one step later. The fallback is now guarded and deterministic at both
controller sites: `region.isoShort` (the schema key) wins, the legacy
`region.shortCode` is still honoured for hand-authored configs, and `en` is
the final default — with a missing entry resolving to an empty locale set
instead of crashing.

---

## 0.5.14 → 0.5.15

This release ships fixes and opt-in additions — no breaking changes, and
nothing to change. The fixes make previously failing flows work, so their notes matter
mostly if your app worked around one of them.

### Added — a trigger can opt out of the popin hover/focus preload

Popin and dialog triggers with an explicit source URL (`data-gina-dialog-src`, legacy
`data-gina-popin-url`) are warmed by a preload: the GET fires as soon as the pointer
hovers the trigger (or it gains focus), so the popin opens instantly on click. That
assumes the GET is safe to fire early, as HTTP semantics intend. If a trigger's GET has
server-side effects, declare it with `data-gina-dialog-preload="false"` (honored on
legacy triggers too; the value is matched case-insensitively): the warm-up GET no longer
fires on hover or focus, and the click loads normally, at click time. Existing triggers
are unaffected — the preload default is unchanged.

### Fixed — `gina.popin` sees every popin, so a form can redirect into a different one

The popin registry is now shared across every `Popin` instance, and `gina.popin` is
published once as a live object. Previously the published accessors were bound to the
registry of the **first** instance: `gina.popin.getPopinByName()` / `getPopinById()`
resolved only the popins that instance had registered, and `gina.popin.activePopinId`
did not track the popin actually open. In practice that broke a form submitted from a
popin whose response redirects into a **different** popin — the target could not be
resolved, so the submit always failed with a 422 `Popin with name … not found`
validation error. That flow now works end to end: the original popin closes, the
target popin opens with its content, and `gina.popin.activePopinId` follows it. Popins
registered after page load are visible to the accessors too.

Nothing to change. If your app worked around the blind accessors by walking
`gina.popin.$popins` to find a popin by name, the walk still works — keeping it or
replacing it with `gina.popin.getPopinByName()` are both fine.

### Fixed — a redirect into a popin opens it content-first

A form submit whose response redirected into a popin could open that popin before its
content arrived, flashing an empty popin — and a failed load left it open and empty.
The popin is now opened through the load handle: the response body is injected first,
and a failed load no longer opens anything. A redirect that targets a different popin
than the one currently open also closes the original popin, as intended. Nothing to
change.

### Fixed — server-side validation of a data object against a rules object works

`gina.plugins.Validator(rules, data, formId[, culture])` used to crash on its first
field with a `TypeError`, so validating a plain data object against a
[rules object](/reference/validation-rules) had never worked server-side. Plain rules
now validate and return `{ isValid(), error, data }`, and the optional trailing
`culture` localises the error labels from the bundle's locale catalog. Conditional
(`_case_`) rules remain client-only — a rules object relying on them still cannot be
validated server-side. On the client, the same guard means a rule naming a field that
is missing from the form now logs the intended console warning instead of throwing.

Nothing to change.

### Fixed — `X-Powered-By` suppression reaches static and error responses

A request for a missing file under a statics-served prefix returned gina's 404 carrying
`x-powered-by: Gina/<version>` even when every documented suppression mechanism was
configured: `server.hidePoweredBy` only gated the Isaac `/_gina/*` endpoints, the
`HidePoweredBy` middleware never runs for static requests, and an `env.json`
`server.response.header` override was applied after the HTTP/1.1 error response had
already flushed its headers. `settings.json > server.hidePoweredBy: true` now
suppresses the framework's `X-Powered-By` emission on every response it originates —
routed pages, static-asset serves, static and traversal 404s, and framework error
pages, on both engines — and an explicit `X-Powered-By` entry in
`env.json > server.response.header` now replaces the value on HTTP/1.1 error responses
exactly as it already did on routed ones.

Nothing to change: with no opt-in configured, the header is emitted exactly as before.
See the [security headers guide](/guides/security-headers) for the mechanism split.

### Fixed — upload reset/delete removes the preview, restores class-hidden inputs, and gains removal callbacks

Clicking an upload preview's **Reset**/**Delete** link now actually removes the preview
image, its trigger link, and the generated hidden fields. Previously a script error cut
the cleanup short: the preview was only hidden in place, re-uploading stacked duplicate
trigger ids, and a second remove in the same page life could throw instead of working.
The removal request still goes out before any DOM cleanup.

Two opt-in additions ride the fix. If your markup hides the file input (or its wrapper)
with a CSS class, name it in `data-gina-form-upload-hidden-class` and the add-affordance
restore removes that class from the input and its parent — the previous restore only
handled inline styles, so a class-hidden input never came back. And
`data-gina-form-upload-on-reset` / `data-gina-form-upload-on-delete` name a `window`
callback (the `data-gina-form-upload-on-success` convention) run once per removal, after
the removal request, with `{ $upload, bindingType, files }`. The documented
`data-gina-form-upload-reset-trigger` / `-delete-trigger` id override also works now —
its attribute name was previously built incorrectly, so it never matched.

Nothing to change — but if your app worked around the dead removal with its own click
handler on the trigger ids, retire that handler when you pick this up, or removals will
be handled twice. Details in the
[file uploads guide](/guides/file-uploads#previews-and-removal).

### Fixed — `$form.send(FormData)` nests bracket-notation field names

The programmatic `$form.send(FormData)` submit path now nests bracket-notation field
names (e.g. `item[0][id]`) into objects and arrays before posting, matching the
declarative submit path — previously they were transmitted as literal JSON keys, so the
server exposed `item[0][id]` as an un-nested key. File uploads and plain-object `send()`
payloads are unchanged.

Nothing to change unless your server-side code read the flattened `item[0][id]`-style
keys from a `send(FormData)` payload; with this fix the same submit arrives nested, as it
already did from the declarative form path.

### Fixed — a fields-only multipart POST no longer hangs, and a malformed multipart body no longer crashes the bundle

A `multipart/form-data` POST carrying only text fields (no file parts) previously hung
until a front-proxy timeout — the request-lifecycle continuation resumed only from inside
the per-file write-stream finish loop, which ran zero times when there were no file parts;
it now resumes directly. Separately, a malformed, empty, or non-multipart body sent with a
`multipart/form-data` content-type previously surfaced as an uncaught parser error that
triggered a SIGTERM worker shutdown — a single unauthenticated request could kill a
worker; the parser error is now caught and answered with HTTP 400. Both run before
routing, so any path was affected. Non-file fields remain dropped from `req.post` (the
documented multipart limitation) — only the hang and the crash are fixed.

Nothing to change.

---

## 0.5.13 → 0.5.14

### Fixed — a non-string error label degrades instead of taking the form down

An error label that is not a string is now **discarded**: the validator warns once in
the browser console, naming the rule, and renders that rule's English default. This
applies wherever the label came from — a `_validator` catalog entry, a
`gina.validator.setErrorLabels()` override, a rule's `errorMessage` argument, or a
per-field `error`. `0.5.13`'s boot lint only ever saw the first of those.

Previously the engine threw while rendering the message, and nothing on the path
caught it: the validation pass aborted, so no error message appeared and the form
never submitted through Gina. Worse, the same check runs when forms are first bound,
and the binding loop was unguarded — so one bad label left **every form further down
the page unbound**, silently reverting the page to plain browser submits with no
client-side validation.

Nothing to change. If a form on `0.5.13` or earlier mysteriously stopped submitting,
or a page's later forms behaved as if Gina were absent, check the boot log for the
`_validator` warning.

### Fixed — `query` responses no longer require a `{{placeholder}}`

A field-level error returned by a [`query`](/reference/validation-rules#query)
validator's endpoint is now rendered verbatim when it contains no `{{path}}`
placeholder. Previously a plain string such as `"Already taken"` threw while the
message was being compiled, taking the validation pass with it. A non-string field
error is now ignored in favour of the rule's resolved label.

### Fixed — server stack traces no longer leak into form field errors

A validation error tied to a specific form field — an
[`ApiError`](/globals/api-error) built with a `fieldName` — is no longer allowed to
carry a raw server stack trace to the browser outside `local` scope. This happens when
the underlying error has no message of its own (so Gina falls back to its stack), or
when an application passes a stack string as the message: the field now shows a neutral
**"An error occurred"** in `beta`, `testing`, and `production`, while the full stack is
kept in `local` scope for debugging. It mirrors how Gina already strips the stack from
the JSON error body outside `local` scope, and closes the one channel that strip could
not reach — the per-field message map, which the form validator renders verbatim.

Nothing to change. To show your own copy for a field, pass a real (non-stack) message
to `ApiError`; the neutral text only replaces a message that is itself a stack trace.

### Fixed — a changed validation message is re-announced to assistive technology

When a form field stays invalid but its error message changes — the value now fails a
different rule, the message depends on the value, or a
`gina.validator.setErrorLabels()` override changed the label — the new message is now
re-announced through the form's ARIA live region. Previously only the *visible* message
updated while a screen reader kept announcing the **first** message. Nothing to change.

Note on timing: register `gina.validator.setErrorLabels()` overrides **before a form's
first validation** — for example inside the validator's `ready` handler — and with the
bundle's culture configured (labels register under `gina.config.culture`, whispered from
the negotiated request culture). A `setErrorLabels()` call made *after* a field is
already showing an error, or with no culture set, does not refresh that field's current
message until it next clears and re-errors; labels registered before first validation
take effect normally.

---

## 0.5.12 → 0.5.13

`0.5.13` is a small additive release — **no breaking changes and no settings reset** (the `shortVersion` stays `0.5`). It adds one boot-time diagnostic for locale catalogs. No action is required.

### Added — unrenderable `_validator` catalog labels warn at bundle boot

Gina now warns at bundle boot when a `_validator` label in a locale catalog cannot be rendered. Built-in rule labels accept only the placeholders `%l` (field label), `%n` (field name) and `%s` (size); any other `%`-token — including a literal percent glued to letters, as in `20%sur le prix` — is substituted with the string `undefined` in the message shown to the user, and a non-string label makes the validator throw. A `_validator` section that is not an object warns too. The catalog still loads and boot is never blocked; the warning names the offending rule and the catalog file, so a translation typo surfaces in the boot log instead of in production copy. Nothing to change — a catalog whose labels use only the three supported placeholders behaves exactly as before.

---

## 0.5.11 → 0.5.12

`0.5.12` is a feature + fix release — **no breaking changes and no settings reset** (the `shortVersion` stays `0.5`). It rounds out the validator + i18n work and carries a batch of CLI, popin, and request-path fixes. Two items may want your attention: if you style form submit buttons, see the `aria-disabled` note below; and a malformed `@<project>` CLI token now errors instead of being silently ignored.

### Added — FormValidator built-in rule labels localise from the i18n catalog

Built-in validation messages (`isEmail`, `isRequired`, …) now localise per culture from `bundle/locales/<culture>.json` under a new `_validator.<rule>` namespace, on both the server-rendered and client-side paths. English defaults fill untranslated rules (culture → base-language → English fallback). An app can override per key with `gina.validator.setErrorLabels(labels[, culture])`; precedence is `setErrorLabels` > bundle catalog > English, and a per-field / per-rule message still wins over all of it. No action required — bundles without a `_validator` catalog section keep the English defaults.

### Added — per-bundle i18n catalogs now activate at boot

A bundle shipping a `locales/` directory now loads its catalogs at boot, which activates URL-prefix / cookie / `Accept-Language` culture negotiation, the `t()` global, and the `t` template filter. Opt-in (no `locales/` → unaffected) and non-fatal (a malformed catalog warns instead of blocking boot). Two negotiation bugs are fixed alongside: `req.culture` / `gina.config.culture` previously resolved to `en`/empty regardless of the configured culture (#B83), and were dropped on warm/cached page reloads (#B84). If your bundle ships `locales/` and relied on negotiation being inert, note it is now live; precedence is URL prefix → cookie → `Accept-Language` → bundle `settings.region.culture` → `GINA_CULTURE` → `en`.

### Added — `data-gina-form-rule` forms auto-boot the client validator

A form declaring `data-gina-form-rule` with a matching rule set now validates automatically in the browser at page load — no per-page boot code needed. Explicit construction (to attach submit/lifecycle handlers) still works and is idempotent with the auto-boot.

### Fixed — submit-trigger disabled state is now `aria-disabled` (action may be required)

While live-check reports a form invalid, FormValidator no longer natively `disabled`s the submit `<button>` (a natively-disabled button emits no click, so it became a dead no-op). The invalid trigger is now marked `aria-disabled="true"` + class `gina-form-submit-disabled` and stays operable — a click surfaces every field error and focuses the first invalid field, while the real submit stays gated on validity. **Action:** style the `[aria-disabled="true"]` / `.gina-form-submit-disabled` submit-trigger state, since the framework ships no button CSS. A submit button rendered `disabled` in your markup still enables on valid input (or when live-check is off).

### Fixed — an empty required field shows a single message

A required field left empty now shows only "is required" instead of also stacking "is not valid" from `isEmail` / `isFloat` / `isInList` / etc. Optional empty fields still pass; a filled-but-invalid value still reports its own rule error.

### Fixed — a malformed `@<project>` CLI token now errors (behaviour change)

An `@<project>` token starting with a character outside `[a-z0-9_.]` (an uppercase letter, a dash, or a bare `@`) used to be silently ignored — the command ran against the current-directory project or all projects with exit 0, and a mutating command like `bundle:add` could target the wrong project while reporting success. Such tokens are now rejected with `is not a valid project name` and exit 1. If a script relied on the old silent-drop behaviour, pass a valid project name.

### Fixed — other CLI and request-path fixes

- `GINA_HOMEDIR` overrides are honoured by every spawned child command — `project:add` (and its `--scope` / `--env` children) and the auto-link + `project:start` / `stop` / `restart` delegations no longer act on the default home.
- `project:start @<project>` / `service:start @<project>` delegate to their handlers instead of misparsing the reference as a framework version and hanging; the version-reject paths flush and exit non-zero instead of hanging.
- Bulk `start` / `stop` / `restart` on a project with no bundles answers cleanly instead of crashing the framework daemon; `bundle:restart <unregistered>` reports "is not registered".
- The framework-not-installed guard points at the real `gina framework:add <version>` (was a non-existent `framework:install`).
- The HTTP/1.x static directory-to-index redirect sends an unconditional 301 outside dev (was a blank 200 with a `Location` header).
- Proxied XHR / popin (`isXhrRedirect`) redirect responses carry the same `no-store` cache directives as plain redirects (#B75).

## 0.5.10 → 0.5.11

`0.5.11` is a feature + fix release — **no breaking changes and no settings reset** (the `shortVersion` stays `0.5`). It adds one CLI feature and carries one fix; neither requires a change to your code or config.

### Added — `gina image:build`: package a bundle as an OCI container image

`gina image:build [<bundle>] @<project>` synthesizes a `Containerfile` + build context from the project's registered state (bundles, entry, ports, env model, Node engine floor) and executes the build with buildah — natively on Linux, or on a container host reached over ssh (`GINA_CONTAINER_HOST=ssh://[user@]host[:port]` env override → native buildah → `container.host` in `~/.gina/<shortVersion>/settings.json`). A non-dev `--env` ships the release tree built in-image by `gina bundle:build`, so a production image never runs dev-mode hot-reload; the image boots via `gina-init` + `gina-container` (SIGTERM drain) and the `EXPOSE`d port is computed deterministically from the port allocator. `${secret:KEY}` placeholders ride byte-verbatim and resolve from the container environment at runtime — never baked. `--emit` prints the synthesized artifact without building; `--format=json` emits a one-shot machine-readable result; `--stream` emits NDJSON progress frames. See the [`image` CLI reference](/cli/cli-image). **Additive — no migration action required.**

### Fixed — proxied redirects now carry no-store cache headers

Framework-emitted redirects on requests classified as reverse-proxied now include the no-store cache set (`Cache-Control: no-cache, no-store, must-revalidate` + `Pragma` + `Expires`), so a browser never caches a proxy-context-derived redirect — previously a cacheable `301` emitted with proxy-derived content could keep replaying from the browser cache. The inter-bundle query 3xx forward path inherits the set. Direct (non-proxied) production redirects are byte-identical, and the `301` default and route-declared `param.code` are untouched. **No migration action required.**

---

## 0.5.9 → 0.5.10

`0.5.10` is a fix release — **no breaking changes and no settings reset** (the `shortVersion` stays `0.5`). It carries one bug fix; it requires no change to your code or config.

### Fixed — server-side cross-bundle `getRoute('route@bundle').toUrl()` resolves the public host on reverse-proxied deployments

On a reverse-proxied deployment, a controller building a cross-bundle URL server-side — e.g. `self.redirect(getRoute('<route>@<otherBundle>').toUrl())` — could emit an unreachable internal host with a doubled web root (`<internal-host>:<port>/<origin-web-root>//<target-web-root>`) on a proxied request. It now resolves the public host for both the Isaac and Express engines. This completes the `0.5.9` browser-side cross-bundle URL fix (#B66) on the server side; single-public-host-per-worker deployments are otherwise unchanged. **No migration action required.**

---

## 0.5.8 → 0.5.9

`0.5.9` is a fix release — **no breaking changes and no settings reset** (the `shortVersion` stays `0.5`). It carries one security fix and three bug fixes; none require a change to your code or config.

### Security — reverse-proxied deployments no longer disclose a bundle's internal host to the browser

On a reverse-proxied deployment, the client `gina.config.hostname` and the fetched `/_gina/assets/routing.json` previously serialized each bundle's internal `scheme://host:port` to the browser. A proxied client now receives a public host-only origin and a host-stripped routing map, while direct `host:port` access (no proxy) stays byte-identical. This also fixes cross-bundle client `getRoute(...).toUrl()`, which previously resolved to the unreachable internal host on such deployments and now resolves same-origin. Follow-on to the `0.5.8` host-context request-scoping fix. **No migration action required** — the browser simply stops receiving internal host addresses it could never reach.

### Fixed — server-side proxy host context is request-scoped

The server-side URL, redirect, and config resolvers (`self.getConfig()`, `self.redirect()`, server-rendered asset host resolution, and the per-request routing clone) now resolve the host of the request in hand rather than the last proxied host the worker served. A worker that serves a mix of proxied and direct traffic — or several public hostnames — no longer inherits a stale proxied host. Requests without a per-request proxy classification (the Express engine, released responses, WebSocket-query callers) fall back to the previous worker-global behaviour, so single-public-host-per-worker deployments are unchanged. **No migration action required.**

### Fixed — `connector:add` / `connector:rm` / `connector:migrate --fix` on a comment-headed `connectors.json`

Rewriting a `connectors.json` that carries a leading comment header (including the scaffolded example block) previously split the file at the first raw `{` — which landed inside the example comment — commenting out the JSON body's opening brace and dropping the rest of the header, so the file no longer parsed. The header/body split is now comment-aware and preserves the full comment header verbatim; a comment-free `connectors.json` still rewrites byte-for-byte as before. **No migration action required.**

### Fixed — latent `ReferenceError` in server-side URL resolution for redirect routes

A leftover debug statement referenced an undefined variable and would throw whenever a redirect-flagged route's `toUrl()` was resolved server-side. The stray statement has been removed. **No migration action required.**

---

## 0.5.7 → 0.5.8

`0.5.8` is an additive release — **no breaking changes and no settings reset** (the `shortVersion` stays `0.5`). The new CLI command is additive and the fixes below require no action.

### Added — `gina connector:models`

List the model catalogue a configured AI connector's provider can serve: `gina connector:models <connector> @<project> [<bundle>]`. It is the read sibling of `connector:test --connect` — the same credentialed `models.list()` call, but it returns the model list instead of only a count. Text mode prints one model id per line; `--format=json` emits `{ project, connector, provider, count, models }` with each entry passed through verbatim from the provider (only `id` is guaranteed across providers). It resolves config only and never prints credentials; offline providers such as `ollama://` work with no internet.

### Added — per-group `gina help [<group>]`

`gina help` now accepts a command group (`gina help framework`, `gina help bundle`, …) to print just that group's commands, and an unknown action prints a clean message instead of a raw stack.

### Fixed — reverse-proxy host context no longer freezes

For bundles behind a reverse proxy, the internal host context derived from a port-less `Host` header or `X-Forwarded-Host` (used when building absolute URLs and forwarding internal cross-bundle calls) was captured once at the first proxied request and reused for the life of the worker. It is now re-derived per request, so single-hop and multi-hop (`X-Forwarded-Host`) reverse-proxy deployments resolve the correct host. A bundle accessed directly on `host:port` (no proxy) is unaffected. **No migration action required.**

---

## 0.5.6 → 0.5.7

`0.5.7` is an additive release — **no breaking changes and no settings reset** (the `shortVersion` stays `0.5`). The new job-store backends and retries are opt-in; the fixes below require no action.

### Added — durable async-job stores (SQLite, MongoDB, Redis)

The async-job primitive ([`self.startJob`](/guides/async-jobs)) can now persist job records in a real backend instead of process memory: point `jobs.store` (app.json) at a `connectors.json` entry and job records survive bundle restarts and are readable cross-process — the deferred function still runs in the creating process.

- **SQLite** (`"connector": "sqlite"`) — single host; `node:sqlite` built-in, zero new dependencies. The database path goes in the entry's `file` key.
- **MongoDB** (`"connector": "mongodb"`) — shared mongod; durable and visible across processes and pods. Driver resolved from the consuming project's `node_modules` (`npm install mongodb`).
- **Redis** (`"connector": "redis"`) — shared Redis via `ioredis` (project `node_modules` fallback); per-state and expiry indexes are maintained atomically so list and sweep never scan the keyspace. Redis Cluster is supported via a hash-tagged key prefix (default `{jobs}:`).

A configured store that cannot be built **fails the boot** instead of silently degrading to the in-memory store; leaving `jobs.store` unset keeps the in-memory behaviour, unchanged.

**No action required** — opt-in. See [Durable job records](/guides/async-jobs#durable-job-records-connector-store).

### Added — failed-job retry (opt-in)

Pass `maxAttempts` to `self.startJob` / `lib.job.create` and a failed attempt is retried on the creating process with exponential backoff (`jobs.retryBackoffMs` in app.json, default 1000 ms, doubling per attempt). Between attempts the record returns to `pending` with the last error and a `nextRetryAt` timestamp visible; `failed` and `completed` remain strictly terminal, and the completion webhook fires exactly once, after the final attempt. The default stays a single attempt — behaviour is unchanged unless you opt in.

**No action required** — opt-in. See [Retries](/guides/async-jobs#retries-opt-in).

### Changed — npm 12 readiness

npm 12 blocks install scripts by default, and Gina's post-install bootstraps `~/.gina` and the framework dependencies. On npm 12+ hosts, install or upgrade with `npm install -g gina@latest --allow-scripts=gina`, or allow it once for all global installs with `npm config set allow-scripts=gina --location=user`. Gina's own release/pack tooling also accepts npm 12's changed `npm pack --json` output shape. Nothing changes on npm ≤ 11.

**Action required only on npm 12+ hosts** — add `--allow-scripts=gina` when installing or upgrading. See [Installation](/getting-started/installation).

### Security — static-asset path traversal fixed

A request URL containing `../` — or its percent-encoded forms (`%2F`, `%2e%2e`) — could escape a `statics.json` mapping's target directory and read any sibling file under the shared root (configuration, credentials, or server-side source). Both static resolvers now canonicalise the resolved path and confine it to its mapping target (or `publicPath`), returning **404** on any escape. Legitimate assets are served unchanged.

**Action: upgrade.** No configuration change is required — the confinement is automatic. If a deployment serves static assets through `statics.json` mappings on a shared root, treat this upgrade as security-relevant. See [Security](/security).

### Fixed / behaviour notes

- **Production 500 on cached swig routes.** A route carrying a `cache` setting in `routing.json` and rendered by the swig engine returned HTTP 500 on every request in production mode (a `ReferenceError` in the render cache writer). Fixed — route caching works again with no config change.
- **Cross-request isolation in the render delegates.** Under production concurrency: a swig render suspended at its template read could resume with a concurrent request's closures and merge that request's page data into its own response; a finishing stream could release a concurrent request's `req`/`res` references instead of its own and report stream errors through the wrong controller; and the JSON delegate's cache writer could report a cache-configuration error through a concurrent request's controller. All per-request state in the render delegates is now function-scoped.
- **`"connector": "redis"` entries no longer abort the boot.** The model layer treated the Redis connector's missing boot connector as fatal, so even the documented Redis session-store configuration could not boot with its entry declared. The Redis connector now ships a no-op boot connector (no connection opened, no driver required at boot).

---

## 0.5.5 → 0.5.6

`0.5.6` is an additive release — **no breaking changes and no settings reset.** Everything below is additive; the new Inspector observability aids are opt-in and dev-mode-only.

### Added — application-event Inspector signal

The dev Inspector gains an **Event** tab that surfaces the named application events a request emitted. Raise an event from a controller with `self.emitEvent(name, metadata)`, or from model / service code with `require('lib/inspector-events').emit(name, metadata)`; the tab tails them live over the authenticated agent channel while the request runs and shows an end-of-request snapshot when it finishes.

Events are captured only in dev mode (or while an instrumentation window is open). The event *name* always rides the wire, but the `metadata` values you attach are captured only when `inspector.events.captureArgs` is `true` (default `false`). A separate `inspector.events.topics` allow-list (default `[]`) can mirror selected entity-trigger emits onto the same signal, matched by exact name or a single leading or trailing `*` wildcard; bridged entity events carry only a safe `{ ok, error }` summary, never raw entity-record data.

**No action required** — additive. See the [Inspector guide](/guides/inspector#event).

### Added — AI connector streaming + Inspector "AI stream" tab

The AI connector gains a streaming API: `getModel('<name>').stream(messages, options)` returns an `EventEmitter` emitting `start` / `delta` / `done` / `error` events for token-by-token inference (plus an `.onComplete(cb)` shim mirroring `infer()`), across Anthropic and every OpenAI-compatible provider. The buffered `getModel('<name>').infer(...)` is unchanged.

The dev Inspector gains an **AI stream** tab showing the token streams a request made — live token frames (model, role, running token counts, latency) while the request runs, plus an end-of-request snapshot. Stream *metadata* is always captured in dev mode; the prompt and generated text ride the wire only when the opt-in `inspector.ai.captureText` setting is `true` (default `false`).

**No action required** — additive. See the [AI connector guide](/guides/ai) and the [Inspector guide](/guides/inspector).

### Added — `connector:infer` one-off inference CLI

A new `connector:infer` CLI command runs a single inference against a configured `ai` connector **without booting the bundle**. It resolves the project's `connectors.json` (shared, or the shared+bundle merged view when a `<bundle>` is named), resolves `${secret:KEY}` credentials from the CLI's own environment (never echoed), instantiates the connector directly, and prints the normalised result. `--format=json` emits `{ content, model, usage }` (add `--raw` to include the full provider response); `--stream` emits the inference as newline-delimited JSON (NDJSON) token frames for token-by-token consumption. Useful for smoke-testing connectivity and credentials from CI, or scripting a one-off inference from a shell. It only works with `ai` connectors (it errors cleanly on any other type), and a detached CLI sees only its own shell environment — export the key or pass `--api-key=<literal>`.

**No action required** — additive. See the [connector CLI reference](./cli/connector.md#connectorinfer) and the [AI connector guide](/guides/ai).

### Added — `connector:test` connector readiness probe CLI

A new `connector:test` CLI command probes a project's configured connectors for readiness and exits non-zero on any failure — a CI gate that complements `connector:list` (driver-install status) and `secrets:check` (env presence). By default it is **validate-only and offline**: for each connector it checks that the `connector` type / `ai` protocol is recognised, the npm driver is installed at `<project>/node_modules`, and every `${secret:KEY}` placeholder resolves from the environment — no network, no connector instantiated. `gina connector:test [<connector> [<bundle>]] @<project>` tests one connector or every connector in a project (bare → every registered project); `--format=json` emits a machine-readable report. The opt-in `--connect` flag adds a live connectivity probe: for `ai` connectors it calls the provider's `models.list` (a credentialed request that authenticates with **zero generation tokens**), while DB/cache connectors report the live probe as skipped for now (config / driver / secrets are still validated).

**No action required** — additive. See the [connector CLI reference](./cli/connector.md#connectortest) and the [Secrets guide](/guides/secrets).

### Fixed / behaviour notes

- **`getModel()` now exposes the AI inference API.** `getModel(name).infer(...)` and `getModel(name).stream(...)` work as documented. Previously an `ai` connector returned only a bare connection wrapper (so `self.inferAsync` and AI token-stream capture were unreachable). If you worked around this, you can now call `getModel()` directly.
- **`gina project:import` is now additive across release targets.** Re-importing a project for a new scope/env no longer rebuilds the per-bundle `manifest.json` release map from scratch — which previously dropped targets registered under other scopes/envs and reset custom target paths/versions. No action needed; existing targets are preserved.
- **`gina stop` reports bundles still running.** `gina stop` (alias of `framework:stop`) stops the framework socket server only; it now lists any detached bundle processes still running and points to `gina bundle:stop` / `gina project:stop`.

---

## 0.5.4 → 0.5.5

`0.5.5` is an additive release — **no breaking changes and no settings reset.** Almost everything is opt-in; the one default-behaviour change — inter-bundle `self.query()` retry safety — is called out below.

### Added — Bun runtime support

Gina now runs on the [Bun](https://bun.sh) runtime as a supported, CI-tested target. Install it globally with `bun add -g gina` (Bun `>= 1.2`), alongside the usual `npm install -g gina`. Bun skips dependency install scripts by default, but Gina needs no extra setup — it self-bootstraps on first run, so there is no `trustedDependencies` entry to add. Node.js (`>= 22, < 27`) is unchanged and remains fully supported.

One caveat applies only if you host a bundle on Bun **and** opt into WebSocket-over-HTTP/2 (off by default): Bun does not advertise the HTTP/2 extended-CONNECT capability, so standards-compliant clients won't open a WebSocket over HTTP/2 against it. This is an upstream Bun `node:http2` limitation, not a Gina one — every other path (HTTP/1.1, the standard HTTP/2 request/response cycle, and HTTP/1.1-Upgrade WebSockets) works unchanged.

**No action required** — additive. See [Installation](/getting-started/installation).

### Added — `gina framework:reset` (factory reset)

`gina framework:reset` (shorthand `gina reset`) clears `~/.gina` (settings, project registry, env config, port allocations) at runtime, so it rebuilds to defaults on the next command. It is the package-manager-agnostic counterpart to `npm install -g gina@latest --reset` and the only factory reset available under Bun, which skips the npm install lifecycle the `--reset` flag relies on. It refuses while the daemon or bundles are running unless `--force`. **No action required** — additive. See [Factory reset](/getting-started/installation#factory-reset).

### Added — WebSocket routes in `routing.json`

You can now declare a WebSocket-over-HTTP/2 endpoint directly in `routing.json` with `"method": "ws"` and a `param.wsHandler` pointing at a `channels/<name>.js` handler — no programmatic `app.onWebSocket()` call needed. Declared routes support `:param` path segments, per-route `param.wsOptions` (`maxPayload` / `protocol` / `closeTimeout`), and a new `session.query()` for cross-bundle HTTP calls from inside a handler. Requires the Isaac engine with `http2Options.enableConnectProtocol` set to `true`. **No action required** — additive and opt-in. See the [WebSocket over HTTP/2 guide](/guides/websockets).

### Added — framework version management CLI

`gina framework:add <version>` installs a published framework version side-by-side so a bundle can pin it via `--gina-version` (or a manifest `gina_version`), without changing the default; `framework:list` shows the active, side-by-side, and archived versions; `framework:remove` reverses an add; and `framework:update` reconciles the `~/.gina/` state stores to the installed framework version (dry-run by default, `--fix` to apply). Relatedly, `project:status` and `bundle:status` `--format=json` now report a `framework` field (the version each project/bundle resolves to) and a `gina_version` field (the per-bundle pin, `null` when unset). **No action required** — additive.

### Added — `project:move`, `project:backup`, `project:restore`

`gina project:move --to=<path>` relocates a project's source directory and updates its `~/.gina/` registry entry (refuses while a bundle is running or across filesystems). `project:backup` archives a project's source tree to a `.zip`, and `project:restore` rebuilds and re-registers a project from one so it is immediately startable. **No action required** — additive.

### Added — inline CLI manual pages

`gina framework:man` (and `project:man` / `bundle:man` / `service:man`) renders a command group's manual page inline in the terminal, falling back to the group's help text where no man page exists — no browser needed. **No action required** — additive.

### Changed — inter-bundle `self.query()` retries are gated on HTTP-method safety

A transient transport failure on an inter-bundle `self.query()` is now auto-retried only for the HTTP "safe" methods (`GET` / `HEAD` / `OPTIONS` / `TRACE`), so a `POST` / `PUT` / `PATCH` / `DELETE` the upstream may already have executed is no longer silently replayed when only the response was lost. **Action:** if you depend on a non-safe inter-bundle call being retried, opt that call back in with `retryUnsafe: true` in its query options. GET-style calls are unaffected.

### Fixed — popin/dialog triggers no longer fire a duplicate request

A popin or dialog trigger whose target was warmed by a hover/focus preload (`data-gina-popin-url` or `data-gina-dialog-src`) no longer fires a second identical `GET` on click — the in-flight preload is reused even while it is still loading, and `preOpen` popins keep their instant loading skeleton. **No action required** — transparent fix.

### Security

Two hardening fixes ship with `0.5.5`: a WebSocket denial-of-service fix delivered via an `ws` dependency override (reached transitively through `engine.io`), and hardening of the log-tail restart path. **No action required** — both are internal.

---

## 0.5.3 → 0.5.4

`0.5.4` is a patch release — **no breaking changes**. The only item to review is the upload-group default and `maxFieldsSize` suffix change below, and only if your bundle configures file uploads.

### Changed — Node.js 26 supported

The supported Node range now includes Node 26 — `engine.node` is `>= 22 <27`. The full test suite passes on Node 26.3.0 and Node 26 is part of the CI matrix. **No action required** — Node 22 and 24 remain supported.

### Added — `gina bundle:add --ignore-ports`

`gina bundle:add` accepts a `--ignore-ports` flag — a comma-separated list of port numbers (e.g. `--ignore-ports=3000,3001`) excluded from the availability scan when creating or importing a bundle, on top of the already-assigned ports and the reserved 4100–4199 range skipped automatically. Composable with `--start-port-from`. **No action required** — additive.

### Security — uploads to an unconfigured group rejected

A file uploaded to an upload group not configured in `settings.json` is now rejected with **HTTP 400** instead of streaming through unchecked, closing a bypass of a group's `allowedExtensions` and `isMultipleAllowed` limits. A file with no group falls back to the default `untagged` group, and `untagged` is no longer exempt from its own configured limits.

**Action required if you configure uploads:** the shipped `untagged` default now sets `isMultipleAllowed: true`. If your bundle's `settings.json` set `untagged` to `false`, or you uploaded without configuring `upload.groups` at all, review your `upload.groups` configuration so the new enforcement matches your intent.

### Fixed — file-upload directory and limits

- **Configured upload directory honoured.** Multipart uploads now write to the configured `upload.tmpPath` (or a per-group `path`), creating the directory if it does not exist, instead of always using the OS temp dir. Previously the handler read a non-existent `upload.uploadDir` key, so `tmpPath` / per-group `path` had no effect.
- **`maxFields` enforced; `maxFieldsSize` suffix honoured.** `upload.maxFields` (default 1000) is now enforced as a global per-request file-count cap, and `upload.maxFieldsSize` honours its unit suffix (`B`/`KB`/`MB`/`GB`; a bare number is read as MB). **Back-compat:** a `maxFieldsSize` with a non-MB suffix now means what it says — a tighter limit than the previous behaviour, which dropped the suffix and compared the bare number as MB (so `"512K"` was read as 512 MB). The shipped `"2MB"` default is unchanged.

### Fixed — form validation

- **`isFloat` accepts string floats.** Server-side validation of form and urlencoded input (always strings) no longer rejects valid float strings like `"1.5"`. Whole numbers still fail, preserving the rule that an integer is not a float.
- **`isDate` validates non-ISO masks.** A slash mask like `dd/mm/yyyy` with a day past 12 is no longer mis-read as US `MM/DD`; impossible dates such as `2023-02-30` are still rejected.
- **`isDate` chains.** The `isDate` rule now returns the field object on its valid path, so it chains — `field.isDate(mask).isRequired()` — and the parsed Date stays on the field's `value`.
- **Quieter live validation.** While a field is being edited only the soft warning border shows; the error message is revealed once the field is committed (on blur or submit).

### Fixed — dev-mode memory and per-request isolation

- **Two dev-mode heap fixes.** With hot-reload active, the framework no longer accumulates dead module references for five core libraries (collection / merge / uuid / cache / archiver, now loaded once like the logger / job / state singletons), and the HTTP/2 `self.query()` client now releases a settled stream at every non-retry outcome instead of retaining the per-request controller and its config clone. Both could push a long-running dev bundle toward an out-of-memory crash under sustained traffic. **Production was never affected by either.**
- **Tighter per-request config isolation.** The router now deep-clones only the routing table a matched request mutates (sharing the large immutable remainder by reference), and `getRouteByUrl` no longer mutates the shared route config in place — so a `:placeholder` route can't leak one request's resolved values into later requests for the same route.

### Fixed — dev Inspector

The Inspector data tabs now reliably track the page that opened the Inspector (a per-tab channel survives `Cross-Origin-Opener-Policy: same-origin` severing `window.opener`); the Swig render path isolates per-request query/flow capture so concurrent requests no longer cross data; `/_gina/logs` and `/_gina/indexes` resolve the right bundle in reverse-proxy multi-bundle setups; and the SPA is hardened against a corrupted `localStorage` fold-state and an unescaped form-data label. **Dev tooling only.**

### Fixed — Express-engine admin-endpoint parity

The default (Express) server engine now serves `/_gina/info` and `/_gina/cache/stats` with the same always-on, loopback-only, IP-allowlisted behaviour as the Isaac engine (they previously returned 404 there). **No action required.**

---

## 0.5.2 → 0.5.3

`0.5.3` is a patch release — **no breaking changes** and no migration action required.

### Added — `gina port:set --force`

`gina port:set <bundle> <port> --force` reassigns a port already held by another bundle, evicting the prior holder from both port maps. Without `--force`, an already-in-use port is rejected exactly as before. This makes per-bundle port pinning deterministic for one-bundle-per-container deployments. **No action required** — `port:set` is unchanged when the target port is free.

### Fixed — released-response crash family (final members)

Completing the crash-family work from `0.5.1` and `0.5.2`: the two- and three-argument forms of a late `self.throwError(statusCode, error)` (only the single-argument form was guarded before), and the HTML render delegates (swig and nunjucks, including their async variants) invoked after the response was already released, no longer crash the bundle or emit a framework-level unhandled promise rejection. They now log-and-ignore or no-op, matching `renderJSON()` and the streaming delegate. **No action required.**

### Fixed — bundle boot and startup robustness

- **Atomic state-file writes.** The five `~/.gina` state files (`main.json`, `projects.json`, `settings.json`, `env.json`, `locals.json`) are now written via a temp file plus rename, so a concurrent boot of many bundles or containers against the same home directory can no longer read a partially-written file and crash on startup.
- **Boot failures surface their cause.** The `gina-container` launcher and the framework boot path now flush the failure reason synchronously before `process.exit`, so a crash on a piped stdout/stderr (the norm under container log collectors) reports its cause instead of exiting with no message.
- **Command-socket hardening.** The framework command socket now accumulates each connection's payload and parses it only once complete; a malformed, partial, or non-JSON payload is ignored instead of throwing an uncaught exception that could drop the command or shut the framework down.
- **Framework socket port no longer corrupted by bundle flags.** A sub-topic command passed `--port` (e.g. `gina port:set`, `gina bundle:start`) no longer overwrites the framework socket port in `~/.gina/<short>/settings.json` — which previously made later online commands fail with `[ gina ] not started`. The framework-connection flags (`--port`, `--mq-port`, `--host-v4`, `--hostname`, `--debug-port`) now apply as framework settings only for framework-scoped commands (`gina start` / `stop` / `restart`, `framework:*`); other commands interpret them themselves.

### Fixed — other

- **Storage record `_id` collisions.** The storage plugin's record `_id` random suffix was widened to 16 base-62 characters (matching the collection ID convention) to prevent same-millisecond collisions.
- **Unresolved-secret diagnostics.** When a `${secret:KEY}` placeholder cannot be resolved during config load, the framework now logs the failing key name and the bundle/environment config path at debug level. The propagated error message still intentionally omits the key.

**No action required** for any of the above.

---

## 0.5.1 → 0.5.2

`0.5.2` is a patch release — **no breaking changes** and no migration action required.

### Fixed — released-response crash family completed (bundle-killing)

Building on the `throwError()` and HTTP/2 query-path guards in `0.5.1`, thirteen more synchronous controller APIs — `renderJSON()`, `redirect()`, `store()`, `push()`, `renderStream()`, `pauseRequest()` / `resumeRequest()`, `downloadFromLocal()`, and the request-method / popin / form-rule helpers — no longer crash the bundle when a controller action keeps running after a terminal exit (typically a `redirect()` that lets the middleware chain continue) and then dereferences the already-released request or response. Each now no-ops or notifies through its existing callback / event channel instead of escalating to an `uncaughtException` → SIGTERM bundle shutdown; live requests are byte-for-byte unaffected. **No action required.**

### Fixed — exhausted HTTP/2 502 retries now surface a typed error

An inter-bundle `self.query()` over HTTP/2 that exhausted its retries against an upstream returning 502 used to hand the Bad Gateway response body to the caller as if it were valid data (a JSON-shaped body was even relabelled `status: 200`). Exhausted 502s now surface `status: 502`, `code: BAD_GATEWAY` to the caller, matching how timeout, stream-error, and premature-close exhaustion are already reported; non-critical queries still swallow it. **No action required.**

---

## 0.5.0 → 0.5.1

`0.5.1` is a patch release — **no breaking changes** and no migration action required.

### Fixed — released-response crash family (bundle-killing)

A late `throwError()` after the response was already sent — e.g. an entity or query callback resuming after a `redirect()` had already issued its 301 and released the per-request response — dereferenced the released response and escalated to an `uncaughtException` → SIGTERM bundle shutdown that dropped every in-flight request. Late `throwError()` calls now log the swallowed error and no-op, and `headersSent()` treats a released response as already-sent so second render calls no-op too. The same guard family covers the HTTP/2 inter-bundle `query()` paths: retry re-entries, late upstream responses, and both 3xx redirect intercepts no longer crash when the originating request has already terminated. **No action required.**

### Fixed — dev-mode hot-reload memory leak (OOM under sustained load)

The dev-mode per-request hot-reload eviction cycles retained ~1.8 MB of live heap per request through dead `module.children` references, killing heavily-loaded dev bundles with a heap-limit OOM. Both eviction cycles now prune stale module references; production mode was never affected. **No action required.**

### Fixed — inter-bundle proxy Content-Type

`query()` over HTTP/2 no longer re-labels the raw-JSON body it serializes itself with the incoming request's Content-Type, so a urlencoded browser POST proxied between bundles no longer corrupts `+`/`%XX` sequences inside JSON string values. **No action required.**

### Also new — ROADMAP consistency release gate (maintainer tooling)

Stable publishes of the framework now abort when a ROADMAP.md row is stale relative to the version being released, alongside the existing README freshness gate. Maintainer-side only; **no action required.**

---

## 0.4.7 → 0.5.0

`0.5.0` is an additive release — **no breaking changes** for documented usage patterns; one packaging change is noted below for projects that deep-require into the gina package by path.

### What's new — native ESM entry points

`package.json` now declares an `"exports"` map with dual CJS/ESM entry points, so ESM projects and modern bundlers can import Gina natively:

```javascript
// ESM
import gina from 'gina';        // the framework entry — same object require('gina') returns
import gna from 'gina/gna';     // the explicit-exports helper module

// destructure helpers AFTER framework boot — the gna properties are
// getters that resolve at access time
const { getContext, getConfig } = gna;
```

Both ESM entries expose a **default export only**: the framework object is assembled at runtime by the CJS core, and the `gina/gna` helpers are getter properties that resolve after framework boot — static named ESM exports would freeze `undefined` pre-boot. CJS `require()` resolution is byte-identical to previous releases, and TypeScript declarations keep resolving through per-entry `types` conditions. **No migration action required** for `require()`-based projects.

### Packaging change — undeclared deep subpaths are no longer resolvable

With the `"exports"` map in place, the package's Node-resolvable surface is exactly the bare specifier (`gina`), `gina/gna`, and `gina/package.json`. A project that deep-requires into the package by an undeclared path (e.g. `require('gina/framework/v<version>/lib/...')`) will get `ERR_PACKAGE_PATH_NOT_EXPORTED`. No supported usage pattern does this — client-side RequireJS IDs such as `gina/validator` are unaffected (they are resolved by the browser loader, not Node) — but if your project does, switch to the documented entry points or the runtime `lib` registry. **No action required** otherwise.

### What's new — mixed template engines per bundle (extension-keyed dispatch)

A single bundle can now mix swig and nunjucks. An explicit template extension routes the render to its engine, regardless of the bundle-level `render.engine` setting:

```json
// templates.json — the "reports" section renders through nunjucks,
// every other section keeps the bundle's engine (swig by default)
{
  "_common": { "html": "templates/html" },
  "reports": { "ext": "njk" }
}
```

`self.setTemplate(file, '.njk')` switches a single render the same way. The precedence is the setTemplate override extension, then the section's `ext`, then the `.html` default — `.njk` renders through nunjucks, `.swig` through swig, and `.html` (or any other extension) keeps following `render.engine`, so existing bundles behave identically. Bundles whose templates.json declares a `.njk` section get the same fail-fast `NUNJUCKS_NOT_INSTALLED` startup check as `render.engine: "nunjucks"` bundles — install nunjucks in the project before declaring `.njk` sections. See the [Templating overview](/templating). **No migration action required.**

### Also new — nunjucks Inspector parity (dev mode)

Dev-mode nunjucks pages now render the Inspector statusbar and expose the query log (`data.page.queries`) alongside the flow timeline, matching the swig render path — the Inspector Queries tab no longer renders empty for nunjucks bundles. Dev-mode only; **no migration action required.**

---

## 0.4.6 → 0.4.7

`0.4.7` is an additive release — **no breaking changes**; one hardening-defaults change for cleartext h2c bundles is noted below.

### What's new — CSP `reportOnlyOmit` (opt-in report-only directive omission)

The `Csp` plugin accepts a new `reportOnlyOmit` option: an array of directive names to omit from a `Content-Security-Policy-Report-Only` header, emitted again automatically when `reportOnly` flips to `false` — one directive set across both modes, with no remove-then-re-add churn at the enforce flip. It is built for engine-divergent directives such as `frame-ancestors`, which Chrome and Firefox evaluate and report in report-only mode while Safari/WebKit ignores it with a console warning and no report: a bundle serving a WebKit-heavy audience can trade the Chrome + Firefox report signal for a clean Safari console as an explicit, lifecycle-managed choice. Entries are validated against the CSP Level 3 whitelist and a factory-time warning names what was dropped. With no `reportOnlyOmit`, emitted headers are byte-identical to before; **no migration action required.** See the [Content Security Policy guide](/guides/csp).

### Also new — WebSocket over HTTP/2 (opt-in)

HTTP/2 bundles — `https` and cleartext h2c alike — can now serve WebSocket endpoints over the RFC 8441 extended-CONNECT transport, with the RFC 6455 framing codec built into the framework — no external WebSocket library. Set `http2Options.enableConnectProtocol` to `true` (strictly the boolean) in `settings.json`, then register handlers from `onInitialize` with `app.onWebSocket(path, handler)`; each accepted stream arrives as a session with a `send`/`ping`/`close` API, automatic pong replies, payload and fragment caps, and graceful shutdown draining. The flag defaults to `false` and the default behaviour is byte-identical to previous releases; **no migration action required.** See the [WebSocket over HTTP/2 guide](/guides/websockets).

### Behaviour change — cleartext HTTP/2 (h2c) hardening parity

Cleartext HTTP/2 bundles — `"protocol": "http/2.0"` with `"scheme": "http"`, typically backends behind a TLS-terminating reverse proxy — now receive the same hardening options as `https` bundles: the SETTINGS advert (`maxConcurrentStreams` 256, `initialWindowSize` 655350, `maxHeaderListSize` 65536, server push disabled) and the session flood caps (`maxSessionRejectedStreams` 100, `maxSessionInvalidFrames` 1000), with `settings.json` `http2Options` overrides honoured. Previously an h2c bundle advertised protocol defaults — effectively unlimited concurrent streams with server push enabled — and silently ignored its `http2Options` overrides. If an h2c deployment relies on more than 256 concurrent streams per connection, set `maxConcurrentStreams` explicitly; otherwise **no migration action required.**

---

## 0.4.5 → 0.4.6

`0.4.6` is an additive release — **no breaking changes and no settings reset.** Every change is opt-in; existing bundles run unchanged.

### What's new — async custom template loaders (`settings.template.<engine>.loader`)

Both the swig and nunjucks render paths can now resolve templates from a custom async backend — a remote HTTP(S) origin, a CDN, object storage, or an in-memory map — instead of the local filesystem, configured per bundle via `settings.template.<engine>.loader` with built-in `"memory"` and `"http"` loaders. The `http` loader applies the CVE-2023-25345 path-traversal guard and origin containment on every resolve; host allowlist and TLS trust are the operator's responsibility. A bundle with no loader configured renders from disk exactly as before, so existing bundles are byte-for-byte unchanged; **no migration action required.** See [Async Template Loaders](/templating/async-loaders).

### Also new — opt-in popin pre-open with a loading skeleton

A popin can now open the instant it is triggered — showing a loading skeleton before its content finishes loading — by registering it with `preOpen: true` (`new PopinHandler({ name: 'myPopin', preOpen: true })`). In dialog mode it opens as a native modal; the real content replaces the skeleton when the request completes. Pass a `loadingShell` HTML string to supply your own placeholder markup, or omit it for a built-in skeleton. It is **off by default**, so popins that don't opt in behave exactly as before; **no migration action required.**

### Also new — req.rawBody for webhook signature verification

`0.4.6` exposes `req.rawBody` — the exact, unparsed request body string, captured before the framework parses it into `req.post` / `req.put` / `req.patch`. Inbound webhooks (Stripe, GitHub, …) sign a digest of the literal request bytes, so verifying their HMAC signature requires the raw body, not a parsed-then-re-serialized object. It is populated for non-multipart POST/PUT/PATCH bodies (`''` when empty); `multipart/form-data` uploads are unaffected (use `req.files`); and it is always-on with no opt-in. Existing bundles that never read `req.rawBody` are unchanged; **no migration action required.** See [Reading request data — req.rawBody](/guides/controller#raw-request-body).

### Also new — `data-gina-dialog` native dialog API

A dialog API built on the native `<dialog>` element: `data-gina-dialog="ID"` opens an in-page dialog, `data-gina-dialog-src="URL"` loads its content over AJAX, `data-gina-dialog-target="#sel"` does a partial (slot-only) replace that preserves the dialog chrome, and `data-gina-dialog-modal` forces modal or non-modal. New-API dialogs default to **non-modal**; opt in per trigger (`data-gina-dialog-modal`) or project-wide (`gina.config.popin.modal: true`). The legacy `data-gina-popin-name` / `data-gina-popin-url` triggers keep working unchanged and still open modal; **no migration action required.**

### Behaviour notes — for awareness

- **`application/json` bodies are parsed verbatim.** POST / PUT / PATCH JSON bodies are no longer URL-decoded and form-coerced: a string value of `"true"`, `"false"` or `"null"` stays a string, and a percent-escape such as `%20` inside a string value is preserved exactly as sent. A client that relied on the old decode-and-coerce of JSON payloads should send real JSON types instead. `application/x-www-form-urlencoded` handling is unchanged, and the browser form-validator now sends its JSON bodies with the matching `application/json` Content-Type.
- **Dialog popins render as native modals in development too** (dev/prod parity). The dev-only non-modal downgrade and its manual overlay are gone for dialog mode; development now matches what production already did.
- **Malformed percent-escapes no longer crash a bundle.** A request URL or query string carrying a bare `%` or an invalid escape such as `%zz` is decoded tolerantly (the raw value is kept) instead of escalating to an uncaught `URIError` that shut the process down.
- **CSP report-only policies omit `sandbox`** — browsers ignore the directive in report-only mode and warned about it in the console. Enforcing mode still emits it from the same config.
- **`@rhinostone/swig` floor is `^2.7.2`**, guaranteeing the swig-core CVE-2023-25345 path-traversal loader confinement, which the default render path now keeps active: `{% include %}` / `{% extends %}` / `{% import %}` resolution is confined to the bundle templates root. A template that legitimately includes files from outside the templates root needs restructuring (or a custom loader); for everyone else this is invisible.

---

## 0.4.4 → 0.4.5

`0.4.5` is an additive release — **no breaking changes and no settings reset.** Every change is opt-in; existing bundles run unchanged.

### Also new — opt-in structured (JSON) logging

The logger can now emit one machine-parseable JSON object per line instead of the default coloured text — set `GINA_LOG_FORMAT=json` (or the container preset `GINA_LOG_STDOUT=true`) on the bundle process. The default stays `text`, so interactive output and `docker logs` are unchanged unless you opt in; **no migration action required.** See [Structured (JSON) logging](/guides/logging#structured-json-logging).

### Also new — per-request `requestId` / `durationMs` in JSON logs

When structured (JSON) logging is on, Gina now tags every log line emitted during a request with a `requestId` (an inbound `X-Request-Id` is honoured when present, else one is generated) and a `durationMs` (elapsed since the request began), so the lines from a single request can be correlated in a log collector. It is part of JSON logging only — the default text output and any id-less context (boot, CLI, jobs) are unchanged; **no migration action required.** See [Structured (JSON) logging](/guides/logging#structured-json-logging).

### Also new — public SDK Cluster accessor on Couchbase entities

Couchbase entities now expose a public `getCluster()` method that returns the underlying SDK `Cluster` handle, so you can use SDK-level features the entity layer does not wrap — notably multi-document ACID transactions via `cluster.transactions().run(...)` — without reaching into private connection internals. Transaction support depends on the Couchbase driver your project installs (SDK 3.2+ / 4.x); **no migration action required.** See [Accessing the underlying SDK Cluster](/guides/couchbase-orm#accessing-the-underlying-sdk-cluster).

### Also new — public MongoClient accessor on MongoDB entities

MongoDB entities now expose a public `getClient()` method that returns the underlying driver `MongoClient`, so you can reach driver-level features the entity layer does not wrap — notably multi-document transactions via `client.startSession()` / `session.withTransaction(...)` — without reaching into private connection internals. Multi-document transactions additionally require a replica-set or sharded deployment and depend on the `mongodb` driver your project installs; **no migration action required.** See [Accessing the underlying MongoClient](/guides/connectors-mongodb#accessing-the-underlying-mongoclient).

---

## 0.4.3 → 0.4.4

`0.4.4` is an additive release — **no breaking changes and no settings reset.** Every change is opt-in; existing bundles run unchanged.

### What's new — `templates.json` multi-section keys

A `templates.json` section key may now be **comma-separated** — e.g. `"products, productDetail"` — to share a stylesheet or `<script>` block across several routes at once. The shared block is replicated under each named section and deep-merged into any section you also declare on its own, so a section's own keys win on collision. Single-section keys behave exactly as before, so this is **automatic — no code change required**.

### Also new — `templates.json` `_common.config` block

`templates.json` now accepts an optional `_common.config` block for page-level defaults (such as `routeNameAsFilenameEnabled` or `javascriptsDeferEnabled`). It is flattened back into `_common` at load time, so existing bundles are unaffected and any direct `_common` key still overrides the config block. Bundles that don't declare `_common.config` are byte-for-byte unchanged.

---

## 0.4.2 → 0.4.3

`0.4.3` is an additive release — **no breaking changes and no settings reset.** Every change is opt-in or a fix; existing bundles run unchanged.

### What's new — accessible form validation (`aria-invalid`)

`FormValidator` now keeps each managed field's `aria-invalid` attribute in sync with its validity, so a field's `aria-errormessage` association is actually exposed to assistive technology (per WAI-ARIA it is inert unless the field also carries `aria-invalid="true"`). This is **automatic — no code change required** and no new public API:

- `aria-invalid="true"` is set on a committed error and `"false"` once the field is valid again (mirroring the native `ValidityState` where the field has native HTML constraints, so it never disagrees with the `:user-invalid` styling already shown).
- If a field already references its own error element via `aria-errormessage`, Gina no longer injects its `form-item-error-message` div (no duplicate message); forms without that association keep the injected div and gain an `aria-errormessage` wire to it.
- On a failed submit, focus moves to the first invalid field; blur-time errors are announced through a visually-hidden `aria-live="polite"` region.

Blur- and input-time updates apply to forms that opt into live validation (`data-gina-form-live-check-enabled`); the submit-time `aria-invalid` and first-invalid focus apply to every Gina-validated form. Existing `form-item-error` / `form-item-error-message` / `data-gina-form-errors` classes and the submit-button state are unchanged, so there is no visual difference on forms already styling their own errors.

### Also new — Inspector over WebSocket

The standalone Inspector now connects to a bundle's `/_gina/agent` endpoint over a WebSocket by default — one socket carries both the data and log feed — and falls back to SSE automatically if the socket can't open (open the Inspector with `?transport=sse` to force SSE). Outside dev mode the upgrade requires the configured `inspector.agent.key` (via `?key=` or the `x-gina-inspector-key` header) and honours an optional `inspector.agent.allowedOrigins` allowlist; authentication and the production toggle are unchanged from the SSE transport. A new `gina service:start <service>` command starts framework-internal `@gina` services (such as the standalone Inspector) via the daemon-free `gina-container` launcher, and in dev mode the Inspector auto-starts when a bundle boots. None of this requires any change to your bundles.

### Also new — `@rhinostone/swig` 2.6.0

The template-engine floor moves to `^2.6.0`. The native `json` / `json_encode` filters now HTML-escape their output and are marked safe, so `{{ data|json }}` is safe to embed directly inside a `<script>` block (`url_decode` is unchanged). The `swigResolver` floor (`DEFAULT_MIN`) stays at `2.0.0`, so existing project-side swig pins are unaffected.

### Also fixed — strict-CSP client plugins

The popin, link, and form-validator plugins no longer inject an inline `onclick="return false;"` attribute at bind time, so they work under a strict nonce-based Content-Security-Policy (the inline handler tripped the `script-src-attr` directive). Default-action suppression is unchanged. This affects only bundles running a nonce-based CSP.

---

## 0.4.1 → 0.4.2

`0.4.2` is an additive release — **no breaking changes and no settings reset.** Every change is opt-in or a fix; existing bundles run unchanged.

### What's new — Alt-Svc HTTP/3 advertisement (opt-in)

Gina can now advertise HTTP/3 (QUIC) availability so capable browsers upgrade automatically — **without Gina implementing QUIC itself.** A QUIC-capable edge proxy ([Caddy](https://caddyserver.com/), [nginx with QUIC](https://nginx.org/en/docs/http/ngx_http_v3_module.html), or [Cloudflare](https://developers.cloudflare.com/speed/optimization/protocol/http3/)) terminates HTTP/3 on :443; Gina just announces it.

Enable it per bundle in `config/settings.server.json` (or set the framework default in `settings.json`):

```jsonc
{
    "webroot": "/",
    "http3Advertisement": true
}
```

Every routed response then carries:

```
Alt-Svc: h3=":443"; ma=86400
```

`:443` is the edge's public QUIC port — not the bundle's internal listen port. The header is **off by default** (zero behaviour change when unset) and **idempotent**: if an upstream proxy already set `Alt-Svc`, Gina does not overwrite it. Native QUIC remains out of scope — this is advertisement-only.

### Also fixed

- **`gina-container` 500 on HTML routes** — the Docker/K8s foreground launcher no longer returns HTTP 500 on every view render. The controller read the `GINA_PID` / `GINA_CULTURE` globals directly, which the daemonless launcher does not inject; it now falls back to the bundle process id and the default culture.
- **Layoutless `page.data` restored** — layoutless (`renderWithoutLayout`) fragment renders again expose controller data under `page.data` as well as at top level, so templates reading `data.X` / `page.data.X` (via `{% set data = page.data %}`) keep working. The 0.4.1 top-level-variable change had populated only the top level; this now matches the nunjucks engine.

---

## 0.4.0 → 0.4.1

`0.4.1` is a maintenance and developer-experience release — **no breaking changes and no settings reset.** It adds the Tier 2 CLI commands and a runtime template override (`self.setTemplate()`), plus a set of fixes (most notably full nunjucks↔swig render parity). Every change is additive; existing bundles run unchanged.

### What's new — Tier 2 CLI commands

Run-state and lifecycle commands for bundles and projects (all support `--format=json`):

- **`gina bundle:status <bundle> @<project>`** / **`gina project:status [@<project>]`** — report the running/stopped state, PID, port, and active env of a bundle (or of every bundle in a project).
- **`gina minion:list [@<project>]`** / **`gina minion:kill @<project>`** — list and reap a project's running bundle child-processes ("minions"), including `ps`-discovered orphans the pidfiles miss, with a graceful SIGTERM→SIGKILL escalation and a `--dry-run` preview.
- **`gina bundle:copy <source> <new> @<project>`** (alias `bundle:cp`) and **`gina bundle:rename <old> <new> @<project>`** — duplicate or rename a bundle within a project: both rewrite the bundle-name footprint (controller class names, the `require('gina')` var, the `app.json` name, the webroot) and update `manifest.json` + `env.json` + the ports registry. `bundle:rename` preserves the existing port numbers and refuses a running bundle; both support `--dry-run` and `--force`.
- **`gina protocol:remove <bundle> @<project>`** — revert a bundle to the project's default protocol and scheme by removing its per-bundle override.

### What's new — runtime template override (`self.setTemplate()`)

A controller action can now choose its template at request time — useful for a catch-all dispatcher that maps a URL pattern to a template:

```js
this.dispatch = function(req, res, next) {
    self.setTemplate('errors/' + req.params.code);   // resolved verbatim under the templates root
    self.render({ title: 'Error' });
};
```

The override is resolved under the bundle's templates root with no namespace prefixing, and is honoured by both the swig and nunjucks render paths. Purely additive — controllers that never call it are unchanged.

### No action required (fixes)

Every fix is backward-compatible:

- **Nunjucks↔swig render parity** — under the nunjucks engine, `self.setTemplate()` overrides are now honoured, a bundle's `controllers/setup.js` can register filters via `this.engine.addFilter()`, and a controller passing a *partial* `page` object no longer drops framework-injected page data (webroot, view metadata, session). If you run a nunjucks bundle, these bring it in line with the swig engine.
- **HTTP/2 dev static-asset crash** — fixed a crash that could kill a bundle serving static assets over HTTP/2 in dev mode under concurrent requests.
- **`renderWithoutLayout`** — no longer returns an empty body when the template references controller data as top-level variables.
- **Clearer fail-fast CLI errors** — the `gina` CLI now reports a clear message when `GINA_VERSION` resolves to an uninstalled framework version (instead of an opaque `MODULE_NOT_FOUND`), and the interactive commands (`bundle:add`, `bundle:remove`, `project:remove`, `protocol:set`, `port:set`, `view:add`) fail fast with guidance when run without a TTY (container, CI, or piped stdin) instead of throwing `ERR_USE_AFTER_CLOSE`.

---

## 0.3.15 → 0.4.0

`0.4.0` removes the end-of-life Couchbase SDK v2 connector — the one breaking change — and is a shortVersion bump (`0.3` → `0.4`; see "Action required — settings reset" below). New this release: HTTP/2 response trailers, async jobs (`self.startJob` / `self.inferAsync`), the opt-in per-response CSP nonce (`Csp({ useNonce: true })`, #HDR16), and a `throwError` 2-arg status-code fix.

The **Phase 2** security headers — `Csp` (#HDR5), the cross-origin policies `Coep` / `Coop` / `Corp` (#HDR6 / #HDR13 / #HDR14), and the combined `SecurityHeaders` wrapper (#HDR15) — shipped in **0.3.15**, not here; see the "0.3.14 → 0.3.15" section below. The only security-header addition in 0.4.0 is the CSP per-response nonce (#HDR16), covered below.

### Breaking — Couchbase SDK v2 connector removed

The Couchbase SDK v2 connector (`connector.v2.js`) and its session store (`session-store.v2.js`) are removed in `0.4.0`. Only Couchbase Node SDK **v3 and v4** are supported, and the connector now defaults to v3.

**The migration is a driver bump, not a config change.** Gina selects the connector version from the `couchbase` major installed in your project's `package.json` — not from a `connectors.json` field (the `sdk.version` upgrade note in the 0.2.0 deprecation was inaccurate; that value is derived from the installed driver, never set in config). To migrate:

```bash
npm install couchbase@^4   # or ^3
```

If a project still resolves to `couchbase@2`, the connector now throws a clear error at load (`SDK v2 is no longer supported — upgrade couchbase@^3/^4`) instead of failing later with an opaque module-not-found.

### Action required — settings reset (shortVersion bump)

`0.4.0` is a **shortVersion bump** (`0.3` → `0.4`). On install, the framework creates a fresh `~/.gina/0.4/settings.json` from defaults — your `~/.gina/0.3/settings.json` customizations (log level, port, culture, timezone, etc.) are **not** carried forward. This is intentional: the per-version settings schema can change between short versions.

After upgrading, re-apply your customizations with `gina framework:set`, or copy the values across from `~/.gina/0.3/settings.json`. Root-level state (`~/.gina/main.json`, `projects.json`, `ports.json`, `gina.db`) is shared across short versions and is unaffected — only the per-version `settings.json` resets.

### What's new — HTTP/2 response trailers (`self.sendTrailers()`)

Controllers can now emit HTTP/2 response trailers (trailing headers sent after the body). Call `self.sendTrailers(fields)` before rendering; the render pipeline sets `waitForTrailers` on the HTTP/2 stream and sends the trailers in the `wantTrailers` event after the final data frame:

```js
// In a controller action, before rendering a streamed response:
self.sendTrailers({ 'grpc-status': '0', 'grpc-message': 'OK' });
self.renderStream(myAsyncIterable, 'application/grpc+proto');
```

Opt-in and best-effort: a no-op on HTTP/1.1 and when no trailers are registered, so existing responses are unchanged. Pseudo-header keys (`:`-prefixed) are stripped. Useful for gRPC-style streaming (a final `grpc-status`) and content-integrity (`Digest` after a chunked body).

### What's new — Async jobs (`self.startJob` / `self.inferAsync`)

Slow work — an LLM `.infer()` taking 1–30s, a heavy report — can now run out-of-band instead of holding the request open. `self.startJob(fn)` returns a job id immediately and runs `fn` on a concurrency-limited worker; clients poll the built-in `GET /_gina/jobs/:id` for state or opt into a completion webhook. `self.inferAsync(messages, options)` wires the AI connector through a job in one call.

```js
// Return a job id immediately; the inference runs out-of-band:
this.summarise = function(req, res, next) {
    var jobId = self.inferAsync(
        [{ role: 'user', content: req.post.text }],
        { connector: 'myModel' }
    );
    self.renderJSON({ jobId: jobId });
};
```

Purely additive and opt-in — existing controllers are unchanged. See the [Async jobs guide](/guides/async-jobs) for polling, result retrieval, and webhook configuration.

### No action required (security headers)

The security-headers additions are purely additive — bundles that don't adopt the new `Csp` plugin continue to work unchanged, and existing Phase 1 plugins (HDR1-7) are unaffected. `Csp`'s opt-in `useNonce: true` (#HDR16) — which generates a per-response nonce, stamps it on the framework's injected inline scripts, and exposes it to your own templates as `{{ page.cspNonce }}` (swig) / `{{ cspNonce }}` (nunjucks) so you can drop `'unsafe-inline'` from `script-src` — is likewise additive and defaults to `false`; see the [Per-response nonce section](/guides/csp#per-response-nonce-usenonce) of the CSP guide. (The one migration action this release requires is the Couchbase SDK v2 driver bump above.)

### Security headers — CSP per-response nonce (`useNonce`, #HDR16)

The base `gina.plugins.Csp({ directives, reportOnly })` plugin (#HDR5) shipped in **0.3.15** (see the "0.3.14 → 0.3.15" section); **0.4.0 adds the opt-in per-response nonce** (`useNonce`, #HDR16). The full `Csp` reference is recapped here for convenience, with the nonce called out.

`Csp` is opt-in middleware that emits the `Content-Security-Policy` (or `Content-Security-Policy-Report-Only`) response header on every response, limiting which resources the browser is allowed to load and from where — the modern defense against cross-site scripting (XSS), clickjacking via `frame-ancestors`, mixed-content downgrade, and base-tag manipulation.

Adoption is one block in the bundle bootstrap, inside the `onInitialize` callback (Gina builds the Express app and hands it to you as `app` — bundles never call `express()` themselves):

```js title="src/<bundle>/index.js"
var myapp = require('gina');
var csp   = require('gina').plugins.Csp({
    directives: {
        'default-src': ["'self'"],
        'script-src':  ["'self'", 'https://cdn.example.com'],
        'style-src':   ["'self'", "'unsafe-inline'"],
        'img-src':     ["'self'", 'data:', 'https:'],
        'upgrade-insecure-requests': true
    }
});

myapp.onInitialize(function(event, app) {
    app.use(csp);
    event.emit('complete', app);
});
```

**`directives` is REQUIRED.** There is no sensible cross-bundle default; every bundle has its own resource graph. The factory throws at call time if `directives` is missing or empty.

**Strict whitelist of 27 CSP Level 3 standard directives.** Unknown directive names throw at factory call time — fail-fast catches typos like `scrpt-src` that browsers would otherwise silently ignore (leaving the page unprotected with no error).

**Value formats:**
- Array of source-list tokens — joined with space: `["'self'", 'https:']` → `'self' https:`
- Pre-formatted string — emitted as-is: `"'self' https:"` → `'self' https:`
- Boolean `true` — emit directive name alone (boolean-only directives `upgrade-insecure-requests` / `block-all-mixed-content` + hybrid `sandbox`).
- Boolean `false` — omit the directive entirely.

**`reportOnly: true`** switches the response header name to `Content-Security-Policy-Report-Only` — browsers report violations but do not block any resources. Use for non-enforcing migration testing: ship the policy as report-only first, collect violations from real traffic, refine, then flip to enforcing.

**Per-response nonce (`useNonce`, #HDR16 — same cycle).** Setting `useNonce: true` generates a fresh nonce per response, stamps it on every framework-injected inline `<script>`, and exposes it to your templates as `{{ page.cspNonce }}` (swig) / `{{ cspNonce }}` (nunjucks) — so you can drop `'unsafe-inline'` from `script-src` without breaking the framework's scripts or your own. Defaults to `false`; see the [Per-response nonce section](/guides/csp#per-response-nonce-usenonce). Inline **styles** still need `'unsafe-inline'` or external files — the nonce covers `script-src` only.

**Idempotent.** If an earlier middleware already set the header, the existing value is preserved and `next()` is called immediately. Safe to stack with helmet-style upstream gates (first-writer-wins).

See the dedicated [Content-Security-Policy guide](/guides/csp) for the full reference — directive whitelist, value-format details, security guidance (avoid `'unsafe-inline'` and `'unsafe-eval'`, lock down `frame-ancestors` and `object-src`), and the full failure-mode table.

### What's new — `throwError(statusCode, Error|string)` honors the explicit status code

Before this release, the 2-arg shorthand form `self.throwError(404, new Error('not found'))` (or `self.throwError(400, 'Bad input')`) silently fell back to HTTP 500 — the framework's internal status-coercion read the wrapped error's `.status` (missing on a bare `Error`) rather than the explicit number passed as the first argument, and defaulted to 500. The 2-arg shorthand is now correctly handled and the explicit status code reaches the response:

```js
// In any controller action — these now work as intended:
self.throwError(404, new Error('Invoice not found'));   // → status 404
self.throwError(400, 'Bad input');                       // → status 400

// Unchanged — these shapes were already correct:
self.throwError(412, { status: 412, fields: { name: 'Required' } });
self.throwError(new Error('boom'));                      // → 500 fallback (no explicit code)
self.throwError({ status: 403, error: 'Forbidden' });    // → status 403
self.throwError(res, 500, new Error('upstream'));        // → status 500 (3-arg internal form)
```

The fix only affects the `(statusCode, Error|string)` shape — the framework's internal Error/string-coercion branch was the one mis-reading the explicit number. The `(statusCode, errorObj)` shape and the 1-arg and 3-arg forms were already handled correctly by other internal branches and are unchanged.

**If you were working around the silent 500 fallback** (typically by hand-constructing an error object with `status` and passing it as a 1-arg, or by switching to the 3-arg `throwError(res, code, msg)` form), the workaround is no longer needed — but it stays valid. No action required to keep existing code working. Bundles whose controllers were relying on the silent-500 fallback as a feature will now receive the intended status code; the fallback was undocumented and the call shape `throwError(404, ...)` always intended status 404.

A new `throwError(code: number, err: Error | string): void` overload is declared in `types/index.d.ts` for IDE autocomplete and type-checking on TypeScript projects.

---

## 0.3.14 → 0.3.15

`0.3.15-alpha` opens a new **HTTP security response headers** track (`#HDR`) — opt-in `gina.plugins.*` middlewares that emit individual security headers on the response, mirroring the `Session` (#CSRF1) and `Csrf` (#CSRF2/#CSRF3) plugin shape. **Phase 1 is complete in this cycle** — all five modern critical plugins ship together: `XContentTypeOptions` (#HDR1), `XFrameOptions` (#HDR2), `ReferrerPolicy` (#HDR3), `Hsts` (#HDR4), `OriginAgentCluster` (#HDR7). Phase 1.5 (helmet-parity gap-fill: `HidePoweredBy`, `XDnsPrefetchControl`, `XXssProtection`, `XDownloadOptions`, `XPermittedCrossDomainPolicies`) and Phase 2 (`Csp` #HDR5, COEP/COOP/CORP #HDR6/#HDR13/#HDR14, `SecurityHeaders` combined wrapper #HDR15, and the HDR8 framework-level Phase 2 `server.hidePoweredBy` settings flag that closes the Isaac-engine X-Powered-By gap the Phase 1 middleware cannot reach) also shipped in the 0.3.15-alpha cycle — see the [Security Headers guide](/guides/security-headers) for the full reference.

### No action required

This is a purely additive release. Bundles that don't adopt the new plugins continue to work unchanged. CORS handling stays where it lives today (request-side, in the framework's server engine) — these new plugins are response-side policy headers, a distinct concern.

### What's new — `gina.plugins.XContentTypeOptions()` (#HDR1)

Opt-in middleware that emits the `X-Content-Type-Options: nosniff` response header on every response. Adoption is one block in the bundle bootstrap, inside the `onInitialize` callback (Gina builds the Express app and hands it to you as `app` — bundles never call `express()` themselves):

```js title="src/<bundle>/index.js"
var myapp               = require('gina');
var xContentTypeOptions = require('gina').plugins.XContentTypeOptions();

myapp.onInitialize(function(event, app) {
    app.use(xContentTypeOptions);
    event.emit('complete', app);
});
```

The header instructs browsers to honour the declared `Content-Type` strictly, blocking MIME-sniffing attacks. Per RFC 7034 / WHATWG Fetch Standard, `nosniff` is the only valid value — there is no `enabled` flag in the configuration surface; register the plugin to opt in, don't register to opt out.

**Idempotent.** If an earlier middleware already set the header, the existing value is preserved and `next()` is called immediately. Safe to stack with helmet-style upstream gates or with other plugins that emit the same header (first-writer-wins).

**Order with other gina security plugins does not matter** — the header is emitted on the response, not consumed from the request.

See the [Security Headers guide](/guides/security-headers) for the full reference and the per-plugin failure-mode table.

### What's new — `gina.plugins.XFrameOptions({ value })` (#HDR2)

Opt-in middleware that emits the `X-Frame-Options` response header on every response, defending against clickjacking by controlling whether the page may be rendered inside a `<frame>`, `<iframe>`, `<embed>` or `<object>`. Adoption is one block in the bundle bootstrap, inside the `onInitialize` callback (Gina builds the Express app and hands it to you as `app`):

```js title="src/<bundle>/index.js"
var myapp         = require('gina');
var xFrameOptions = require('gina').plugins.XFrameOptions();

myapp.onInitialize(function(event, app) {
    app.use(xFrameOptions);
    event.emit('complete', app);
});
```

Default is `SAMEORIGIN` — the page may be framed only by same-origin pages. Override via settings or caller options:

```jsonc title="src/<bundle>/config/settings.json"
{
  "xFrameOptions": { "value": "DENY" }
}
```

```js
var xFrameOptions = require('gina').plugins.XFrameOptions({ value: 'DENY' });
```

Values are normalised to uppercase (so `"deny"` is accepted and emitted as `DENY`).

**Rejected: `ALLOW-FROM <uri>`.** The legacy ALLOW-FROM value is rejected at factory call time — modern browsers ignore it (Chrome / Edge / Safari never honoured it cross-vendor, Firefox dropped it in 70). Use `Content-Security-Policy: frame-ancestors <source-list>` instead — it works cross-browser and accepts richer source expressions. The factory throws with a message pointing at the MDN reference.

**Idempotent.** If an earlier middleware already set the header, the existing value is preserved and `next()` is called immediately. Safe to stack with helmet-style upstream gates or with other plugins that emit the same header (first-writer-wins).

### What's new — `gina.plugins.ReferrerPolicy({ value })` (#HDR3)

Opt-in middleware that emits the `Referrer-Policy` response header on every response, controlling how much referrer information the browser includes when navigating away from the page or fetching sub-resources. Adoption is one block in the bundle bootstrap, inside the `onInitialize` callback (Gina builds the Express app and hands it to you as `app`):

```js title="src/<bundle>/index.js"
var myapp          = require('gina');
var referrerPolicy = require('gina').plugins.ReferrerPolicy();

myapp.onInitialize(function(event, app) {
    app.use(referrerPolicy);
    event.emit('complete', app);
});
```

Default is `strict-origin-when-cross-origin` — matches the modern browser default since ~2021. Override via settings or caller options to pick one of the other seven W3C tokens:

```jsonc title="src/<bundle>/config/settings.json"
{
  "referrerPolicy": { "value": "no-referrer" }
}
```

```js
var referrerPolicy = require('gina').plugins.ReferrerPolicy({ value: 'no-referrer' });
```

The eight valid tokens per the [W3C Referrer Policy spec](https://www.w3.org/TR/referrer-policy/): `no-referrer`, `no-referrer-when-downgrade`, `origin`, `origin-when-cross-origin`, `same-origin`, `strict-origin`, `strict-origin-when-cross-origin` (default), `unsafe-url` (dangerous — leaks paths and queries).

Values are normalised to lowercase per the W3C spec's case-insensitive matching (so `"NO-REFERRER"` is accepted and emitted as `no-referrer`). Invalid tokens throw at factory call time with the full eight-token list + W3C spec URL in the message — fast-fail at bootstrap.

**Idempotent.** If an earlier middleware already set the header, the existing value is preserved and `next()` is called immediately. Safe to stack with helmet-style upstream gates or with other plugins that emit the same header (first-writer-wins).

### What's new — `gina.plugins.Hsts({ maxAge, includeSubDomains, preload })` (#HDR4)

Opt-in middleware that emits the `Strict-Transport-Security` response header on every response, instructing browsers to access the host exclusively over HTTPS for the next `maxAge` seconds. Defeats SSL-stripping attacks by preventing browsers from making plain HTTP requests to the host once the policy is in effect.

Adoption is one block in the bundle bootstrap, inside the `onInitialize` callback (Gina builds the Express app and hands it to you as `app`):

```js title="src/<bundle>/index.js"
var myapp = require('gina');
var hsts  = require('gina').plugins.Hsts();

myapp.onInitialize(function(event, app) {
    app.use(hsts);
    event.emit('complete', app);
});
```

Defaults: `maxAge: 15552000` (180 days), `includeSubDomains: false`, `preload: false`. Override via settings or caller options:

```jsonc title="src/<bundle>/config/settings.json"
{
  "hsts": {
    "maxAge":            63072000,
    "includeSubDomains": true,
    "preload":           true
  }
}
```

**Browser-parity invariant on `preload`**: `preload: true` requires `includeSubDomains: true` AND `maxAge >= 31536000` (1 year) per the [HSTS preload-list submission requirements](https://hstspreload.org/#deployment-recommendations). The factory throws at call time when the combination is invalid — fast-fail at bootstrap, the bundle won't start with a misconfigured header. The preload-list submission is effectively a one-way operation (removal takes months and isn't guaranteed); the invariant guards against accidental lockouts.

**Spec note on transport gating**: this plugin emits the header on every response regardless of transport, matching helmet's behaviour. RFC 6797 §7.2 says senders MUST NOT include the header on HTTP, but §8.1 also says browsers MUST IGNORE it on HTTP — the receiver enforces the policy correctly regardless. The design favours proxy-deployment robustness (no dependency on `x-forwarded-proto` being preserved) over sender-side spec purity. Bundles that need strict §7.2 compliance can simply not register the plugin in non-HTTPS bundles.

**Idempotent.** If an earlier middleware already set the header, the existing value is preserved and `next()` is called immediately. Safe to stack with helmet-style upstream gates or with other plugins that emit the same header (first-writer-wins).

### What's new — `gina.plugins.OriginAgentCluster()` (#HDR7)

Opt-in middleware that emits `Origin-Agent-Cluster: ?1` on every response, requesting origin-keyed agent clustering. Same-site cross-origin pages get isolated agents (can no longer reach in via `document.domain`), which mitigates one class of Spectre side-channel attack. Adoption is one block, inside the `onInitialize` callback:

```js title="src/<bundle>/index.js"
var myapp              = require('gina');
var originAgentCluster = require('gina').plugins.OriginAgentCluster();

myapp.onInitialize(function(event, app) {
    app.use(originAgentCluster);
    event.emit('complete', app);
});
```

No required configuration — per the [HTML spec](https://html.spec.whatwg.org/multipage/document-sequences.html#origin-keyed-agent-clusters), `?1` (Structured Header boolean true) is the only useful value; `?0` is the browser default and emitting it would be a no-op. There is no `enabled` flag.

**Browser support**: Chrome 88+, Edge 88+, Firefox 109+, Safari 15+. Older browsers ignore the header silently.

**When NOT to register**: if your bundle relies on `document.domain` to bridge same-site origins (e.g. setting `document.domain = "example.com"` to script across `app.example.com` and `legacy.example.com`), Origin-Agent-Cluster will break that pattern. The pattern is rare in modern web apps but worth checking.

**Idempotent.** If an earlier middleware already set the header, the existing value is preserved and `next()` is called immediately. Safe to stack with helmet-style upstream gates or with other plugins that emit the same header (first-writer-wins).

### Phase 1 is complete (modern coverage)

All five modern Phase 1 plugins on the `#HDR` track shipped in this cycle:

- `gina.plugins.XContentTypeOptions()` (#HDR1) — MIME-sniffing defense
- `gina.plugins.XFrameOptions({ value })` (#HDR2) — clickjacking defense
- `gina.plugins.ReferrerPolicy({ value })` (#HDR3) — referrer leakage control
- `gina.plugins.Hsts({ maxAge, includeSubDomains, preload })` (#HDR4) — HTTPS-only enforcement
- `gina.plugins.OriginAgentCluster()` (#HDR7) — origin-keyed isolation

**Phase 1.5** (helmet-parity gap-fill, shipped on develop 2026-05-17 in the 0.3.15-alpha cycle): `HidePoweredBy` (#HDR8), `XDnsPrefetchControl` (#HDR9), `XXssProtection` (#HDR10), `XDownloadOptions` (#HDR11), `XPermittedCrossDomainPolicies` (#HDR12). Defense-in-depth + parity narrative; the four legacy ones have minimal practical value in 2026.

**Phase 2** (`Csp` #HDR5, the three-plugin cross-origin split COEP/COOP/CORP #HDR6/#HDR13/#HDR14, the `SecurityHeaders` combined wrapper #HDR15, and the HDR8 framework-level Phase 2 `server.hidePoweredBy` settings flag) also shipped on develop 2026-05-17 in the 0.3.15-alpha cycle. CSP is the dynamic / higher-break-risk header that requires template-render-integration thinking — static directives only at v0; per-response nonce wiring defers to a separate CSP-aware view-layer plugin.

### What's new — `isInList` form-validator rule

New rule in the `is*` family that constrains a form field's value to a closed set of accepted primitives. Adoption is one extra key in the routing-rule JSON; the rule fires on both server-side routing validation and client-side browser enforcement (single shared implementation in the form-validator).

```json title="src/<bundle>/config/routing.json"
"status-update": {
  "url": "/status",
  "method": "PUT",
  "requirements": {
    "status": "validator::{ isRequired: true, isString: true, isInList: [\"draft\", \"pending\", \"sent\", \"paid\"] }"
  },
  "param": { "control": "updateStatus" }
}
```

**Semantics**: strict `===` equality. `isInList: [1, 2, 3]` rejects the string `"2"`. Empty allowed-list rejects every value. Non-array rule values (e.g. `isInList: "draft"`) throw a configuration error at first invocation. Mixed primitive types (string / number / boolean) are accepted in the same list. Non-primitive entries throw.

**Conditional opt-in** plugs into the existing `_case_<field>` resolver without special-case handling:

```json
"_case_field[type]": {
  "conditions": [
    {
      "case": "/^individual$/",
      "rules": {
        "field[subtype]": { "isInList": ["primary", "secondary"] }
      }
    }
  ]
}
```

**What this does NOT cover**: async value-list resolution (lists are static at rule-load time — use a custom rule or `Collection.findOne` for remote enums), wildcard / regex patterns inside the list (use the existing `isString` regex options or a custom rule), case-insensitive matching (strict `===` is the only mode; a future opt-in object shape `isInList: { values: [...], caseInsensitive: true }` could add it if a use case emerges). Client-side datalist sourcing (`isInListFromDatalist: "<id>"`) is also out of scope for this slice.

### Security — CVE-2026-45736 closed (CWE-908 in `ws@8.18.3`)

`engine.io` is bumped to `^6.6.7` and `engine.io-client` to `^6.6.4`, but the vulnerable `ws@8.18.3` is still pinned transitively by `engine.io@6.6.7` itself. The fix uses an npm `overrides` block in `package.json` to force `ws@^8.20.1` at install time — the only remediation path per Snyk's advisory. A transitive bump alone would have left the vulnerable version reachable.

**No action required**: gina is the only consumer of `engine.io` / `engine.io-client` in the resolved tree, and the override applies at install time. `npm install gina@0.3.15` produces a tree with `ws@^8.20.1` only. Bundles that declare `ws` directly should also pin `^8.20.1` to stay aligned.

---

## 0.3.13 → 0.3.14

`0.3.14` is an additive release on top of `0.3.13`. The headline is **server-side stack-frame leak prevention** on both error-response wire shapes (JSON + fallback HTML), gated fail-closed on local scope, plus a **per-bundle IP allowlist** for the admin-grade `/_gina/info` and `/_gina/cache/stats` endpoints. Shipping alongside: a `gina project:rm --force` UX fix for partial-breakage states, `bundle:list` argv parsing cleanup, two HTMLFormElement guard tightenings in the validator, a router hot-reload tech-debt fix, and a `@rhinostone/swig` floor bump to `^2.4.0`.

### Action required — for bundles that previously called `/_gina/info` or `/_gina/cache/stats` from non-loopback IPs only

Both endpoints now default to a loopback-only IP allowlist (`["127.0.0.1", "::1"]`). Bundles that scrape them from an internal monitoring host, a sister K8s pod, or any other non-loopback source must opt-in by adding the source IP(s) to a new `admin.allowFrom` block in `app.json`:

```json title="src/<bundle>/config/app.json"
{
  "admin": {
    "allowFrom": ["127.0.0.1", "::1", "10.0.1.50"]
  }
}
```

The framework does NOT trust `X-Forwarded-For` (reverse proxies could spoof it) — the client IP is read from `req.socket.remoteAddress` only. `::ffff:IPv4` (IPv6-mapped IPv4) is normalised so listing `127.0.0.1` matches both forms. Empty array `[]` is explicit deny-everyone. `/_gina/health/check` is intentionally NOT gated (k8s liveness probes need it unrestricted). The `/_gina/metrics` endpoint keeps its own separate `metrics.allowFrom` gate.

If your bundle only accessed these endpoints from localhost (the typical dev workflow), no change is needed.

### What's new — server-side stack-frame leak prevention

`Controller::throwError` now strips the `stack` field from JSON error responses (`{status, error, stack?}`) and the `<pre class="stack">` block from the fallback HTML error page outside of local scope (`NODE_SCOPE_IS_LOCAL=true`). Server-side internals (file paths, library versions, internal stack frames) no longer reach API clients or page viewers in beta, testing, production, or any unset scope.

**Local scope keeps the stack on the wire.** The dev toolbar's `data-xhr` panel renders the server-side stack frames from the JSON body, and the fallback HTML page shows the trace inline — both intentional dev ergonomics, preserved unchanged when `NODE_SCOPE_IS_LOCAL=true`.

**Fail-closed shape.** The gate is `!_isLocalScope ? strip : keep`, NOT `_isProdScope ? strip : keep`. A missing or unset `NODE_SCOPE_IS_LOCAL` still strips — an env-var slip on a fresh production deployment cannot reintroduce the leak.

**Custom error templates remain consumer-owned.** Bundles that configure their own error templates (`bundleConf.content.templates._common.errorFiles`) control what they render from `req.params.errorObject` — for example `{% if data.stack %}{{ data.stack }}{% endif %}` in a custom 5xx template continues to behave however the consumer wrote it. The framework's gate covers only the built-in fallback paths.

**Consumer-side leak shape not covered by the framework.** Callsites that pass `Error.stack` as the `msg` argument to `self.throwError(res, code, msg)` end up with the stack string in the `error` field (not the gated `stack` field). The framework treats `msg` as an opaque user-supplied string and serializes it verbatim. Replace `new Error('...').stack` with `new Error('...').message` (or the literal string) at every such callsite. The framework's fix cannot reach this — it lives in your controller code.

### What's new — `gina project:rm --force` tolerates partial-breakage states

The whole point of `--force` on a rm command is to honour broken state. Pre-fix, the framework errored on missing `manifest.json` even with `--force`; the project handler errored on missing project folder even with `--force`. Both now warn instead and fall back to registry-only removal (`~/.gina/projects.json` + state-store row). Without `--force`, both still error so typos and wrong-machine invocations surface immediately. The registry-missing check is unchanged — `--force` cannot help when there is no record to remove.

### What's new — `bundle:list` argv parsing cleanup

Two pre-existing surface bugs in `gina bundle:list`:

- Bare `gina bundle:list` no longer emits the spurious red `[error][gina] [ null ] is not a valid project name` stderr line before falling through to the all-projects view.
- `gina bundle:list --all --format=json` now correctly prints JSON instead of text — the previous in-loop short-circuit dispatched to `listAll()` before the `--format=json` token at a later argv position could set the format.

No functional change for valid argv shapes (`gina bundle:list @<project>` and `gina bundle:list --format=json --all`).

### What's new — FormValidator HTMLFormElement guards

`FormValidator::validateFormById` and `FormValidator::getFormById` now fail loud with an actionable error when the resolved id is not an `HTMLFormElement` (for example when a sibling `<p id="X">` or `<div id="X">` shares the id with a later-loaded `<form id="X">` from a popin or AJAX fragment), instead of crashing later inside `bindForm` with a cryptic `TypeError` on the undefined `.elements.length` access. The error names the offending tag (e.g. `parent` resolves to `<P>`, not a FORM) and suggests renaming so the underlying id collision is visible from the console message.

### What's new — `@rhinostone/swig` floor bumped to `^2.4.0`

`2.4.0` adds ternary (`a ? b : c`) and Elvis (`a ?: b`) operator support in template expressions — usable in `{{ }}` output and in tag arguments such as `{% if %}`, `{% set %}`, `{% for %}` — plus two CLI/build fixes (`mocha` invocation in `make coverage`; `EEXIST` guard in `swig compile -o`). No template-engine API change at the surface gina calls. `swigResolver DEFAULT_MIN` stays at `2.0.0` — the framework does not depend on any new 2.4.0-only API.

### What's new — internal housekeeping (no action required)

- `core/router.js` hot-reload no longer poisons the `require.cache` slot for `controller/index.js` (latent bug — the `delete require.cache[path]; require.cache[path] = require(path)` antipattern assigned the exports object into a slot that Node expects to be a `Module` instance; closed before any visible regression surfaced).
- `script/post_publish.js bumpVersion` now refreshes the `framework/v*/VERSION` file content alongside the `renameSync` of the gitignored sibling — closes a drift family that previously needed manual repair after the alpha bump.

---



`0.3.13` is an additive release on top of `0.3.12`. The headline is a
`${secret:KEY}` placeholder substitution layer for bundle JSON configs —
with a `settings.csrf.secret` slot and `mcp.json` support flowing
through it. Shipping alongside: a Progressive Web App scaffold for new
views, an application-level HTTP/2 rapid-reset rate limiter, a
`@rhinostone/swig` dependency-floor bump, the removal of two dormant
internal plugin directories, and two seamless bug fixes. **No action
required** — every change is additive or a seamless behaviour
correction; no API changes, no breaking config changes.

### Action required

None. Run `npm install -g gina@latest` (or `gina@^0.3.13` for project-local
installs) — every change is back-compatible.

### What's new — `${secret:KEY}` placeholder substitution

Bundle JSON configs (`settings.json`, `app.json`, `connectors.json`, etc.)
can now embed `${secret:KEY}` placeholders that the framework resolves at
config-load time from `process.env[KEY]` before the merged config is
finalised. Downstream readers (`getConfig()`, plugin factories) see the
resolved values transparently.

```json title="src/api/config/settings.json"
{
  "csrf": {
    "secret": "${secret:GINA_CSRF_SECRET}"
  }
}
```

```json title="src/api/config/connectors.json"
{
  "claude": {
    "connector": "ai",
    "protocol":  "anthropic://",
    "api-key":   "${secret:ANTHROPIC_API_KEY}"
  }
}
```

**Syntax** — only the bare `${secret:KEY}` form (entire string value)
is substituted. `KEY` matches `^[A-Z_][A-Z0-9_]*$`. Mixed strings
(`"prefix-${secret:K}-suffix"`) pass through unchanged. Non-string values
are walked recursively but never mutated.

**Fail-closed** — an unset or empty env var throws
`Error('Secret resolution failed')` at bundle-start time. The error
intentionally does not include the key name (the key is attached as a
non-enumerable `_ginaSecretKey` property for debug logging only).
Silent empty substitution would mask misconfiguration.

**Caching** — resolution happens once per config-load cycle. A bundle
restart re-reads `process.env`. Secret rotation requires a process
restart (the running supervisor process inherits its env from container
init).

**Backends** — only the `process.env` backend ships in this iteration.
The function signature is designed so a future plug-in selector
(file-based, Vault, SOPS, K8s Secrets, etc.) can be slotted in without
changing the resolver API.

### What's new — `settings.csrf.secret` slot

`gina.plugins.Csrf()` now accepts the HMAC secret from
`settings.json > csrf.secret` in addition to the existing
`process.env.GINA_CSRF_SECRET` env var. Combined with the placeholder
syntax above, the recommended shape is now:

```json title="src/api/config/settings.json"
{
  "csrf": {
    "secret": "${secret:GINA_CSRF_SECRET}"
  }
}
```

**Precedence** (highest wins):

1. `opts.secret` passed to `gina.plugins.Csrf({ secret: ... })` — test override
2. `settings.csrf.secret` (placeholder-resolved)
3. `process.env.GINA_CSRF_SECRET` — back-compat fallback

Existing bundles that read the secret from `process.env.GINA_CSRF_SECRET`
keep working unchanged. The factory still throws at startup when none
of the three sources resolves to a non-empty value.

### What's new — `mcp.json` `${secret:KEY}` support

`gina bundle:mcp-start` now routes the parsed `mcp.json` manifest through
the secrets resolver immediately after `requireJSON()`. Any field that
holds a `${secret:KEY}` placeholder — most commonly `server.authToken`
for the Streamable HTTP transport's bearer auth — gets substituted from
`process.env[KEY]` before the MCP server reads it.

```json title="mcp.json"
{
  "server": {
    "authToken": "${secret:GINA_MCP_AUTH_TOKEN}"
  }
}
```

The previous direct-env-var path
(`GINA_MCP_AUTH_TOKEN` read inside `mcp-start`) is unchanged — it still
acts as the last fallback in the precedence chain.

### What's new — Progressive Web App scaffold

`gina view:add` now scaffolds a starter Progressive Web App setup
alongside the view files. The bundle's `public/` directory gets a
`manifest.webmanifest` and a cache-first service-worker stub (`sw.js`),
and the default HTML layout is wired with the manifest `<link>`, a
`theme-color` `<meta>`, an apple-touch-icon `<link>`, and an inline
service-worker registration `<script>`. Zero runtime dependency — it is
static files plus layout tags.

**No action required** for existing bundles — the scaffold affects only
views created with `view:add` after upgrade. To adopt it, edit
`manifest.webmanifest` to describe your app and drop your own icon PNGs
into `public/` (the bundle's `public/readme.md` lists the expected
filenames).

### What's new — HTTP/2 rapid-reset rate limiter

The Isaac HTTP/2 server now bounds how many new streams a single session
may open within a rolling one-second window. When a connection opens
more than `maxStreamsPerSecond` (default `200`) new streams in one
window, Isaac sends a `GOAWAY` and closes that session — a targeted,
application-level defense against rapid-reset floods (CVE-2023-44487) on
top of the OS-level mitigation in modern Node.js. It complements the
existing `maxSessionRejectedStreams` guard, which counts *refused*
streams rather than *created* ones.

```json title="src/api/config/settings.server.json"
{
  "server": {
    "http2Options": {
      "maxStreamsPerSecond": 200
    }
  }
}
```

**No action required** — the limiter is on by default with a
conservative threshold that legitimate clients do not reach.
Public-facing deployments that front high-fan-out HTTP/2 clients can
tune `http2Options.maxStreamsPerSecond` upward. The `/_gina/info`
endpoint exposes a new `rapidResetBlocked` counter for breach events.

### What's changed — Bundle scaffolding updated

Templates produced by `gina project:add` and `gina bundle:add` now show
the `${secret:KEY}` shape as the recommended pattern for session and
CSRF secrets:

- `core/template/conf/settings.json` documents the `csrf.secret` slot
  alongside the `GINA_CSRF_SECRET` env-var fallback.
- `core/template/boilerplate/bundle/index.js` shows the
  `self.getConfig('session').secret` wiring with a placeholder-bearing
  `bundle/config/session.json`.

**No action required** for existing bundles — the scaffolding affects
only new projects / new bundles created after upgrade. Existing bundles
keep their current secret-handling shape.

### What's changed — `@rhinostone/swig` floor bumped to `^2.3.0`

The `@rhinostone/swig` dependency floor in `framework/v*/package.json`
moves from `^2.2.0` to `^2.3.0`. Version `2.3.0` drops `yargs` and
`terser` from the published package's production dependencies — CLI
argument parsing is now a built-in zero-dependency parser, and `terser`
(used only by `swig compile --minify`) moved to `devDependencies` and
loads lazily. A library install of `@rhinostone/swig` now pulls in only
`@rhinostone/swig-core`, so installing gina has a smaller transitive
dependency tree.

**No action required** — there is no template-engine API or behaviour
change, and `npm install -g gina@latest` picks up the new floor. The
`swig.useProject` resolver floor stays at `2.0.0`; the framework does
not depend on any `2.3.0`-only API.

### What's changed — Dormant plugin directories removed

Two unused internal plugin directories — `core/plugins/lib/file/` and
`core/plugins/lib/intl/` — have been removed. They had no consumers in
any known bundle and carried no runtime wiring; dropping them trims the
npm tarball slightly with no functional change.

**No action required.** Bundles never imported these paths directly —
they were framework-internal and unreferenced.

### What's fixed — `requireJSON` line-comment / URL collision

The framework's `requireJSON` helper previously failed to strip bare
`//` line-comment separators in JSON config files when the same file
also contained a URL string value (`"key": "https://example.com/..."`).
The greedy `match` + `indexOf` pass collided on the URL's `://`, the
URL guard re-fired against the wrong character, and the real separator
was never stripped — `JSON.parse` then threw `Expected double-quoted
property name`.

The pass is now per-line on the leftmost `//`, with the same `:` / `"` /
`\` char-before guard as before. Comment-bearing JSON config files with
URL values now load cleanly. No action required.

### What's fixed — dev-mode hot-reload crash on `refreshCore()`

In development mode, `refreshCore()` rebuilt the `lib` and `plugins`
`require.cache` entries with their exports objects instead of `Module`
instances. A subsequent plain `require('../../lib')` then read
`.exports` off a plain object, got `undefined`, and the controller
render delegates crashed with `Cannot read properties of undefined`
after a hot reload.

`refreshCore()` now deletes the cache entry and lets the next
`require()` rebuild a proper `Module`. Production mode was never
affected — it has no hot-reload path. No action required.

---

## 0.3.11 → 0.3.12

Seven bug fixes and one dependency-floor refresh on top of `0.3.11`. **No
action required** — all changes are seamless behaviour corrections at
established contracts; no API changes, no config changes.

### Action required

None. Run `npm install -g gina@latest` (or `gina@^0.3.12` for project-local
installs) — every fix takes effect automatically.

### What's fixed — URL query-string and urlencoded body `+` decoding

Two complementary parsers had the same missing-decoder bug. The Isaac
engine's URL query-string parser never substituted `+` for space in either
of its two branches (multi-value `&` loop + single-key `=` no-`&` path), so
`GET /search?name=Hello+World` surfaced as
`request.query.name === "Hello+World"` instead of `"Hello World"`. The
`application/x-www-form-urlencoded` body parser had its content-type test
inverted, leaving `+` literal in `req.post` / `req.put` / `req.patch`
values (`name=Hello+World` → `"Hello+World"`). Both now decode correctly
per RFC 1866 / WHATWG URL spec.

Express engine was already spec-correct via `qs` / `querystring.unescape`
defaults; no change there. Closes [#B17](https://github.com/gina-io/gina/issues).

### What's fixed — Render-pipeline async-race safety (#M1 family)

Three independent fixes for concurrent-render edge cases.

`render-swig.js` captures `local.req` / `local.res` / `local.next` into
function-scoped locals at the top of the exported `render()` function, so
post-`await` reads remain race-safe when a second `self.throwError()` fires
during an in-flight `renderCustomError` and nulls the controller's `local`
closure. Same shape extended to `render-nunjucks.js`'s full call chain —
`renderNunjucks()` captures req/res/_next at the top, and the
`sendHtmlResponse` / `registerGinaFilters` / `writeCache` helpers take the
captures as trailing parameters. `render-json.js` retrofitted in its
`writeCache` helper: the post-`await` `throwError` on `invalidateOnEvents`
misconfiguration now goes through a captured `res` parameter instead of
`local.res`.

A separate dev-mode layout cache ENOENT race in `render-swig.js`'s
per-template layout cache: two parallel requests for the same
`{% extends %}` URL could see the cached layout file deleted between its
priming-block write and the post-priming read, surfacing as a 500. The
cache write now uses an atomic temp+rename pattern so concurrent readers
always observe either the prior or new content. Production was unaffected
— cached mode (`_cacheIsEnabled = true`) skips the delete-rewrite path
entirely. CVE-2023-25345 path-traversal boundary check preserved verbatim.

### What's fixed — FormValidator HTML5 form-reassociated radio serialization

Third sister fix in the HTML5 form-reassociation series. The `isRequired`
validator's radio-group case walked `document.getElementsByName($el.name)`
without filtering by form-owner — at submit time, the first matching
`.checked` radio in document order won regardless of which form was being
serialized. A sibling form's checked radio could leak into the
form-under-submission's payload (and the form-under-submission's own
default-checked radio could lose against an already-checked sibling-form
radio sharing the same name).

The fix scopes the walk to the validator-bound radio's form-owner, mirroring
the equivalent filter applied in 0.3.10's `updateRadio` peer-set scoping
(commit `80dd89f9`) and `bindForm` `defaultChecked` cache (commit
`6e544411`). No-op for the normal single-form-owner shape — only changes
behaviour in the form-reassociated layouts that were affected.

### What's changed — `@rhinostone/swig` floor bumped to `^2.2.0`

Version-currency drift fix to keep the framework's declared floor in
lockstep with the latest stable. The 2.1.0 release introduced a multi-flavor
architecture (shared `@rhinostone/swig-core` plus per-flavor frontends
including `@rhinostone/swig-twig` for Twig syntax); the native
`@rhinostone/swig` package remains drop-in compatible with the API surface
gina depends on (`swig.compile`, `swig.setFilter`, `swig.setTag`,
`swig.renderFile`). `swigResolver DEFAULT_MIN` stays at `2.0.0` — the
framework does not depend on any new 2.1.0 / 2.2.0-only API.

Projects pinning `swig.useProject: true` should ensure their own
`node_modules/@rhinostone/swig` resolves to `^2.0.0` or newer.

---

## 0.3.10 → 0.3.11

Four purely-additive feature releases on top of `0.3.10`:
internationalisation primitives (#I18N1 + #I18N2), a built-in Prometheus
metrics endpoint (#OBS1), a ScyllaDB / Cassandra ORM connector + session
store (#CN5), and a MongoDB ORM connector + session store (#CN6). **All
changes are seamless** — no API changes, no config changes, no behaviour
changes for projects that don't opt in.

### Action required

None for any of the four features. Each is opt-in via `app.json` /
`connectors.json` / `settings.json`; existing bundles continue to work
unchanged.

### What's available — Internationalisation (#I18N1, #I18N2)

Per-bundle JSON catalogs at `bundle/locales/<culture>.json` (e.g.
`en.json`, `en_US.json`, `fr.json`) plus a `t(key, params, culture)` global
helper, controller `self.t()` auto-binding `req.culture`, and swig +
nunjucks `t` template filter. CLDR plural support via Node's built-in
`Intl.PluralRules`. ICU MessageFormat opt-in via `t.icu()` powered by
`intl-messageformat`. Per-request locale negotiation from URL prefix /
cookie / `Accept-Language` / settings default. CLI: `gina i18n:scan / add /
export / import` for translator round-trip (PO / CSV / JSON).

The legacy `__()` placeholder (helpers/text.js) is rewired as a one-arg
alias of `t()` — existing callers keep working with no behaviour change
when no catalog is loaded.

See [Internationalisation guide](/guides/i18n) for adoption.

### What's available — Prometheus metrics endpoint (#OBS1)

Built-in `/_gina/metrics` endpoint exposing Prometheus exposition format.
Opt-in via `app.json`:

```json title="src/<bundle>/config/app.json"
{
  "metrics": {
    "enabled": true,
    "allowFrom": ["127.0.0.1", "::1"]
  }
}
```

Install `prom-client` as a peer dependency in your project
(`npm install prom-client`). Default metrics include Node.js process state
(heap, GC, event loop lag) plus per-request HTTP counter and duration
histogram. Route labels come from `req.routing.rule` (cardinality-safe);
status-aware fallback labels for unmatched paths. Endpoint is IP-restricted
by default (loopback only).

See [Observability guide](/guides/observability) for adoption.

### What's available — ScyllaDB / Cassandra connector (#CN5)

ORM connector + session store wrapping the official `cassandra-driver`
(Apache Software Foundation; registry pin `>=4.0.0`). CQL prepared
statements declared as `.sql` files at
`bundle/models/<keyspace>/cql/<Entity>/*.sql`, with JSDoc-style headers for
`@param` CQL-type coercion (`uuid`, `timeuuid`, `bigint`, `decimal`,
`timestamp`, etc.) and `@return` shape. Lightweight transactions
(`IF NOT EXISTS`, `IF version = ?`) supported with `[applied]` boolean
extraction. Same `$scope` substitution and `_scope` filtering as the
Couchbase connector.

The session store uses CQL `USING TTL` for per-row server-side reaping.
The sessions table must be created up front (the store does not run DDL —
deliberate, since `CREATE TABLE` requires keyspace-level privileges most
session-bind users won't have):

```cql
CREATE TABLE IF NOT EXISTS sessions (
    sid  TEXT PRIMARY KEY,
    sess TEXT
) WITH default_time_to_live = 86400;
```

Install `cassandra-driver` as a peer dependency in your project
(`npm install cassandra-driver`) and declare a `connectors.json` entry
with `"connector": "scylladb"`. Requires Node `>=20`.

See [ScyllaDB ORM guide](/guides/scylladb-orm) for adoption.

### What's available — MongoDB connector (#CN6)

ORM connector + session store wrapping the official `mongodb` driver
(registry pin `>=7.0.0`). JSON pipeline files at
`bundle/models/<db>/pipelines/<Entity>/*.json` declare one operation each,
with JSDoc-style headers for `@param` BSON-type coercion and `@return`
shape. Three placeholder shapes — `{$arg: N}` for caller-supplied positional
args, `{$oid: "<hex>"}` for ObjectId literals, and a literal `"$scope"`
string for environment isolation. Eleven operations supported (`findOne` /
`find` / `aggregate` / `countDocuments` / `insertOne` / `insertMany` /
`updateOne` / `updateMany` / `replaceOne` / `deleteOne` / `deleteMany`).

The session store creates a TTL index on the first `set()` call (deferred so
ORM-only setups never run DDL) and filters `get` / `length` / `all` on
`expiresAt > now` to cover the 60-second TTL-monitor lag.

Install `mongodb` as a peer dependency in your project
(`npm install mongodb`) and declare a `connectors.json` entry with
`"connector": "mongodb"`.

See [MongoDB ORM guide](/guides/connectors-mongodb) for adoption.

---

## 0.3.9 → 0.3.10

A FormValidator hardening release covering HTML5 form-reassociated controls
(`<input form="X">`), plus reverse-proxy path-prefix awareness via the standard
`X-Forwarded-Prefix` request header. **All changes are seamless** — no API
changes, no config changes, no behavior changes for the common single-form-owner
case or for bundles not sitting behind a reverse proxy on a sub-path.

### Action required

None. Every change in this release is a no-op for the normal shape (controls in
their own form, no reverse proxy in front of the bundle). If your bundle uses
HTML5 form reassociation OR sits behind a reverse proxy on a sub-path, the new
behaviour is automatic.

### What's fixed (seamless)

- **FormValidator binding for form-reassociated controls** — `bindForm` now
  collects controls via `HTMLFormControlsCollection` (`form.elements`) for
  owner-aware collection. A parent form no longer accidentally collects
  descendants reassociated to other forms. Per-control listeners are attached on
  out-of-tree reassociated controls (whose events don't bubble to the form), and
  `unbindForm` symmetrically drains the side-table on cleanup.
- **FormValidator radio mutual-exclusion grouping** — `updateRadio` now scopes
  the peer set by form-owner. Same-name radios in different form-owners are no
  longer cross-fired into each other's mutual-exclusion loop. On init, the IDL
  `.checked` is reconciled with the HTML `checked` attribute when they disagree,
  recovering author intent for radios that surface the parse-time IDL/attribute
  desync browsers produce in mixed DOM-tree + form-owner layouts.
- **FormValidator reset for form-reassociated radios** — `bindForm`'s
  `fieldsSet[id].defaultChecked` cache now reads the IDL `defaultChecked`
  property (which mirrors the HTML `checked` attribute regardless of the live
  IDL state) instead of the live `.checked`. A `type="reset"` action on the form
  correctly restores the originally-checked option for radios that hit the
  parse-time desync.

### What's new (opt-in, no migration)

- **`X-Forwarded-Prefix` reverse-proxy support** — when a reverse proxy mounts
  the bundle on a sub-path and forwards `proxy_set_header X-Forwarded-Prefix /sub;`,
  the framework composes a public webroot (proxy prefix + bundle internal
  `server.webroot`) and templates it into `gina.config.webroot`. Client-side URL
  construction (`/_gina/assets/routing.json` fetch, `gina.min.css` link
  injection, etc.) targets the correct upstream through the proxy. Header value
  is normalised (leading slash, trailing slashes stripped, empty / `"/"`
  dropped); back-compat preserved when the header is absent. The bundle's
  internal `server.webroot` is unchanged; only the value templated into the
  rendered page (`page.environment.webroot` and the client-side
  `gina.config.webroot`) carries the prefix.

### Upgrade

```bash
npm install -g gina@latest --prefix=~/.npm-global
```

---

## 0.3.8 → 0.3.9

A consumer-feedback batch — 11 framework patches surfaced from a downstream production
deployment. **Most fixes are seamless** (no API changes required); one **behavior change**
for nunjucks template authors is called out below.

### Action required (only if applicable)

#### Nunjucks templates living at `<namespace>/<namespace>-<action>.njk`

If your bundle uses `render.engine = "nunjucks"` AND your route names already carry their
namespace (e.g. `project-get`, `client-list`), the framework now drops the redundant prefix
when resolving template paths:

| Route name | Namespace | Old path | New path |
|---|---|---|---|
| `project-get` | `project` | `project/project-get.njk` | `project/get.njk` |
| `client-list` | `client` | `client/client-list.njk` | `client/list.njk` |

**Migration**: rename your template files to drop the namespace prefix from the file
segment. Routes that don't carry the namespace (e.g. `project/get`, `client/list`) are
unaffected. Bundles using swig (the default) and nunjucks bundles whose template paths
already match the new shape need no action.

### What's fixed (seamless)

- **Couchbase 4.x sessions** — `JsonTranscoder` returns the already-decoded value rather
  than raw bytes. The v4 session-store now detects pre-parsed objects and short-circuits
  before the legacy `.toString()` path. Closes a 500 on every authenticated request that
  touched session retrieval under Couchbase Node SDK 4.x.
- **Per-request middleware dispatch isolation** — `nextMiddleware` previously held
  dispatch state on its own function-object properties; under concurrent requests,
  request B's setup overwrote request A's, surfacing as sporadic `[csrf] no req.session.id`
  500s. Each request now gets a fresh closure with isolated state.
- **`length` filter null safety** (nunjucks + swig) — `{{ undefined | length }}` now
  returns 0 instead of crashing with a `TypeError`. Matches upstream nunjucks
  `runtime.length` and Jinja2 semantics.
- **Asset-cataloguing for embedded `{{ }}`** — `getAssets()` no longer strips the inner
  Swig string-literal quotes when `{{ }}` is embedded mid-URL (e.g.
  `css/main.css?cache={{ ''|formatDate('HH:MM:ss') }}`). Closes a `Unexpected colon on line N`
  from the cached layout's runtime Swig pass.
- **Six render-nunjucks improvements** — `lib` registry import survives `refreshCore()`
  cache poisoning; `userData` keys now reach the top-level template context (`{{ foo }}`
  works in addition to `{{ page.data.foo }}`); `data.data` is aliased to `data.page.data`
  so `{% set X = data.Y %}` resolves under nunjucks layout inheritance; `{{ page.X }}`
  placeholders inside the framework's `ginaLoader` HTML now substitute correctly (was
  breaking `gina.popin` / `gina.session` / `gina.forms` / `window.onGenericXhrResponse`
  on every page); plus the namespace-prefix change above.
- **Plugin env vars** — `process.env` now reflects framework env vars after the
  `bin/cli` filter strip; CSRF middleware and other third-party plugins that read
  `process.env` directly now see expected values.

### What's new (opt-in, no migration)

- **Bundle filter wraps for nunjucks** — bundles can register a filter wrap function on
  `process.gina._bundleFilterWraps[bundleName]`; the framework applies it inside the
  per-request filter factory. Survives dev-mode `refreshCore()` evictions of the `lib`
  singleton. No-op until you register one.

### Upgrade

```bash
npm install -g gina@latest --prefix=~/.npm-global
```

---

## 0.3.7 → 0.3.8

Patch release for the `0.3.7` install regression. **No API changes, no
config changes** — upgrading is a one-liner:

```bash
npm install -g gina@latest --prefix=~/.npm-global
```

### What was wrong with 0.3.7

`npm install -g gina@0.3.7` failed with `Cannot find module 'psl'` on
both fresh installs and upgrade installs. The pre/post-install scripts
loaded the framework `lib` registry, which transitively required `psl` —
declared in `framework/v*/package.json` but only fetched by post-install's
nested `npm install`, which runs *after* the pre-install crash. Anyone
running `npm install -g gina@latest` between the release of `0.3.7`
(2026-04-26) and the release of `0.3.8` saw the install fail.

### What changed in 0.3.8

- `psl` and `@rhinostone/swig` are now declared as **top-level npm
  dependencies** in `package.json`. npm fetches them through the standard
  install chain before any lifecycle script runs, so framework code's
  `require('psl')` resolves through Node's normal module-resolution chain.
- The pre/post-install scripts no longer load the framework `lib`
  registry. Node's built-in `console` is sufficient for install-time
  logging; `console.setLevel` (the only `lib.logger`-only method used by
  these scripts) is gated behind a `typeof` check.
- A filesystem-driven helpers preload in both install scripts ensures
  `lib/logger`'s circular dependency with `framework/v*/helpers/`
  completes before any internal helper's module-local `console` is
  bound, so they receive the full Logger singleton from cache.

No project-level changes are required. Bundle code, config files, and
runtime behaviour are unchanged.

---

## 0.3.6 → 0.3.7

### Security: `gina.plugins.Session` — hardened cookie defaults _(one-line opt-in)_

:::note New plugin — opt-in, default off for existing bundles
Bundles can now wrap `express-session` with a framework-supplied plugin that
injects SameSite / HttpOnly / Secure defaults from `config/settings.json`
into the session cookie. The wrapper reads the `session.cookie` block, merges
missing flags, and validates the browser-parity invariant
(`SameSite=None` without `Secure` is rejected at bundle startup).

**Adoption is a single line in the bundle bootstrap:**

```js
// before
// var session = require('express-session');

// after
var session = require('gina').plugins.Session(require('express-session'));
```

Everything downstream — `app.use(session({...}))`, the `SessionStore`
factory, passport integration — stays exactly the same.

**Default values:**

```json
{
  "session": {
    "cookie": {
      "sameSite": "lax",
      "httpOnly": true,
      "secure":   "auto"
    }
  }
}
```

- `sameSite` — `"lax"` covers the common drive-by CSRF case. Use `"strict"`
  for extra containment at the cost of breaking click-through login flows.
  `"none"` permits cross-site cookie sending and **requires** `secure: true`
  (browser-enforced).
- `httpOnly` — `true` prevents client-side JS from reading the cookie. Set
  to `false` only when a validator, toolbar, or similar needs
  `document.cookie` access.
- `secure` — `"auto"` is express-session's idiom for "mirror the request
  security flag", typically paired with `app.set('trust proxy', 1)`.

**Intentional bundle choices are preserved.** The plugin merges defaults only
for flags the bundle did not set. A bundle that passes
`cookie: { httpOnly: false, secure: true, ... }` keeps both values; the
plugin only fills in the missing `sameSite`.

**Cross-site cookie use case.** Bundles that rely on cross-site cookie send
(third-party OAuth embeds, iframe flows) must set both flags explicitly:

```js
app.use(session({
  // ...
  cookie: { sameSite: 'none', secure: true, maxAge: 86400000 }
}));
```

Passing `sameSite: 'none'` without `secure: true` throws a clear
`[gina session] invariant violation` error at startup — matching what every
modern browser does silently when the cookie arrives.

**No action required** for existing bundles that keep
`require('express-session')` directly. They continue working exactly as
before, with their existing cookie configuration. Hardening is opt-in — a
one-line change when the bundle is ready for it. This is the baseline for
the broader CSRF track — `#CSRF2` signed double-submit token middleware
shipped in `0.3.7-alpha.9`; `#CSRF3` Origin/Referer pre-filter shipped in
`0.3.7-alpha.10`.
:::

### Security: `gina.plugins.Csrf` — signed double-submit token middleware _(opt-in)_

:::note New plugin — opt-in, default off for existing bundles
Bundles can now register a stateless CSRF middleware that issues a HMAC-signed
token cookie on safe-method requests and verifies a matching `X-Gina-CSRF-Token`
header (or `_csrf` form field) on mutating requests
(POST / PUT / PATCH / DELETE). Safe methods (GET / HEAD / OPTIONS) pass
through. Aligned with [OWASP ASVS 4.0 V4.2.1](https://owasp.org/www-project-application-security-verification-standard/).

**Adoption is two lines in the bundle bootstrap** — `Csrf` registers **after**
`Session`:

```js
var session = require('gina').plugins.Session(require('express-session'));
var csrf    = require('gina').plugins.Csrf();

app.use(session({ /* ... */ }));   // must come FIRST
app.use(csrf);
```

**Required env var:**

```bash
openssl rand -base64 64    # generate once
```

```json
// src/api/config/env.json
{ "dev": { "GINA_CSRF_SECRET": "<paste output>" } }
```

There is no dev fallback. Missing the env var throws at factory call time
with an actionable message naming the env var and the generation command.

**Default values** (under `csrf` in `settings.json`):

```json
{
  "csrf": {
    "cookieName":  "gina-csrf-token",
    "headerName":  "X-Gina-CSRF-Token",
    "fieldName":   "_csrf",
    "rotate":      "per-session",
    "safeMethods": ["GET", "HEAD", "OPTIONS"]
  }
}
```

**Per-route opt-out** for webhook receivers (Stripe, GitHub, etc.) that have
their own origin verification:

```jsonc
// src/api/config/routing.json
"stripe-webhook": {
  "url":        "/webhooks/stripe",
  "method":     "POST",
  "csrfExempt": true,
  "param":      { "control": "@webhook:stripe", "file": "stripe.js" }
}
```

**Templates** get two helpers when the plugin is registered — `gina.csrfToken`
(string) and `gina.csrfInput` (pre-formatted hidden input). Render the input
inside any `<form>` and you are done:

```swig
<form method="POST" action="/invoice">
    {{ gina.csrfInput | safe }}
    <button type="submit">Send invoice</button>
</form>
```

**AJAX integration is automatic** when your forms go through Gina's built-in
validator plugin — the cookie is read and the header is injected on mutating
methods with zero bundle code change. Hand-rolled `fetch` / `XHR` paths read
the `gina-csrf-token` cookie and set `X-Gina-CSRF-Token` themselves.

**No action required** for bundles that have not adopted the Csrf plugin —
existing routes continue working exactly as before. Hardening is opt-in. The
plugin requires `gina.plugins.Session` to be registered first (the `#CSRF1`
baseline above); without a session id, `req.session.id` is missing and the
middleware throws via `next(err)` with a clear message pointing at the fix.

See the [CSRF guide](/guides/csrf) for the full reference, including AJAX
patterns, error tables, and the request-flow diagram.
:::

### Security: `gina.plugins.Csrf` — Origin/Referer pre-filter (`#CSRF3`) _(automatic on adoption)_

:::note Layered ON TOP of the token middleware — same plugin, second layer
The Csrf middleware now runs an Origin/Referer pre-filter **before** the
signed-token verify on every mutating request (POST/PUT/PATCH/DELETE):

1. Read `Origin` first; fall back to parsing the host out of `Referer`
   when `Origin` is absent.
2. Match the parsed origin against `csrf.allowedOrigins`.
3. Both headers missing → 403 `missing origin/referer`. Mismatch → 403
   `origin not allowed`. Otherwise the request continues to the existing
   `#CSRF2` token verify.

A forged token with a matching cookie still gets rejected here when the
request didn't come from an allowed origin — **token layer ≠ Origin
layer**. Belt-and-suspenders for the token middleware: catches edge cases
tokens might miss (referrer-header log leaks, legacy browser bugs that
leak tokens in URLs, misconfigured reverse proxies that accept
cross-origin requests).

**Default allowlist** — when `csrf.allowedOrigins` is empty or unset, the
plugin uses a single-entry allowlist: the bundle's configured hostname
(`scheme://host[:port]`, derived from `conf[bundle][env].hostname` or
composed from `server.scheme + host + server.port`). Most single-domain
bundles need no configuration at all.

**Explicit allowlist** — for multi-domain bundles, set
`csrf.allowedOrigins` in `settings.json`:

```json
{
  "csrf": {
    "allowedOrigins": [
      "https://example.com",
      "https://www.example.com"
    ]
  }
}
```

Entries are matched literally (case-insensitive). Different scheme on the
same host doesn't match (`http://example.com` ≠ `https://example.com`),
and different port doesn't match.

**Per-route exempt** is consistent with the token layer — `routing.json
> "csrfExempt": true` bypasses BOTH the Origin pre-filter AND the token
verify. Webhook receivers that mark `csrfExempt: true` continue working
as before.

**Factory throws at startup** when `csrf.allowedOrigins` is empty AND no
bundle hostname can be resolved from `conf[bundle][env]`. The error
message points at both fixes (set the settings key, or fix the conf).

**No action required** for bundles that have already adopted `#CSRF2` and
serve from a single configured hostname — the pre-filter activates
automatically on upgrade and the bundle hostname is auto-derived. Bundles
that serve the same app on multiple hostnames (e.g. `.com` + `.co.uk`)
must add their additional hostnames to `csrf.allowedOrigins` before
upgrade or mutating requests from the secondary hostname will 403.

See the [CSRF guide — Origin / Referer pre-filter](/guides/csrf#origin--referer-pre-filter)
for the matrix of conditions and the failure-mode reference.
:::

### Added: `swig.useProject` — project-pinned swig override _(no action required)_

:::note New feature — opt-in, default off
Bundles can now load a project-pinned `@rhinostone/swig` (or
`@rhinostone/swig-twig` for the Twig frontend) from the project's
`node_modules/` in place of the framework's bundled copy, by setting
`swig.useProject: true` in `config/settings.json`:

```json
{
  "swig": {
    "useProject": true,
    "package": "@rhinostone/swig"
  }
}
```

The framework honours the override only when the project pin satisfies two
safety gates — same major as the framework floor (currently `1.6.0`) **and**
version at or above the floor. A rejected override falls back to the
framework's copy and logs a one-line `[swig-resolver]` warning at bundle
startup.

Default remains `swig.useProject: false` — existing bundles see no behaviour
change. See the [Swig overview](/templating/swig) for the full list of warning codes
and the [Twig frontend](/templating/twig) for package override details.
:::

### Added: `render.engine = "nunjucks"` — opt-in nunjucks rendering _(no action required)_

:::note New feature — opt-in, default off
Bundles can now render templates with [nunjucks](https://mozilla.github.io/nunjucks/)
instead of swig by setting `render.engine: "nunjucks"` in `config/settings.json`
and installing the package in the project root:

```json
{
  "render":   { "engine": "nunjucks" },
  "nunjucks": { "autoescape": true }
}
```

```bash
npm install nunjucks
```

Default remains `render.engine: "swig"` — existing bundles see no
behaviour change. The framework never declares nunjucks as a
dependency; it's only loaded when a bundle opts in, and only from the
project's `node_modules/`. A bundle that opts in without installing the
package fails at startup with a clear `NUNJUCKS_NOT_INSTALLED` error
rather than a silent mid-render failure.

Basic `.njk` rendering works end-to-end in the MVP; the Inspector dev
payload, HTTP/2 `stream.respond()` direct path, and error-page template
routing shipped as follow-ups in `0.3.7-alpha.2` at parity with the swig
path. Still deferred from the swig path: Early Hints 103 preloads and the
static HTML response cache. See the [Nunjucks guide](/templating/nunjucks) for
the full parity table.
:::

---

## 0.3.5 → 0.3.6

### Security: Inspector payload redaction _(no action required)_

:::note Security — upgrade recommended
Dev-mode Inspector data (`window.__ginaData`, `localStorage`, `/_gina/agent` SSE,
engine.io push) is now redacted before any sink. Fields whose keys match secret
patterns (`password`, `token`, `apikey`, `secret`, `cvv`, `ssn`, `authorization`,
`credentials`, `private_key`, etc.) are replaced with `[redacted]` in the Inspector
feed. The actual HTTP response body is **never** modified — redaction only affects
the dev-mode Inspector channel.

Two carve-outs preserve validation metadata:
- **Suffix carve-out** — keys ending in `rule`, `policy`, `validator`, `config`,
  `settings`, `schema`, etc. pass through (e.g. `passwordRule`, `passwordPolicy`).
- **Primitive-only redaction** — when a matched key holds an object or array, the
  walker recurses into it instead of replacing it (metadata shapes like
  `rules.account[password]` are preserved).

Configurable via `settings.json` `inspector.redact.{patterns, types, replacement}`.
No code changes needed — defaults cover standard secret field names.
:::

### Security: pre-commit hook and CI guard for local-tool configuration paths _(no action required)_

:::note Internal — no action required
A `.githooks/pre-commit` hook and GitHub Actions workflow now block local-tool
configuration paths from entering git history or the npm tarball.
`post_install.js` installs the hook automatically for contributor clones. These are
internal safeguards with no user-facing impact.
:::

### Security: private-token leak gate _(no action required)_

:::note Internal — no action required
The npm `prepack` hook now scans the tarball listing for local-tool configuration paths and
private-token patterns before every publish. No user-facing impact.
:::

### Changed: `syncDocs` lockfile regeneration _(no action required)_

:::note Internal — no action required
`post_publish.js → syncDocs` now regenerates the docs-site `package-lock.json`
after bumping the `gina` devDependency. This prevents CI / Vercel deploy failures
that occurred on previous stable releases when the lockfile was stale.
:::

### Fixed: Whisper Error on first CLI command after fresh install _(patch fix)_

:::caution Upgrade recommended
`gina --version` and `gina framework:*` commands no longer emit a spurious
`Whisper Error: The key ${global_mode} was not found` red stack trace on a
brand-new install. If you see this error after `npm install -g gina`, upgrading
to 0.3.6 resolves it.
:::

```bash
npm install -g gina@latest
```

### Fixed: `framework:init` hardened against missing `def_*` keys _(no action required)_

:::note Internal — no action required
`main['def_prefix']`, `def_global_mode`, `def_arch`, `def_platform`, `def_env`,
`def_scope`, `def_log_level` reads now short-circuit to `undefined` instead of
throwing `TypeError` when the key is absent from `~/.gina/main.json`.
:::

### Fixed: CORS preflight `access-control-allow-headers` preservation _(bug fix)_

`completeHeaders()` no longer overwrites the echo that `checkPreflightRequest()`
sets from the incoming `access-control-request-headers`. If your bundle's `env.json`
`access-control-allow-headers` list omits a header the client sends, the preflight
response now correctly echoes the requested headers instead of dropping them.

No config change needed — the fix is automatic.

### Fixed: `prepare_version.js` stale `dir` field _(internal)_

:::note Internal — no action required
Publishing now fails fast with an actionable message when `~/.gina/<release>/settings.json`
has a stale `dir` field, instead of wedging with a misleading "No branch selected" error.
:::

---

## 0.3.4 → 0.3.5

### Security: extended CVE-2023-25345 path-traversal guards _(no action required)_

:::note Security — upgrade recommended
`@rhinostone/swig` bumped to `1.5.0`. Extends the CVE-2023-25345 path-traversal
blocklist to bracket-notation access (`obj['__proto__']`), `set` bracket
assignments, `for` loop variable names, macro names, and import aliases —
closing the remaining bypass surface in the parse-time guard.

No breaking changes. No config update needed. `npm install gina@latest` picks
up the new swig version automatically.
:::

```bash
npm install gina@latest
```

### Security: browser-side swig parity _(no action required)_

:::note Security — upgrade recommended
The vendored client-side swig build (`core/deps/swig-client/`) was rebuilt from
`@rhinostone/swig@1.5.0`. Browser-side templating now has the same CVE-2023-25345
protections as the server. If you render templates in the browser (gina's
client-side swig runtime), the extended `__proto__` / `constructor` / `prototype`
blocklist now applies to bracket notation, `for` variables, macro names, and
import aliases there too.
:::

---

## 0.3.3 → 0.3.4

### Fixed: `require('gina/gna')` explicit exports _(patch fix)_

:::caution Action required if using explicit imports
`require('gina/gna')` was broken in v0.3.3 — the published package contained
stale framework paths (`v0.3.3-alpha.3` instead of `v0.3.3`), causing
`MODULE_NOT_FOUND` errors. Upgrade to 0.3.4 to fix this.

If you use only `require('gina')` (the standard import), you are not affected.
:::

```bash
npm install gina@latest
```

### Internal: release lifecycle scripts now sync `gna.js` _(no action required)_

:::note Internal — no action required
`prepare_version.js` and `post_publish.js` now automatically update `gna.js`
framework paths when the version changes. This prevents the stale-path issue
from recurring in future releases.
:::

---

## 0.3.2 → 0.3.3

### TypeScript declarations _(additive)_

:::note Additive — no action required
TypeScript declaration files are now included in the package (`types/index.d.ts`,
`types/globals.d.ts`, `types/gna.d.ts`). IDEs with TypeScript support will
automatically pick up type information for `SuperController`, `EntitySuper`,
config file shapes, and all global helpers. No `@types/gina` package needed.
:::

### Explicit exports via `require('gina/gna')` _(additive)_

:::note Additive — no action required
All global helpers are now available as named imports:
```javascript
const { getContext, _, onCompleteCall, uuid } = require('gina/gna');
```
The existing global injection is unchanged — this is an additional import path
for IDE go-to-definition and static analysis. Lazy getters ensure symbols
resolve correctly after framework boot.
:::

### `bundle:openapi` CLI command _(additive)_

:::note Additive — no action required
:::

Generate an OpenAPI 3.1.0 spec from your `routing.json`:

```bash
gina bundle:openapi api @myproject
gina bundle:openapi api @myproject --output ./api-spec.json
```

Route annotations (`description` fields in `routing.json`) become OpenAPI `description` fields. Alias: `bundle:oas`.

### `framework:get` and `port:set` CLI commands _(additive)_

:::note Additive — no action required
:::

- `gina get --key` / `gina get all` — read one or all keys from `~/.gina/settings.json`
- `gina port:set http/1.1:3200 frontend @myproject/dev` — set a specific port without a full `port:reset`

### Swig migration _(internal)_

:::note Additive — no action required
The vendored `swig-1.4.2` has been replaced with the [`@rhinostone/swig`](/templating/swig) npm dependency (maintained fork with [CVE-2023-25345](/templating/swig/security#cve-2023-25345) patched). Template rendering behaviour is unchanged.
:::

### Live database index introspection _(additive)_

:::note Additive — no action required
:::

The Inspector Query tab now queries actual database indexes from MySQL, PostgreSQL, and SQLite connectors. No manual `indexes.sql` files required — index badges resolve automatically when the Inspector is opened.

### Popin performance improvements _(internal)_

Parallel DOM-injected resource loading replaces sequential XHR + `eval()`. `popinDestroy()` is now functional (was a stub). No API changes.

### Validator fix — touched-field-only errors _(bug fix)_

The global validation pass on field blur no longer displays errors for untouched fields. Only the field the user interacted with shows its error. Submit button enable/disable logic is unchanged.

### Docker and container fixes _(bug fix)_

- `streamsearch` vendored to fix `busboy MODULE_NOT_FOUND` crash after framework directory rename in containers
- `emerg` messages now forward to CLI output and docker logs when a bundle aborts during startup
- Config loader checks `MIDDLEWARE` file existence before reading — prevents crash in containers where the file is absent

### requireJSON trailing comma tolerance _(bug fix)_

JSON config files with trailing commas (e.g. `{"key": "value",}`) now produce a warning instead of calling `emerg` + `process.exit(1)`. The file is parsed successfully after stripping the trailing commas. Genuinely broken JSON still aborts as before.

---

## 0.3.1 → 0.3.2

### JSON Schema for config files _(additive)_

:::note Additive — no action required
Seven JSON Schema files are now published at `gina.io/schema/*`. You can reference
them in your config files for IDE validation and autocomplete.
:::

Add a `$schema` property to any Gina config file to enable validation:

```json title="config/routing.json"
{
  "$schema": "https://gina.io/schema/routing.json",
  "home": {
    "url": "/",
    "param": { "action": "home" }
  }
}
```

Available schemas: `app.json`, `connectors.json`, `manifest.json`, `routing.json`,
`settings.json`, `watchers.json`, `app.crons.json`.

### Entity short-name aliases _(additive)_

:::note Additive — no action required
Existing `self.getEntity('user/user')` calls continue to work unchanged.
:::

You can now use the short form when the entity name matches the directory name:

```javascript
// Before (still works)
var user = self.getEntity('user/user');

// After (new shorthand)
var user = self.getEntity('user');
```

### Model loading without `onInitialize` _(bug fix)_

Models that do not define an `onInitialize` hook now load correctly. Previously,
the absence of this hook could cause a silent failure during entity registration.

### `getConfig()` proxy override fix _(bug fix)_

`getConfig()` no longer overwrites the hostname with `undefined` when
`PROXY_HOSTNAME` is not set. This affected same-origin POST requests that include
an `Origin` header (all modern browsers).

### Inspector improvements _(additive)_

- **Tab layout presets** — choose Balanced, Backend, Frontend, or Custom (drag-to-reorder) in the settings panel
- **Query performance banners** — slow and heavy queries are flagged with anchor links to the offending card
- **Missing-index banners** — queries with `indexes: []` get a red warning banner
- **Cross-bundle QI propagation** — queries from upstream bundles (via `self.query()`) now appear in the downstream Inspector
- **`render-json` Inspector feed** — JSON-only APIs now emit Inspector data when the Inspector is connected

---

## 0.3.0 → 0.3.1

### Dependency reduction — `ssl-checker`, `colors`, `uuid` removed _(no action required)_

:::note Additive — no action required
`engine.io` is now the sole runtime dependency. Three dev/build-time dependencies
have been removed and replaced with built-in equivalents. Your bundle code is
unaffected.
:::

| Removed dep | Replaced by | Why |
|---|---|---|
| `ssl-checker` | Built-in `https.request` + `getPeerCertificate()` | Eliminates a transitive dependency tree for a single TLS check |
| `colors` | Hardcoded ANSI escape map in the logger | Supply-chain risk — `colors` 1.4.1+ was intentionally sabotaged upstream |
| `uuid` | `crypto.randomUUID()` (Node 19+) | Native API, zero-dependency UUID v4 generation |

If your bundle code imports `uuid` directly (not through Gina), your project's own
`node_modules/uuid` is unaffected.

### SQL index reporting in the Inspector _(additive)_

:::note Additive — no action required unless you want index badges
This feature activates automatically when an `indexes.sql` file is present.
:::

The Inspector's Query tab now shows **index badges** for MySQL, PostgreSQL, and
SQLite queries. To enable them, create an `indexes.sql` file in your bundle's
SQL directory containing the `CREATE INDEX` statements that match your schema:

```sql title="src/api/models/sql/indexes.sql"
CREATE INDEX idx_invoice_date ON invoices (created_at);
CREATE UNIQUE INDEX idx_user_email ON users (email);
```

The connector reads this file once at startup and matches each query's target
table against the known indexes. Three badge states appear in the Query tab:

| Badge | Meaning |
|---|---|
| Green (index name) | A secondary index covers the query's table |
| Amber (`PRIMARY`) | Only a primary key scan is available |
| Red (`no index`) | The `indexes.sql` file exists but no index covers this table |
| Grey (`N/A`) | No `indexes.sql` file — index reporting not available |

The Couchbase connector extracts indexes from the query execution plan
automatically (no `indexes.sql` needed).

### HTTP/2 direct stream for HTML rendering _(internal optimization)_

HTML rendering (`render-swig.js`) now uses `stream.respond()` + `stream.end()`
directly for HTTP/2 requests, bypassing the HTTP/1.1 compatibility layer. This
matches the pattern already used by JSON rendering. No configuration change —
the optimization applies automatically when the Isaac HTTP/2 engine is active.

---

## 0.2.0 → 0.3.0

### `self.renderStream()` — new streaming response method _(additive)_

`self.renderStream(asyncIterable, contentType)` is a new terminal method on
SuperController. No existing code is affected. Add it when you need real-time token
delivery (LLM streaming) or SSE endpoints.

```js
// Anthropic token stream
this.chat = async function(req, res, next) {
    var self = this;
    var ai   = getModel('claude');
    async function* tokens() {
        var s = ai.client.messages.stream({
            model      : ai.model
          , max_tokens : 1024
          , messages   : [{ role: 'user', content: req.post.message }]
        });
        for await (var ev of s)
            if (ev.type === 'content_block_delta') yield ev.delta.text;
    }
    self.renderStream(tokens());   // SSE by default
};
```

See [renderStream in the controller guide](/guides/controller#selfrenderstreamasynciterable-contenttype)
and [token streaming in the AI guide](/guides/ai#token-streaming-with-renderstream).

### AI connector — `.infer()` replaces `.complete()` _(rename, alpha only)_

:::note For 0.3.0-alpha testers only
This rename happened within the `0.3.0-alpha` series. If you are upgrading from `0.2.0`
stable the AI connector is entirely new — no action needed.
:::

The unified inference method was renamed from `.complete()` to `.infer()` to use
standard ML terminology and avoid confusion with Gina's own `.onComplete()` callback
pattern.

```js
// before (0.3.0-alpha.1 early builds)
var result = await ai.complete(messages, options);

// after
var result = await ai.infer(messages, options);
```

The returned shape `{ content, model, usage, raw }` and all options (`model`,
`maxTokens`, `temperature`, `system`) are unchanged. The `.onComplete()` shim on the
returned Promise is also unchanged.

### `self.query()` — non-2xx errors now always reach the callback

:::caution Behavior change
In 0.2.x, when an upstream service returned a non-2xx status, `self.query()` called
`self.throwError()` **internally**, bypassing the callback entirely. The error page was
shown automatically and the callback never fired.

In 0.3.0, the callback **always fires** for non-2xx responses. The controller action is
responsible for deciding what to do with the error.
:::

**What you need to do:**

If your callback has an error branch, it continues to work — just change the terminal call:

```js
// Before (0.2.x) — callback never fired on non-2xx; throwError was called internally
self.query(opt, function(err, data) {
  if (err) {
    // This line was unreachable in 0.2.x
    return self.throwError(res, 502, err);
  }
  self.render(data);
});

// After (0.3.0) — callback always fires; use self.render(err) to show the error page
self.query(opt, function(err, data) {
  if (err) {
    return self.render(err);   // render() intercepts non-2xx and routes to throwError automatically
  }
  self.render(data);
});
```

If your callback had **no error branch** (relying on the automatic `throwError`), add one:

```js
// Before (0.2.x) — errors were silently handled internally
self.query(opt, function(err, data) {
  self.render(data);
});

// After (0.3.0) — errors reach the callback; handle them explicitly
self.query(opt, function(err, data) {
  if (err) return self.render(err);
  self.render(data);
});
```

See the [controller guide](./guides/controller.md#outgoing-requests) for the full error
shape and handling options.

---

### Async controller actions

:::note Additive — no action required
Existing sync controller actions continue to work exactly as before.
:::

Controller actions can now be declared `async`. The router automatically attaches
`.catch()` to any thenable returned by an action and routes the rejection to
`throwError(response, 500, ...)` — you do not need to wrap every action in
`try/catch` to prevent unhandled-rejection crashes.

```js
// Before (sync — still fully supported, no change needed)
var Controller = function() {
    var self = this;

    this.home = function(req, res, next) {
        self.renderJSON({ ok: true });
    };
};
module.exports = Controller;
```

```js
// After (async — opt in per action)
var db = getModel('blog'); // your database, schema, or bucket name

var Controller = function() {
    var self = this;

    this.home = async function(req, res, next) {
        var user = await db.userEntity.getById(req.session.user.id);
        self.renderJSON({ ok: true, user: user });
    };
};
module.exports = Controller;
```

Entity methods (`await entity.method()`) already worked since 0.2.0 — they
return a native Promise with an `.onComplete(cb)` shim for backwards
compatibility.

### `onCompleteCall(emitter)` — new global helper

For PathObject file operations (`mkdir`, `cp`, `mv`, `rm`) and `Shell` commands,
which fire `.onComplete(cb)` rather than returning a Promise, use the new global
`onCompleteCall()` adapter:

```js
var Controller = function() {
    var self = this;

    this.upload = async function(req, res, next) {
        await onCompleteCall( _(self.uploadDir).mkdir() );
        self.renderJSON({ ok: true });
    };
};
module.exports = Controller;
```

No require needed — `onCompleteCall` is injected globally by the path helper.

### PATCH method

:::note Additive — no action required
Existing POST and PUT actions are unchanged.
:::

`"method": "PATCH"` is now valid in `routing.json`. The request body is available
on `req.patch` (or `req.body` for method-agnostic access). Use PATCH when only a
subset of a resource's fields should change — the server applies only what is sent
and leaves everything else untouched. Use PUT when the full resource is replaced.

```json title="routing.json"
{
  "user-patch": {
    "method": "PATCH",
    "url":    "/users/:id",
    "param":  { "control": "patch" }
  }
}
```

```js
this.patch = async function(req, res, next) {
    // req.patch contains only the fields the client sent
    var ok = await db.userEntity.patchById(req.routing.param.id, req.patch);
    self.renderJSON({ ok: ok });
};
```

See [Request objects by HTTP method](/guides/controller#request-objects-by-http-method)
for the full PUT vs PATCH comparison.

---

### HEAD method

:::note Additive — no action required
Routes declared as GET automatically accept HEAD — no routing change required.
:::

HEAD requests run the full controller action and return all response headers, but
the body is suppressed before writing to the wire. Useful for cache validation,
existence checks (`404` vs `200` without downloading a payload), and CDN probing.

No code changes are needed for existing GET routes. If you want an explicit HEAD
route, declare it with `"method": "HEAD"` in `routing.json`.

```bash
# Check whether a resource exists and what content-type it returns
curl -I https://api.example.com/documents/42
# HTTP/1.1 200 OK
# content-type: application/json; charset=utf-8
# content-length: 847
```

---

### `gina_version` in `manifest.json` — per-bundle framework version pin

:::note Additive — no action required
Bundles without a `gina_version` entry continue to use the socket server's
running version, exactly as before.
:::

A new optional `gina_version` field on each bundle entry in `manifest.json` pins
that bundle to a specific installed gina version. The socket server is unaffected.

```jsonc title="manifest.json"
{
  "bundles": {
    "api": {
      "version":      "0.0.1",
      "gina_version": "0.2.1-alpha.3",   // ← new optional field
      "src":          "src/api"
    }
  }
}
```

`bundle:add` now writes `gina_version` automatically (set to the current
framework version at scaffold time). Existing bundles are unchanged.

The `--gina-version=<version>` flag on `bundle:start` overrides the manifest
declaration at start time. See the [bundle CLI reference](./cli/bundle.md#per-bundle-framework-version)
for the full priority order and isolation behaviour.

---

## 0.1.7 → 0.1.8

### Config interpolation — `${variable}` syntax required

:::danger Breaking change
The `whisper()` interpolation engine — which substitutes variables in config
files (`env.json`, `settings.json`, `app.json`, `templates.json`, `statics.json`,
etc.) — now requires the `${variable}` syntax. Bare `{variable}` placeholders
(without the leading `$`) are **no longer replaced**.
:::

**Action required** for any config file that uses the bare `{variable}` syntax:

```jsonc title="Before (no longer works)"
"logDir":    "{GINA_HOMEDIR}/logs/{scope}/{bundleName}",
"publicUrl": "https://{host}:{port}",
"dbPath":    "{GINA_HOMEDIR}/db/{projectName}"
```

```jsonc title="After"
"logDir":    "${GINA_HOMEDIR}/logs/${scope}/${bundleName}",
"publicUrl": "https://${host}:${port}",
"dbPath":    "${GINA_HOMEDIR}/db/${projectName}"
```

All built-in framework templates shipped with gina have already been updated.
User-managed config files under your bundle's `config/` directory must be
updated manually.

:::note Unaffected syntax
- **Dot-notation path references** (`{gina.core}`, `{gina.utils}`) — whisper
  only matches `${identifier}` where the identifier is word characters (`\w+`).
  Dots fall outside that set, so dot-notation is never replaced regardless of
  whether `$` is present. Leave them as-is.
- **The `{src:...}` wrapper** in `templates.json` — this is a template
  file-include directive, not a whisper variable. The outer `{src:` prefix is
  literal and left untouched. Variables _inside_ the wrapper still use the
  `${variable}` format and are replaced normally:
  ```json
  "pluginLoader": "{src:${gina}/framework/v${version}/core/asset/plugin/dist/vendor/gina/js/gina.onload.min.js}"
  ```
:::

---

## 0.1.6 → 0.1.7

### Cache — sliding window and absolute ceiling

Two optional fields have been added to the per-route `cache` config in
`routing.json`. Existing configs that only use `ttl` are **unchanged** — this
is a purely additive change.

| Field | Type | Default | Description |
|---|---|---|---|
| `sliding` | boolean | `false` | When `true`, the TTL resets on every request that hits the cached entry. The entry stays warm as long as it keeps receiving traffic. |
| `maxAge` | number (seconds, fractional ok) | — | Absolute lifetime ceiling, measured from creation time. Only meaningful when `sliding: true`. Strongly recommended whenever sliding is enabled. |

The meaning of `ttl` changes depending on `sliding`:

| `sliding` | `ttl` meaning |
|---|---|
| `false` (default) | Absolute duration from creation — unchanged behaviour |
| `true` | Idle eviction threshold (seconds since last access); `maxAge` is the hard ceiling |

```jsonc title="routing.json"
// Unchanged — absolute TTL of 1 hour (no action required)
{ "type": "memory", "ttl": 3600 }

// Evict if not accessed for 5 minutes — no hard ceiling
{ "type": "memory", "ttl": 300, "sliding": true }

// Evict if idle for 5 minutes OR after 1 hour — recommended pattern
{ "type": "memory", "ttl": 300, "sliding": true, "maxAge": 3600 }
```

:::caution No hard ceiling without `maxAge`
Without `maxAge`, a constantly-accessed sliding entry never expires. Stale data
can persist indefinitely on busy routes. Always pair `sliding: true` with a
`maxAge` unless you have a separate invalidation strategy via
`invalidateOnEvents`.
:::

The `Cache-Status` response header format is extended for sliding entries:

| Scenario | Header value |
|---|---|
| Non-sliding (unchanged) | `gina-cache; hit; ttl=NNN` |
| Sliding | `gina-cache; hit; ttl=NNN; max-age=MMM` |

- `ttl=` — remaining seconds in the current idle window
- `max-age=` — remaining seconds until the absolute ceiling

See the [Caching guide](./guides/caching) for the full reference.

---

### Cache — sub-second TTL and maxAge values

`ttl` and `maxAge` now accept fractional seconds (e.g. `0.5` for 500 ms).
Previously, fractional values were silently truncated to zero, causing immediate
eviction. Integer values are unchanged — **no action required** on existing configs.

---

### Per-route query timeout — `queryTimeout` field

A new optional `queryTimeout` field is available on every route in `routing.json`. When set,
it acts as the timeout budget for outgoing `self.query()` calls made within that route's
controller action — without having to pass `requestTimeout` explicitly at every call site.

This is a **purely additive change** — existing `routing.json` files require no modification.

```jsonc title="routing.json"
"report-export": {
  "url": "/reports/:id/export",
  "param": { "control": "export" },
  "queryTimeout": "120s"   // or 120000 — both are accepted
}
```

Priority order for `self.query()` timeout (highest wins):

1. `requestTimeout` in the `self.query()` options object (explicit call-site override)
2. `queryTimeout` on the matched route in `routing.json` (per-route default)
3. Framework hard default — `10s`

See the [Routing guide](./guides/routing#per-route-query-timeout) for full details.

:::note Why not `timeout`?
`timeout` is reserved for future incoming-request cancellation. `queryTimeout` is scoped
exclusively to outgoing `self.query()` calls, making its intent unambiguous.
:::

---

### `app.json` proxy — `timeout` renamed to `requestTimeout`

The `timeout` field on a proxy target entry in `app.json` has been renamed to
`requestTimeout`. This is a **breaking rename** — update every `proxy.<service>`
block that declares a `timeout` value.

```jsonc title="src/dashboard/config/app.json — before"
"proxy": {
  "coreapi": {
    "hostname": "coreapi@myproject",
    "port"    : "coreapi@myproject",
    "timeout" : "30s"   // ← rename this
  }
}
```

```jsonc title="src/dashboard/config/app.json — after"
"proxy": {
  "coreapi": {
    "hostname"      : "coreapi@myproject",
    "port"          : "coreapi@myproject",
    "requestTimeout": "30s"   // ✓
  }
}
```

If `timeout` is omitted, behaviour is unchanged — the framework default of `10s` applies.

:::note Priority order for outgoing request timeout
`self.query()` resolves the request timeout in this order (highest wins):
1. `requestTimeout` in the `self.query()` options object (explicit call-site override)
2. `requestTimeout` on the matched proxy target in `app.json`
3. `queryTimeout` on the matched route in `routing.json`
4. Framework hard default — `10s`
:::

---

### Timeout config — human-readable string format

All timeout fields in `settings.json` and `app.json` now accept duration strings
in addition to plain millisecond integers. Plain integers continue to work
unchanged.

Accepted units: `ms`, `s`, `m`, `h`

```jsonc title="settings.json (example)"
"keepAliveTimeout": "5s",      // was 5000
"headersTimeout":   "5500ms",  // was 5500
"pingInterval":     "5s",      // was 5000
"pingTimeout":      "45s",     // was 45000
"timeout":          "30s"      // was 30000 (proxy config)
```

:::note autoTmpCleanupTimeout
The `autoTmpCleanupTimeout` string format (`"10m"` etc.) was documented since
0.1.x but silently broken — the value was parsed as `NaN`. It is correctly
parsed as of 0.1.7.
:::

---

## 0.1.x → 0.1.6

### Node.js

Minimum version bumped to **Node 18**. Maximum `< 26`. Drop support for Node
16 and 17.

---

### Docker / Kubernetes

Use the new `gina-container` binary for foreground bundle launch in containers.
It handles `SIGTERM` gracefully and does not use the background daemon mode.

In your `Dockerfile` or Kubernetes spec, replace:

```sh
gina bundle:start <bundle> @<project>
```

with:

```sh
gina-container bundle:start <bundle> @<project>
```

See the [K8s and Docker guide](./guides/k8s-docker) for the full signal
propagation design and graceful shutdown details.

---

### Upload config — automatic tmp cleanup

`autoTmpCleanupTimeout` is now available in `settings.json` to schedule
automatic removal of uploaded temporary files. No action required if you do not
use file uploads.

```jsonc title="settings.json"
"upload": {
  "autoTmpCleanupTimeout": false  // false | 0 to disable, or a duration e.g. "10m"
}
```

Default is `false` (disabled).

---

### Security — swig CVE-2023-25345

CVE-2023-25345 is a directory-traversal / arbitrary-file-read flaw in swig's filesystem loader: an `{% include %}` / `{% extends %}` path that traverses upward — or arrives through an untrusted variable — could escape the template root and read an arbitrary file into the render. Patched in-place in the vendored swig 1.4.2: template paths in `{% extends %}` tags and relative/absolute `file` paths are now validated against the template root before being read. **No user action required.** See the [Swig security reference](/templating/swig/security#cve-2023-25345) for the full advisory.

---

## 0.0.9p2 → 0.1.x

### Node.js

Minimum version is now **Node 16**. Drop support for Node < 16.

---

### `settings.json` — new server fields

Add a `server` block to every bundle's `settings.json`:

```json title="src/<bundle>/config/settings.json"
{
  "server": {
    "engine": "isaac",
    "keepAliveTimeout": 5000,
    "headersTimeout": 5500,
    "http2Options": {
      "maxConcurrentStreams": 128
    }
  }
}
```

Use `"engine": "express"` to keep the legacy Express adapter.

---

### HTTP/2 (isaac engine)

TLS certificates are required. HTTP/1.1 fallback is available via `allowHTTP1`.

```json title="src/<bundle>/config/settings.json"
{
  "server": {
    "protocol": "http/2.0",
    "scheme": "https",
    "allowHTTP1": true,
    "credentials": {
      "privateKey":  "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/private.key",
      "certificate": "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/certificate.crt",
      "ca":          "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/ca_bundle.crt"
    }
  }
}
```

See the [HTTPS guide](./guides/https) for certificate setup instructions.

---

### `app.json` — proxy config new fields

```jsonc title="src/<bundle>/config/app.json"
"proxy": {
  "<service>": {
    "ca":       "<path to CA bundle>",
    "hostname": "<bundle>@<project>",
    "port":     "<bundle>@<project>",
    "path":     "<base path>"
  }
}
```

---

### engine.io / WebSocket (optional)

If using `ioServer`, add to `settings.json`:

```json title="src/<bundle>/config/settings.json"
{
  "ioServer": {
    "integrationMode": "attach",
    "transports": ["websocket", "polling"],
    "pingInterval": 5000,
    "pingTimeout": 10000
  }
}
```

---

## 0.0.9 → 0.0.9p1

- Move statics definitions from `config/views.json` to `config/statics.json`.
- In `project.json`, for each bundle declaration, remove the `target` key from
  `bundle.release.target`.

---

## 0.0.9p1 → 0.0.9p2

No action required.
