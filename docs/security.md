---
title: Security & CVE compliance
sidebar_label: Security
sidebar_position: 9
description: HTTP/2 CVEs addressed by Gina and the Node.js version required for each mitigation. Covers Rapid Reset, CONTINUATION flood, RST flood, and HPACK bomb.
keywords: [gina security, http/2 cve, CVE-2023-44487, CVE-2024-27316, CVE-2024-27983, CVE-2019-9514, rapid reset, continuation flood, rst flood, hpack bomb, node.js http2]
---

# Security & CVE compliance

This page lists the known HTTP/2 vulnerabilities and the mitigations applied by Gina.
All remediations are in effect by default — no configuration is required.

:::info Node.js version requirement
Several OS-level fixes require **Node.js ≥ 20.12.1** (or ≥ 21.7.1 for the v21 line).
Run `node -v` to confirm. If you are below this version, upgrade before deploying
Gina on a public HTTP/2 endpoint.
:::

---

## CVE summary

| CVE | Name | Severity | Gina mitigation | Node.js required |
|---|---|---|---|---|
| [CVE-2023-44487](https://nvd.nist.gov/vuln/detail/CVE-2023-44487) | HTTP/2 Rapid Reset | **Critical** | `maxSessionRejectedStreams` + the runtime's reset rate limit (nghttp2 — Node.js only) + `maxStreamResetsPerSecond` (the only layer on Bun) | ≥ 20.12.1 |
| [CVE-2024-27316](https://nvd.nist.gov/vuln/detail/CVE-2024-27316) | CONTINUATION flood | **High** | `maxSessionInvalidFrames` + Node.js patch | ≥ 20.12.1 |
| [CVE-2024-27983](https://nvd.nist.gov/vuln/detail/CVE-2024-27983) | CONTINUATION flood (Node.js) | **High** | Node.js patch | ≥ 20.12.1 |
| [CVE-2019-9514](https://nvd.nist.gov/vuln/detail/CVE-2019-9514) | RST flood | **High** | `maxSessionRejectedStreams` | any |
| — | HPACK bomb | Medium | `maxHeaderListSize: 65536` | any |
| — | Server push abuse | Low | Not implemented since `0.6.32` (the push code was removed; `enablePush: false` is still advertised) | any |
| — | Static-asset path traversal | **High** | Fixed in `0.5.7` — resolver paths canonicalised and confined to their mapping target | any |
| — | Internal-host disclosure on reverse proxies | Low | Fixed in `0.5.9` — proxied clients receive a public host-only origin and a host-stripped `routing.json`; the internal `scheme://host:port` is no longer serialized to the browser | any |

---

## CVE-2023-44487 — HTTP/2 Rapid Reset

**Attack:** A client opens a stream and immediately sends `RST_STREAM`, cancelling it
before the server finishes processing. By repeating this at high speed (thousands of
streams per second), an attacker can exhaust server resources with zero bandwidth — a
highly asymmetric denial-of-service.

**Gina mitigation (`core/server.isaac.js`):**

```js
http2Options.maxSessionRejectedStreams = 100;
```

When a session exceeds 100 rejected streams, Node.js closes it with a `GOAWAY` frame.
This caps the amplification factor per TCP connection.

**Runtime layer — the primary guard:** Node.js ≥ 20.12.1 ships an `nghttp2` that
rate-limits *received* `RST_STREAM` frames at the framing layer: a 1,000-frame burst,
then 33 per second, after which the session is closed with `GOAWAY(INTERNAL_ERROR)`.
It counts every reset, including one that arrives after the response was already
written, and it raises no server-side event (measured on Node v25.3.0 / nghttp2 1.67.1:
no session `error`, no `sessionError`, no `frameError` — only `close`). The two knobs
behind it are exposed as `http2Options.streamResetBurst` and `streamResetRate`; Node
applies neither unless both are set, so leave both out to keep the runtime defaults.

**Gina's layer — observable, configurable, tighter on bursts:** since `0.6.33` Isaac counts,
per session per rolling one-second window, the streams the *client cut short before the
response completed* — a `RST_STREAM` of any code, or the peer destroying the stream: the
attack shape itself. Past `maxStreamResetsPerSecond` (default 200) Gina sends
`GOAWAY(ENHANCE_YOUR_CALM)`, closes the session, logs a `[ SERVER ]` warning and
increments the `/_gina/info` counters `rapidResetBlocked` (breach events) and `rstCount`
(client resets observed). Engine-side aborts — a server-side destroy, the teardown a
GOAWAY itself causes — are told apart and never counted. A reset that lands after the
response was written is not counted either: the work was done, so it is not
amplification — a fully synchronous route therefore never trips this layer, and a
reset flood against it meets the runtime's limit at ~1,000 instead.

**On Bun there is no runtime layer.** Bun's `node:http2` server carries no frame-level
reset rate limit — measured on Bun 1.2.21, 1.3.14 and 1.4.2: 50,000 open-and-reset pairs
on one session raise no `GOAWAY` and no event — and it ignores `streamResetBurst` /
`streamResetRate` (a bundle setting them on Bun gets one boot warning). Gina's
`maxStreamResetsPerSecond` guard is therefore the **only** rapid-reset mitigation on a
Bun-hosted bundle. It reads Bun's own stream state to tell a client reset from the
engine's own abort (Bun marks the stream closed before raising the abort for a reset it
received; `stream.destroyed`, the Node.js signal, reads differently by Bun version), so
every reset code counts there too — a flood of any code meets the guard at the 201st
reset, as on Node.js.

Before `0.6.33` this layer counted *new streams* (`maxStreamsPerSecond`), and a sibling
bundle's own multiplexed `self.query()` calls tripped it above 200 calls per second on
one cached session — see the migration notes. That key is no longer read: a bundle still
setting it gets one boot warning and the default.

---

## CVE-2024-27316 / CVE-2024-27983 — CONTINUATION flood

**Attack:** An HTTP/2 `HEADERS` frame can be followed by an unlimited sequence of
`CONTINUATION` frames before the end-of-headers flag is set. Sending a very long chain
forces the server to buffer and parse all frames before it can reject the request,
exhausting CPU and memory.

**Gina mitigation (`core/server.isaac.js`):**

```js
http2Options.maxSessionInvalidFrames = 1000;
```

A session that sends more than 1000 frames that fail validation (including malformed
CONTINUATION chains) is closed immediately. Node.js ≥ 20.12.1 additionally rejects
oversized CONTINUATION sequences at the protocol level (CVE-2024-27983 fix).

---

## CVE-2019-9514 — RST flood

**Attack:** A client sends a large number of `RST_STREAM` frames against server-initiated
streams, forcing the server to perform stream state bookkeeping for each one.

**Gina mitigation (`core/server.isaac.js`):**

```js
http2Options.maxSessionRejectedStreams = 100;
```

Same setting as Rapid Reset — once a session reaches the limit, it is closed with
`GOAWAY`. This bounds the per-connection amplification factor to 100 rejected streams.

---

## HPACK bomb

**Attack:** A compressed HTTP/2 header block can expand to a much larger uncompressed
size due to HPACK's Huffman coding and dynamic table references. An attacker can craft a
small compressed payload that forces the server to allocate megabytes of memory while
parsing headers.

**Gina mitigation (`core/server.isaac.js`):**

```js
http2Options.settings = {
    maxHeaderListSize : 65536   // 64 KB compressed header cap
  , ...
};
```

`maxHeaderListSize` is sent to the client in the HTTP/2 `SETTINGS` frame. Compliant
clients will not send header blocks larger than this value. Non-compliant clients that
exceed the limit receive a `COMPRESSION_ERROR` stream error.

---

## Server push not implemented

HTTP/2 server push was deprecated in Chrome 106 (October 2022) and removed in Firefox 132.
The RFC 9113 revision also relaxes the requirement. Since 0.6.32 the framework does not
implement server push at all — the push branch earlier versions carried was removed together
with the static-file listener it lived in, so a request never opens a push stream — and the
server's SETTINGS still advertise it off:

```js
http2Options.settings = {
    enablePush : false
  , ...
};
```

The advertisement alone never prevented pushing: `SETTINGS_ENABLE_PUSH` is the *client's*
setting and Node's `stream.pushAllowed` reflects the peer's value, so before 0.6.32 a
push-capable client (a default `node:http2` session, for instance) could still reach the push
code. Removing the code is what eliminates the attack surface (push cache poisoning, resource
amplification), at no cost to legitimate use cases.

---

## Static-asset path traversal (fixed in 0.5.7)

**Attack:** a request URL containing `../` — or its percent-encoded forms (`%2F`, `%2e%2e`) —
escaped a `statics.json` mapping's target directory and read sibling files under the shared
root (configuration, credentials, server-side source).

**Mitigation:** upgrade to `0.5.7` or later. Both static resolvers canonicalise the resolved
path and confine it to the mapping target (or `publicPath`); any escape returns **404**.
Legitimate assets are served unchanged and no configuration change is required.

---

## Configuring HTTP/2 security limits

The stream, window, and flood-defense limits are tunable in your bundle's
`settings.server.json` under `http2Options` — they ship as conservative defaults, so
override them only when you have a specific reason. The hardcoded security guards
(`maxHeaderListSize`, `enablePush: false`) are not configurable by design.

```json
{
  "server": {
    "http2Options": {
      "maxConcurrentStreams": 256,
      "initialWindowSize": 655350,
      "maxSessionRejectedStreams": 100,
      "maxSessionInvalidFrames": 1000,
      "maxStreamResetsPerSecond": 200
    }
  }
}
```

`streamResetBurst` and `streamResetRate` (the runtime's own reset limit, see above) may be
added to the same block — always together. Node.js only: Bun has no such limit and ignores
both keys.

See the [Configuration reference](/reference/settings) for the full `settings.server.json`
field list.

---

## Checking your Node.js version

```bash
node -v
# Should be v20.12.1 or higher
```

If you are on an older release, upgrade via [nodejs.org](https://nodejs.org) or your
system package manager before exposing an HTTP/2 endpoint to the internet.

---

## Reporting a vulnerability

If you discover a security issue in Gina, please report it privately via
[GitHub Security Advisories](https://github.com/gina-io/gina/security/advisories/new)
rather than opening a public issue. We aim to respond within 72 hours.

---

## Snyk advisory SNYK-JS-GINA-5406434 is a false positive

Snyk's page for the `gina` npm package shows a "This is a malicious package" banner. It comes from a single Snyk record, [SNYK-JS-GINA-5406434](https://security.snyk.io/vuln/SNYK-JS-GINA-5406434), which applies only to version `0.1.1-alpha.234`, a prerelease published in March 2023. Snyk's own page states that the record does not affect the latest version.

- **That version no longer exists.** It was removed from the npm registry on 2026-08-20, so no installable version of Gina is covered by the record.
- **It was never malicious.** Its install scripts only did local setup: they found the npm install prefix and added a directory to the user's `PATH` in `~/.profile`. They made no network requests, downloaded nothing, and read no credentials. The flag most likely came from an `eval()` that the scripts used to call their own setup functions; since April 2026 the install scripts call those functions directly.
- **It is not a dependency-confusion package.** The record describes a package that copies a company's internal package name to trick employees into installing it. `gina` is the original package under this name, first published on npm in October 2014.
- **No other database lists Gina as malicious.** As of September 2026, neither OSV, the GitHub Advisory Database, nor the OpenSSF malicious-packages dataset lists it.

We asked Snyk to withdraw the record in July and August 2026 and have not had a reply. This section will be updated when they respond.

To check for yourself:

```bash
npm view gina time.created             # 2014-10-26
npm view gina@0.1.1-alpha.234 version  # E404 "No match found": the version is no longer published
npm view gina maintainers              # the gina.io maintainer account
```
