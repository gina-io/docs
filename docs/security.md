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
| [CVE-2023-44487](https://nvd.nist.gov/vuln/detail/CVE-2023-44487) | HTTP/2 Rapid Reset | **Critical** | `maxSessionRejectedStreams` + Node.js patch | ≥ 20.12.1 |
| [CVE-2024-27316](https://nvd.nist.gov/vuln/detail/CVE-2024-27316) | CONTINUATION flood | **High** | `maxSessionInvalidFrames` + Node.js patch | ≥ 20.12.1 |
| [CVE-2024-27983](https://nvd.nist.gov/vuln/detail/CVE-2024-27983) | CONTINUATION flood (Node.js) | **High** | Node.js patch | ≥ 20.12.1 |
| [CVE-2019-9514](https://nvd.nist.gov/vuln/detail/CVE-2019-9514) | RST flood | **High** | `maxSessionRejectedStreams` | any |
| — | HPACK bomb | Medium | `maxHeaderListSize: 65536` | any |
| — | Server push abuse | Low | `enablePush: false` | any |

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

**OS-level fix:** Node.js ≥ 20.12.1 includes the upstream `nghttp2` patch that rate-limits
stream resets at the HTTP/2 framing layer. Both layers are required for full protection.

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
    maxHeaderListSize: 65536,   // 64 KB compressed header cap
    ...
};
```

`maxHeaderListSize` is sent to the client in the HTTP/2 `SETTINGS` frame. Compliant
clients will not send header blocks larger than this value. Non-compliant clients that
exceed the limit receive a `COMPRESSION_ERROR` stream error.

---

## Server push disabled

HTTP/2 server push was deprecated in Chrome 106 (October 2022) and removed in Firefox 132.
The RFC 9113 revision also relaxes the requirement. Gina disables it unconditionally:

```js
http2Options.settings = {
    enablePush: false,
    ...
};
```

This eliminates an entire attack surface (push cache poisoning, resource amplification)
at zero cost to legitimate use cases.

---

## Configuring HTTP/2 security limits

The `maxSessionRejectedStreams` and `maxSessionInvalidFrames` values are not currently
user-configurable (they are set to conservative defaults). The `maxConcurrentStreams`
and `initialWindowSize` settings can be tuned in your bundle's `settings.server.json`:

```json
{
  "server": {
    "http2Options": {
      "maxConcurrentStreams": 256,
      "initialWindowSize": 655350
    }
  }
}
```

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
