# Data Handling & Acceptable Use Policy

**CONTENT BY AN AI, MODIFIED BY A HUMAN**

This policy governs how any bootstrapper ("**you**", "**the integrator**") may
access, store, and use data obtained through the Crush Cloud Sync API ("**the
API**"). It complements the [Integration Guide & Terms](INTEGRATION.md); both are
binding. Continued use of the API constitutes acceptance.

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are used as in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## 1. Definitions

- **User data** — any content stored under a user's account: the encrypted blob,
  its decrypted contents, the `CloudUniversalConfig`, and every `vendor.*` entry.
- **Your vendor data** — the single `vendor.<your-id>` entry your app owns.
- **Foreign data** — everything in the blob that is not your vendor entry:
  universal fields you didn't write, and every other `vendor.*` entry.
- **Token** — the per-user bearer credential returned by `/auth/poll`.

---

## 2. Access scope

1. A token grants access **only to the data of the user it was issued for**. You
   **MUST NOT** attempt to access another user's data, enumerate accounts, guess
   tokens, or use one user's token for another user.
2. You **MUST** request only the data you need to provide configuration sync. The
   API is **not** general-purpose storage; you **MUST NOT** store data unrelated
   to bootstrapper configuration.
3. You **MUST NOT** use the API, or data from it, to build a profile of a user,
   track users across apps, or correlate identities.

---

## 3. Foreign data — read to preserve, nothing else

The shared blob means you will *see* other apps' data. This is a custodial
responsibility, not a license to use it.

1. You **MAY** read foreign data **only** for the purpose of preserving it during
   a merge (read-modify-write), exactly as described in the merge protocol.
2. You **MUST NOT** copy, persist, transmit, transform, analyze, index, or
   display foreign data anywhere outside the merge round-trip.
3. You **MUST NOT** repurpose another vendor's settings — including importing
   them into your own `vendor` entry or universal fields — without that data
   genuinely belonging to the user's portable configuration.
4. You **MUST NOT** delete, corrupt, reorder, or tamper with foreign data.
   Writing back anything other than a faithful copy of foreign data is a
   violation, even if unintentional.

---

## 4. No leaking or exfiltration

1. You **MUST NOT** transmit user data (yours or foreign) to any third party,
   server, analytics provider, log sink, telemetry pipeline, or external service,
   except the API itself.
2. You **MUST NOT** sell, rent, publish, share, or otherwise disclose user data.
3. You **MUST NOT** include user data, tokens, decrypted config, or passwords in
   logs, crash reports, error trackers, screenshots, or support bundles. Redact
   before any diagnostic leaves the device.
4. If you cache decrypted data locally, it **MUST** stay on the user's device and
   **MUST NOT** be synced, backed up, or uploaded anywhere but the API.

---

## 5. Encryption and passwords

1. End-to-end encryption (`/v1/config`) is **strongly preferred**. If your app
   encrypts client-side, it **MUST** use the documented
   [envelope](INTEGRATION.md#encryption) and **MUST NOT** weaken its parameters.
2. With the E2E flow the user's password **MUST** stay on the device — you
   **MUST NOT** upload, transmit, log, or persist it. The `/v2/config` flow sends
   the password to the server by design (`Passwords` header); if you use v2 you
   **MUST** tell users their config is only *encrypted at rest*, **not** private
   from the operator, and you **MUST NOT** advertise it as end-to-end.
3. You **MUST NOT** attempt to brute-force, weaken, or circumvent another app's
   encryption, or downgrade an encrypted blob to plaintext.

---

## 6. Tokens and credentials

1. Tokens **MUST** be stored securely on the device (OS keychain/secure storage
   where available) and **MUST NOT** be shared between users or devices except
   through a fresh login.
2. You **MUST NOT** embed a shared or service token in your distributed app.
   Every user authenticates as themselves.
3. On user logout or account removal, you **MUST** delete the stored token and
   any cached decrypted data.

---

## 7. Consent, transparency, and user control

1. You **MUST** clearly tell users that enabling sync uploads their configuration
   to the Crush Cloud, and what is included.
2. Sync **MUST** be opt-in or clearly user-initiated. You **MUST NOT** silently
   upload data the user did not intend to sync.
3. You **MUST** provide a way for users to stop syncing and to remove their data.
4. You **MUST** respect a user's request to delete their data and **MUST NOT**
   retain a copy elsewhere after they leave.

---

## 8. Rate limits and abuse

1. You **MUST NOT** poll more aggressively than documented (`/auth/poll` ~ every
   2s; config sync is change-triggered, not a tight loop).
2. You **MUST NOT** scrape, mass-download, or bulk-enumerate data.
3. You **MUST NOT** use the API for denial-of-service, load testing without
   permission, automated mass account creation, or as a free CDN/database.
4. You **MUST NOT** circumvent quotas, throttling, or access controls.

---

## 9. Security and disclosure

1. You **MUST** apply reasonable security practices to any device-side handling
   of tokens and decrypted data.
2. If you discover a vulnerability in the API or in another integrator that could
   expose user data, you **MUST** report it privately (see §11) and **MUST NOT**
   exploit it or disclose it publicly before it is fixed.

---

## 10. Enforcement

Violations may result in, at the operator's sole discretion and without notice:

- revocation of affected user tokens and your app's access;
- IP / application-level blocking;
- public disclosure of the violating integrator;
- referral to the relevant platform or legal authorities where data was leaked,
  sold, or misused.

Access to the API is a privilege extended on the condition that you follow this
policy. It can be withdrawn at any time.

---

## 11. Reporting & contact

Report abuse, vulnerabilities, or data-handling concerns privately via an issue
or security advisory on
[crush-sync](https://github.com/themallyguy/crush-sync). For suspected leaks,
mark the report as security-sensitive rather than opening a public issue.

---

## 12. Disclaimer

The API is provided "as is", without warranty. The operator is not liable for an
integrator's misuse of user data. Integrators are solely responsible for their
own handling of data obtained through the API and for compliance with applicable
laws.
