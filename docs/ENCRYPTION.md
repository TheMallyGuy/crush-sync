# Reference Encryption Implementation

**CONTENT BY AN AI, MODIFIED BY A HUMAN**

This is the canonical encryption scheme Crush uses for the cloud blob. Any
bootstrapper that wants to share a user's config **MUST** implement it
byte-for-byte, so the same password decrypts on every app and platform.

> Applies to the **end-to-end `/v1/config`** flow, where the client encrypts.
> `/v2/config` uses this same scheme but runs it **server-side** — see the
> [trust caveat](INTEGRATION.md#encryption). If you use v2 you don't implement
> any of this; you send plaintext and a `Passwords` header.

Reference implementations for **TypeScript** (WebCrypto) and **C#** (.NET) are
below. They are interoperable: a blob encrypted by one decrypts with the other.

---

## Spec

| Parameter | Value |
|-----------|-------|
| KDF | PBKDF2 |
| KDF hash | SHA-256 |
| KDF iterations | **200000** |
| Salt | 16 random bytes, per encryption |
| Derived key | 256-bit (32 bytes) |
| Cipher | AES-GCM |
| IV / nonce | 12 random bytes, per encryption |
| Auth tag | 128-bit (16 bytes) |
| Plaintext | UTF-8 JSON of `CloudUniversalConfig` |
| Encoding | base64 (standard, with padding) |

### Envelope

The stored body is exactly this JSON object:

```json
{
  "v": 1,
  "salt": "<base64 of the 16-byte salt>",
  "iv": "<base64 of the 12-byte IV>",
  "data": "<base64 of (ciphertext || tag)>"
}
```

> ### ⚠️ The one thing that breaks interop
> WebCrypto's `encrypt()` returns the **ciphertext with the 16-byte GCM tag
> appended**. .NET's `AesGcm` keeps them separate. So `data` is always
> `ciphertext || tag`:
> - **When encrypting in .NET:** append the tag to the ciphertext before base64.
> - **When decrypting in .NET:** split off the **last 16 bytes** as the tag.
>
> Get this wrong and every cross-platform decrypt fails with a tag mismatch.

A failed auth tag means the **wrong password** (or tampered data). Treat it as
such and change nothing locally.

---

## TypeScript (WebCrypto)

This is the exact implementation Crush ships. Works in browsers, Tauri, Deno,
Node 18+, and Cloudflare Workers — anywhere `globalThis.crypto.subtle` exists.

```ts
const PBKDF2_ITERATIONS = 200_000
const SALT_BYTES = 16
const IV_BYTES = 12
const ENVELOPE_VERSION = 1

type Envelope = { v: number; salt: string; iv: string; data: string }

export class WrongPasswordError extends Error {
    constructor(message = 'wrong password') {
        super(message)
        this.name = 'WrongPasswordError'
    }
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const fromB64 = (s: string) =>
    Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    )
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
}

export async function encryptConfig(plaintext: string, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const key = await deriveKey(password, salt)

    // WebCrypto output already includes the 16-byte tag appended to the ciphertext.
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
    )

    const env: Envelope = {
        v: ENVELOPE_VERSION,
        salt: toB64(salt),
        iv: toB64(iv),
        data: toB64(new Uint8Array(ct)),
    }
    return JSON.stringify(env)
}

export async function decryptConfig(envelopeJson: string, password: string): Promise<string> {
    const env = JSON.parse(envelopeJson) as Envelope
    if (env.v !== ENVELOPE_VERSION || !env.salt || !env.iv || !env.data) {
        throw new WrongPasswordError('not encrypted or corrupted')
    }

    const key = await deriveKey(password, fromB64(env.salt))
    try {
        const pt = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromB64(env.iv) },
            key,
            fromB64(env.data)
        )
        return new TextDecoder().decode(pt)
    } catch {
        throw new WrongPasswordError()
    }
}
```

---

## C# (.NET 8+)

Uses `Rfc2898DeriveBytes.Pbkdf2` and `System.Security.Cryptography.AesGcm`. No
external packages.

```csharp
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

public sealed class WrongPasswordException : Exception
{
    public WrongPasswordException(string message = "wrong password") : base(message) { }
}

public static class ConfigCrypto
{
    private const int Pbkdf2Iterations = 200_000;
    private const int SaltBytes = 16;
    private const int IvBytes = 12;
    private const int TagBytes = 16;
    private const int KeyBytes = 32;
    private const int EnvelopeVersion = 1;

    private sealed class Envelope
    {
        [JsonPropertyName("v")] public int V { get; set; }
        [JsonPropertyName("salt")] public string Salt { get; set; } = "";
        [JsonPropertyName("iv")] public string Iv { get; set; } = "";
        [JsonPropertyName("data")] public string Data { get; set; } = "";
    }

    private static byte[] DeriveKey(string password, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            Pbkdf2Iterations,
            HashAlgorithmName.SHA256,
            KeyBytes);

    public static string EncryptConfig(string plaintext, string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltBytes);
        byte[] iv = RandomNumberGenerator.GetBytes(IvBytes);
        byte[] key = DeriveKey(password, salt);

        byte[] plainBytes = Encoding.UTF8.GetBytes(plaintext);
        byte[] cipher = new byte[plainBytes.Length];
        byte[] tag = new byte[TagBytes];

        using (var aes = new AesGcm(key, TagBytes))
            aes.Encrypt(iv, plainBytes, cipher, tag);

        // Match WebCrypto: data = ciphertext || tag
        byte[] data = new byte[cipher.Length + tag.Length];
        Buffer.BlockCopy(cipher, 0, data, 0, cipher.Length);
        Buffer.BlockCopy(tag, 0, data, cipher.Length, tag.Length);

        var env = new Envelope
        {
            V = EnvelopeVersion,
            Salt = Convert.ToBase64String(salt),
            Iv = Convert.ToBase64String(iv),
            Data = Convert.ToBase64String(data),
        };
        return JsonSerializer.Serialize(env);
    }

    public static string DecryptConfig(string envelopeJson, string password)
    {
        Envelope? env;
        try { env = JsonSerializer.Deserialize<Envelope>(envelopeJson); }
        catch { throw new WrongPasswordException("not encrypted or corrupted"); }

        if (env is null || env.V != EnvelopeVersion ||
            string.IsNullOrEmpty(env.Salt) || string.IsNullOrEmpty(env.Iv) ||
            string.IsNullOrEmpty(env.Data))
            throw new WrongPasswordException("not encrypted or corrupted");

        byte[] salt = Convert.FromBase64String(env.Salt);
        byte[] iv = Convert.FromBase64String(env.Iv);
        byte[] data = Convert.FromBase64String(env.Data);
        byte[] key = DeriveKey(password, salt);

        // Split off the trailing 16-byte tag that WebCrypto appended.
        int cipherLen = data.Length - TagBytes;
        if (cipherLen < 0) throw new WrongPasswordException("corrupted");

        byte[] cipher = new byte[cipherLen];
        byte[] tag = new byte[TagBytes];
        Buffer.BlockCopy(data, 0, cipher, 0, cipherLen);
        Buffer.BlockCopy(data, cipherLen, tag, 0, TagBytes);

        byte[] plain = new byte[cipherLen];
        try
        {
            using var aes = new AesGcm(key, TagBytes);
            aes.Decrypt(iv, cipher, tag, plain);
        }
        catch (CryptographicException)
        {
            // Auth tag mismatch -> wrong password or tampered data.
            throw new WrongPasswordException();
        }

        return Encoding.UTF8.GetString(plain);
    }
}
```

> **.NET version notes:**
> - `Rfc2898DeriveBytes.Pbkdf2(...)` static method requires **.NET 6+**.
> - `new AesGcm(key, tagSizeInBytes)` requires **.NET 8+**. On .NET 6/7 use
>   `new AesGcm(key)` (the tag size is taken from the tag buffer length, 16).

---

## Cross-check

To confirm your implementation matches, encrypt this plaintext with password
`hunter2` in one language and decrypt in the other — you should get the original
string back:

```json
{"schemaVersion":1,"fastFlagsEnabled":true}
```

Because the salt and IV are random, two encryptions never produce identical
envelopes — verify by **round-tripping**, not by comparing ciphertext.
