# Crush Config Sync API

An API for syncing Crush configuration, built with [Hono](https://hono.dev/) on the Cloudflare ecosystem.

## Integrating

If you're integrating this into your bootstrapper, read the
**[Integration Guide & Terms](docs/INTEGRATION.md)** first, it's the contract.

Short version:

- You **must** use the [Universal Bootstrap Config](docs/INTEGRATION.md#the-universal-bootstrap-config) format and **merge** rather than overwrite. The cloud blob is shared across every bootstrapper.
- You **must** follow the [Data Handling & Acceptable Use Policy](docs/DATA_POLICY.md): read foreign data only to preserve it on merge, never leak, exfiltrate, sell, or repurpose user data, and never abuse the API.
- By default this API doesn't encrypt your data. Please use end-to-end encryption it isn't enforced, but it's strongly recommended to protect user data. If you use encryption its better to follow the standards : [ENCRYPTION.md](docs/ENCRYPTION.md)
