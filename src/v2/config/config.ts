import { Hono } from "hono";
import { env } from "cloudflare:workers"
import { decryptConfig, encryptConfig } from "../../encryption";

type Session = {
    userId: string
    username: string
}

const v2configRoute = new Hono()

v2configRoute.post("/sync", async (c) => {
    const passwordsHeader = c.req.header("Passwords")
    const authHeader = c.req.header("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!passwordsHeader) {
        return c.text("Missing `Passwords` header", 400)
    }

    if (!token) {
        return c.text("Unauthorized", 401)
    }

    const raw = await env.KV.get(`token:${token}`)
    if (!raw) {
        return c.text("Unauthorized", 401)
    }

    const session: Session = JSON.parse(raw)

    const receivedConfig = await c.req.text()

    const encrypted = await encryptConfig(receivedConfig, passwordsHeader)

    await env.KV.put(`config:${session.userId}`, encrypted)

    return c.text("Success", 200)
})

v2configRoute.get("/sync", async (c) => {
    const passwordsHeader = c.req.header("Passwords")
    const authHeader = c.req.header("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!passwordsHeader) {
        return c.text("Missing `Passwords` header", 400)
    }

    if (!token) {
        return c.text("Unauthorized", 401)
    }

    const raw = await env.KV.get(`token:${token}`)
    if (!raw) {
        return c.text("Unauthorized", 401)
    }

    const session: Session = JSON.parse(raw)

    const savedConfig = await env.KV.get(`config:${session.userId}`)

    if (!savedConfig) {
        return c.text("Error when trying to getting your configuration", 500)
    }

    const decrypted = await decryptConfig(savedConfig, passwordsHeader)

    return c.text(decrypted, 200)
})

export default v2configRoute;
