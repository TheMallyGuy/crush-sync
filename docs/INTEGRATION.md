# Integration Guide & Terms

**CONTENT BY AN AI, MODIFIED BY A HUMAN**

This document is the contract for integrating any bootstrapper with the Crush
Cloud Sync API. It covers authentication, the **mandatory** universal config
format, the encryption envelope, the merge protocol, and the endpoint reference.

How you may **handle** the data you access is governed by the
[Data Handling & Acceptable Use Policy](DATA_POLICY.md) — read it too; it is
equally binding.

> **The one rule:** every integrator **MUST** read and write the
> [Universal Bootstrap Config](#the-universal-bootstrap-config) format, and
> **MUST** merge rather than overwrite. The cloud blob is shared across *all*
> bootstrappers. Ignoring this corrupts other apps' data and is grounds for
> having your tokens revoked.

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are used as in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## Terms of use

By calling this API you agree to the following. These are requirements, not
suggestions — the whole point of a shared cloud is that everyone plays by them.

1. **You MUST use the Universal Bootstrap Config schema** (below) as the body of
   everything you store. You MUST NOT dump your app's own private config shape
   into the root of the blob.
2. **You MUST merge, never replace.** Before writing, fetch the current blob,
   layer your changes onto it, and write the result back. A blind overwrite
   wipes every other bootstrapper's settings.
3. **You own only your own vendor key.** You MAY write `vendor.<your-id>`. You
   **MUST NOT** modify, drop, or reorder any other `vendor.*` entry, nor delete
   universal fields you don't understand.
4. **You MUST honour `schemaVersion`.** If you read a blob whose
   `schemaVersion` is newer than you support, do not apply it and do not write
   over it — surface an "update required" state instead.
5. **The auth token is per user, not per app.** It identifies the human, not
   your bootstrapper. Don't share it, log it, or send it anywhere but this API.
6. **Encryption.** On `/v1/config` it is end-to-end — the server stores an opaque
   blob and cannot read it; use the same [envelope](#encryption) and password for
   cross-app interop. `/v2/config` encrypts server-side and is **not** private
   from the server; prefer v1.
7. **Don't abuse it.** No polling tighter than the documented cadence, no bulk
   scraping, no storing data unrelated to bootstrapper configuration.

---

## API versions

Authentication is shared and lives under `/v1/auth/*` regardless of which config
version you use. Config storage comes in two flavours:

| | `/v1/config` — **recommended** | `/v2/config` — convenience |
|---|---|---|
| Where encryption happens | **Client** (end-to-end) | **Server** |
| What the server receives | opaque ciphertext only | your **plaintext** config + your **password** |
| What the server stores | ciphertext | ciphertext (encrypted server-side) |
| Trust model | **zero-trust** — server can't read your data | you must trust the operator not to read/log it |
| Client must implement crypto | yes (see [ENCRYPTION.md](ENCRYPTION.md)) | no |

**Use v1 unless you have a strong reason not to.** v2 exists only so a client
that can't implement the encryption can still get encryption *at rest*. It is
**not** private from the server — see the warning in [Encryption](#encryption).

---

## Authentication

Login happens in the user's browser; the token is handed back to your app via a
short-lived pairing code. No deep links, no local server, works headless.

```
1. pair = random UUID
2. open the user's browser to:   GET /auth/login?pair=<pair>
3. poll until the token appears:  GET /auth/poll?pair=<pair>
      204  -> not ready, wait ~2s and retry
      200  -> { "token": "..." }  (consumed once; store it)
   give up after 5 minutes (the pairing code expires)
4. use the token as a Bearer credential on every other call
```

Persist the token and skip steps 1–3 on later runs. Validate a stored token with
`POST /auth/me`.

---

## The Universal Bootstrap Config

This is the **only** accepted body format. Map your app's settings to and from
it. Every field is optional; write only what you actually understand.

```ts
type CloudUniversalConfig = {
    /** Schema version. Currently 1. Check it before reading. */
    schemaVersion: 1

    /** ISO-8601 timestamp of the last write. Set it when you write. */
    updatedAt?: string

    /** Roblox FastFlag overrides (FFlag/DFFlag/FInt/...). Most portable field. */
    fastFlags?: Record<string, string | number | boolean>

    integrations?: {
        discordRichPresence?: {
            enabled?: boolean
            showAccount?: boolean
            allowJoining?: boolean
            showServerDetails?: boolean
        }
        activityTracking?: { enabled?: boolean }
        crashHandler?: { autoClose?: boolean; disable?: boolean }
        updates?: {
            checkForUpdates?: boolean
            backgroundUpdates?: boolean
            updateRoblox?: boolean
        }
        matchmaking?: {
            betterMatchmaking?: boolean
            serverRegionNotifier?: boolean
        }
        processPriority?:
            | 'below_normal'
            | 'normal'
            | 'above_normal'
            | 'high'
            | 'realtime'
        windowControl?: {
            enabled?: boolean
            allowMove?: boolean
            allowTitleChange?: boolean
            allowTransparency?: boolean
        }
    }

    /** Install / channel PREFERENCES only — never device paths or state. */
    installation?: {
        version?: string
        pinVersion?: boolean
        vngChannel?: boolean
        parallel?: number
    }

    /** Preferred server region. */
    bestRegion?: string

    /** Master on/off for FastFlag application. */
    fastFlagsEnabled?: boolean

    /**
     * Per-bootstrapper private settings. Keyed by a stable lowercase id
     * (e.g. "crush", "bloxstrap"). You own only your key.
     */
    vendor?: Record<string, unknown>
}
```

### Mapping rules

- **Common settings go in the common fields.** If a concept exists across forks
  (Discord RPC, crash handler, FastFlags, channel, region), map it into the
  shared field so other apps interoperate. Example: Bloxstrap's
  `ShowAccountOnRichPresence`, Froststrap's `displayAccount`, and Crush's
  `discordRpc.displayAccount` all map to
  `integrations.discordRichPresence.showAccount`.
- **App-specific settings go in `vendor.<your-id>`.** Anything with no universal
  equivalent (custom themes, mod managers, your own UI flags) lives under your
  vendor key. This is also where you can keep a full-fidelity copy of your own
  config for lossless self round-trips.
- **Device-local data MUST NOT be uploaded.** Auth tokens, install paths, the
  active install on this machine, cached data, and transient flags (e.g. "force
  reinstall") stay on the device.

---

## The merge protocol

Every write is a read-modify-write. Never `PUT` a freshly built object.

```
SYNC UP (your settings -> cloud)
  1. contribution = mapYourConfig() -> CloudUniversalConfig (your fields + vendor.you)
  2. existing     = GET /config/sync, then decrypt   (null if empty/404)
  3. merged       = mergeUniversal(existing, contribution)
        - common fields: your values win
        - vendor:        replace ONLY vendor.you; keep every other vendor entry
        - set updatedAt = now, schemaVersion = 1
  4. POST /config/sync  with encrypt(JSON(merged))

SYNC DOWN (cloud -> your settings)
  1. blob = decrypt(GET /config/sync)
  2. if blob.schemaVersion > supported -> stop, show "update required"
  3. apply common fields + vendor.you onto your local config
  4. preserve your device-local fields (don't let the cloud overwrite paths etc.)
```

**Change detection:** hash *your contribution only* (excluding `updatedAt`), not
the whole merged blob. Otherwise another app editing its vendor entry will look
like a change and you'll sync in a loop.

---

## Encryption

Both versions encrypt with the **same scheme** (PBKDF2 → AES-GCM, same envelope).
The only difference is **where** it runs and therefore **who can read your data**.

- **KDF:** PBKDF2, SHA-256, 200,000 iterations, random 16-byte salt.
- **Cipher:** AES-GCM, 256-bit key, random 12-byte IV.
- **Plaintext:** UTF-8 JSON of `CloudUniversalConfig`.
- **Envelope** (this exact JSON shape is the stored body):

```json
{
  "v": 1,
  "salt": "<base64>",
  "iv": "<base64>",
  "data": "<base64 ciphertext>"
}
```

### v1 — end-to-end (recommended)

The **client** encrypts before uploading and decrypts after downloading. The
server stores an opaque string and **cannot read it**. The password is **never**
uploaded. For two apps to share a user's config they must implement the same
envelope and the user must use the same password.

Drop-in TypeScript and C# reference implementations are in
**[ENCRYPTION.md](ENCRYPTION.md)** — copy one of those rather than rolling your
own; the tag-placement detail is easy to get wrong. A failed AES-GCM auth tag
means the wrong password; change nothing locally. Losing the password makes the
config unrecoverable by design — that's the point.

### v2 — server-side (encryption at rest only)

The **client** sends the **plaintext** config and the password in a `Passwords`
header; the **server** does the encryption. The client implements no crypto.

> ### ⚠️ v2 is NOT private from the server
> With v2 the server receives your plaintext config and your password on every
> request. It encrypts *after* receiving them, so at that moment it — and anyone
> who can log its traffic or change its code — can read both. v2 only protects
> against a **stolen database** (the data is ciphertext at rest). It does **not**
> give the zero-trust guarantee of v1. Do not describe v2 to users as "private"
> or "end-to-end"; describe it as "encrypted at rest."

The server does not persist the password, but "we don't save it" is a promise,
not a cryptographic guarantee. If you can run v1, run v1.

---

## Endpoint reference

Base URL: `https://cloud-config.mally.qzz.io`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET`  | `/v1/auth/login?pair=<id>` | — | Opens Discord OAuth (browser). |
| `GET`  | `/v1/auth/poll?pair=<id>`  | — | `200 {token}` once ready, else `204`. Consumed on read. |
| `POST` | `/v1/auth/me`              | Bearer | Validate token; `200` if valid. |
| `POST` | `/v1/config/sync`          | Bearer | **E2E.** Store the client-encrypted blob. Body `text/plain`. |
| `GET`  | `/v1/config/sync`          | Bearer | **E2E.** Retrieve the stored blob (client decrypts). |
| `POST` | `/v2/config/sync`          | Bearer + `Passwords` | **At-rest.** Send plaintext; server encrypts with the `Passwords` header. |
| `GET`  | `/v2/config/sync`          | Bearer + `Passwords` | **At-rest.** Server decrypts and returns plaintext. |

All authenticated calls send `Authorization: Bearer <token>`. v2 additionally
requires a `Passwords: <password>` header on both methods. Native HTTP clients
are recommended over browser `fetch` for desktop apps.

---

## Reference flow (pseudocode)

### v1 — end-to-end (recommended)

```ts
const BASE = 'https://cloud-config.mally.qzz.io/v1'

// up
const contribution = mapMyConfigToUniversal()            // your fields + vendor.myapp
const existing = await fetchAndDecrypt(BASE, token, pw)  // CloudUniversalConfig | null
const merged = mergeUniversal(existing, contribution)
await fetch(`${BASE}/config/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: await encrypt(JSON.stringify(merged), pw),     // CLIENT encrypts
})

// down
const blob = JSON.parse(await decrypt(await getBody(BASE, token), pw))
if (blob.schemaVersion !== 1) throw new Error('update required')
applyUniversalToMyConfig(blob)                           // common fields + vendor.myapp
```

### v2 — server-side (no client crypto)

The merge still applies; you just fetch/send **plaintext** and pass the password
as a header. Same caveats as the [Encryption](#encryption) warning.

```ts
const BASE = 'https://cloud-config.mally.qzz.io/v2'
const headers = { Authorization: `Bearer ${token}`, Passwords: pw }

// down: server decrypts and returns plaintext JSON
const existing = JSON.parse(await (await fetch(`${BASE}/config/sync`, { headers })).text())

// up: send plaintext; server encrypts at rest
const merged = mergeUniversal(existing, mapMyConfigToUniversal())
await fetch(`${BASE}/config/sync`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'text/plain' },
    body: JSON.stringify(merged),                        // SERVER encrypts
})
```

Questions or a new vendor id to reserve? Open an issue on
[crush-sync](https://github.com/themallyguy/crush-sync).
